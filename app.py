from flask import Flask, request, redirect, url_for, render_template, jsonify
import os, threading, time, subprocess, shutil, datetime, sqlite3, queue

app = Flask(__name__)
DB_LOCK = threading.Lock()

# মেমোরি ভেরিয়েবল
active_processes = {} 
active_live_streams = {} 
MAX_LIVE_STREAMS = 3
task_queue = queue.Queue()

# ==========================================
# ডেটাবেজ (SQLite) ফাংশনস
# ==========================================
def db_execute(query, args=()):
    with DB_LOCK:
        conn = sqlite3.connect('database.db', timeout=10)
        cur = conn.cursor()
        cur.execute(query, args)
        conn.commit()
        last_id = cur.lastrowid
        conn.close()
        return last_id

def db_query(query, args=(), one=False):
    with DB_LOCK:
        conn = sqlite3.connect('database.db', timeout=10)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(query, args)
        rows = [dict(row) for row in cur.fetchall()]
        conn.close()
        return (rows[0] if rows else None) if one else rows

def init_db():
    db_execute('''CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY, type TEXT, project TEXT, link TEXT, 
        status TEXT, progress TEXT, last_update TEXT, log_file TEXT, cancel_req INTEGER
    )''')
    db_execute('''CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT, time TEXT, message TEXT, level TEXT
    )''')

def add_activity(msg, level="info"):
    tm = datetime.datetime.now().strftime("%d %b %Y, %I:%M:%S %p")
    db_execute("INSERT INTO activities (time, message, level) VALUES (?, ?, ?)", (tm, msg, level))

# ==========================================
# হেল্পার ফাংশনস
# ==========================================
def read_tail(filepath, lines=15):
    try:
        if not os.path.exists(filepath): return "লগ ফাইল তৈরি হচ্ছে..."
        with open(filepath, "r") as f:
            return "".join(f.readlines()[-lines:])
    except: return "লগ পড়তে সমস্যা হচ্ছে।"

def check_video_codec(filepath):
    try:
        cmd = f"ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 '{filepath}'"
        return subprocess.check_output(cmd, shell=True, text=True).strip().lower()
    except: return "unknown"

def monitor_process(proc, task_id, phase, folder_path, file_prefix=None):
    while proc.poll() is None:
        task = db_query("SELECT cancel_req FROM tasks WHERE id=?", (task_id,), one=True)
        if task and task['cancel_req'] == 1:
            try: 
                proc.terminate()
                proc.kill()
            except: pass
            break
        try:
            if phase == "download":
                files = os.listdir(folder_path)
                if files:
                    latest = max(files, key=lambda x: os.path.getmtime(os.path.join(folder_path, x)))
                    size = os.path.getsize(os.path.join(folder_path, latest))
                    db_execute("UPDATE tasks SET progress=?, last_update=? WHERE id=?", 
                               (f"{size / (1024*1024):.2f} MB ডাউনলোড হয়েছে", datetime.datetime.now().strftime("%I:%M:%S %p"), task_id))
            elif phase == "encode":
                total_size = sum(os.path.getsize(os.path.join(folder_path, f)) for f in os.listdir(folder_path) if f.startswith(file_prefix) and f.endswith(".flv")) if os.path.exists(folder_path) else 0
                db_execute("UPDATE tasks SET progress=?, last_update=? WHERE id=?", 
                           (f"{total_size / (1024*1024):.2f} MB রেডি হয়েছে", datetime.datetime.now().strftime("%I:%M:%S %p"), task_id))
        except: pass
        time.sleep(3)

# ==========================================
# ব্যাকগ্রাউন্ড এনকোডিং ওয়ার্কার
# ==========================================
def worker():
    pending_tasks = db_query("SELECT id FROM tasks WHERE type='encode' AND (status LIKE '%ওয়েটিং%' OR status LIKE '%লাইভের কারণে%') ORDER BY id ASC")
    if pending_tasks:
        for pt in pending_tasks: task_queue.put(pt['id'])

    while True:
        task_id = task_queue.get()
        
        while len(active_live_streams) > 0:
            db_execute("UPDATE tasks SET status='লাইভের কারণে অপেক্ষায়...' WHERE id=?", (task_id,))
            time.sleep(5)
            if db_query("SELECT cancel_req FROM tasks WHERE id=?", (task_id,), one=True)['cancel_req'] == 1: break 
        
        if db_query("SELECT cancel_req FROM tasks WHERE id=?", (task_id,), one=True)['cancel_req'] == 1:
            db_execute("UPDATE tasks SET status='বাতিল করা হয়েছে' WHERE id=?", (task_id,))
            task_queue.task_done()
            continue
            
        task_data = db_query("SELECT * FROM tasks WHERE id=?", (task_id,), one=True)
        link = task_data['link']
        project_name = task_data['project']
        log_file = task_data['log_file']
        
        project_dir = f"projects/{project_name}"
        task_download_dir = f"{project_dir}/downloads/{task_id}"
        encoded_dir = f"{project_dir}/encoded"
        os.makedirs(task_download_dir, exist_ok=True)
        os.makedirs(encoded_dir, exist_ok=True)

        try:
            db_execute("UPDATE tasks SET status='ডাউনলোড হচ্ছে...' WHERE id=?", (task_id,))
            add_activity(f"'{project_name}' প্রজেক্টের কাজ শুরু হয়েছে।", "info")
            
            with open(log_file, "w") as log_f:
                proc1 = subprocess.Popen(f"gdown --fuzzy '{link}'", shell=True, cwd=task_download_dir, stderr=log_f)
                active_processes[task_id] = proc1
                monitor_process(proc1, task_id, "download", task_download_dir)
            
            if db_query("SELECT cancel_req FROM tasks WHERE id=?", (task_id,), one=True)['cancel_req'] == 1: raise Exception("Canceled")

            files = os.listdir(task_download_dir)
            if not files: 
                db_execute("UPDATE tasks SET status='ফেইল হয়েছে' WHERE id=?", (task_id,))
                add_activity(f"'{project_name}' ডাউনলোড ফেইল হয়েছে!", "danger")
            else:
                latest = max(files, key=lambda x: os.path.getctime(os.path.join(task_download_dir, x)))
                input_file = os.path.join(task_download_dir, latest)
                safe_name = latest.replace(' ', '_').replace('.', '_')
                output_pattern = os.path.join(encoded_dir, f"{safe_name}_part%03d.flv")
                
                codec = check_video_codec(input_file)
                if codec == "h264":
                    db_execute("UPDATE tasks SET status='অটো-সুপার ফাস্ট মোডে রেডি হচ্ছে...' WHERE id=?", (task_id,))
                    cmd2 = f"ffmpeg -y -i '{input_file}' -c:v copy -c:a aac -b:a 128k -f segment -segment_time 60 -reset_timestamps 1 '{output_pattern}'"
                    applied_mode = "সুপার ফাস্ট"
                else:
                    db_execute("UPDATE tasks SET status='অটো-সেইফ মোডে রেডি হচ্ছে...' WHERE id=?", (task_id,))
                    cmd2 = f"ffmpeg -y -i '{input_file}' -threads 2 -max_muxing_queue_size 1024 -c:v libx264 -preset ultrafast -b:v 4500k -maxrate 4500k -bufsize 9000k -pix_fmt yuv420p -g 60 -c:a aac -b:a 128k -f segment -segment_time 60 -reset_timestamps 1 '{output_pattern}'"
                    applied_mode = "সেইফ মোড"
                
                with open(log_file, "a") as log_f:
                    proc2 = subprocess.Popen(cmd2, shell=True, stderr=log_f)
                    active_processes[task_id] = proc2
                    monitor_process(proc2, task_id, "encode", encoded_dir, safe_name)
                
                if db_query("SELECT cancel_req FROM tasks WHERE id=?", (task_id,), one=True)['cancel_req'] == 1: raise Exception("Canceled")
                    
                shutil.rmtree(task_download_dir, ignore_errors=True)
                db_execute("UPDATE tasks SET status='কমপ্লিট হয়েছে', progress=? WHERE id=?", (f"১০০% প্রস্তুত ({applied_mode})", task_id))
                add_activity(f"'{project_name}' সফলভাবে শেষ হয়েছে ({applied_mode})।", "success")

        except Exception as e:
            if db_query("SELECT cancel_req FROM tasks WHERE id=?", (task_id,), one=True)['cancel_req'] == 1:
                db_execute("UPDATE tasks SET status='বাতিল করা হয়েছে' WHERE id=?", (task_id,))
                shutil.rmtree(task_download_dir, ignore_errors=True)
            else: 
                db_execute("UPDATE tasks SET status='সমস্যা হয়েছে' WHERE id=?", (task_id,))
                add_activity(f"'{project_name}' এ এরর: {e}", "danger")
        
        if task_id in active_processes: del active_processes[task_id]
        task_queue.task_done()

# ==========================================
# লাইভ স্ট্রিমিং ওয়ার্কার (with Auto-Delete)
# ==========================================
def live_stream_worker(project_name, stream_key, concat_file_path, auto_delete=False):
    log_file_path = os.path.abspath(f"projects/{project_name}/live_log.txt")
    if project_name in active_live_streams:
        active_live_streams[project_name]["log_file"] = log_file_path
        
    try:
        cmd = [
            "ffmpeg", "-re", "-f", "concat", "-safe", "0", 
            "-i", concat_file_path, 
            "-c", "copy", "-f", "flv", f"rtmp://a.rtmp.youtube.com/live2/{stream_key}"
        ]
        with open(log_file_path, "w") as log_f:
            proc = subprocess.Popen(cmd, stderr=log_f)
            if project_name in active_live_streams:
                active_live_streams[project_name]["process"] = proc
                active_live_streams[project_name]["status"] = "লাইভ চলছে..."
            proc.wait()
            
        add_activity(f"'{project_name}' এর লাইভ সম্পন্ন বা বন্ধ হয়েছে।", "info")
    except Exception as e: 
        add_activity(f"'{project_name}' এর লাইভে সমস্যা: {e}", "danger")
    finally:
        if project_name in active_live_streams: del active_live_streams[project_name]
        if os.path.exists(concat_file_path): os.remove(concat_file_path)
        
        if auto_delete:
            shutil.rmtree(f"projects/{project_name}", ignore_errors=True)
            db_execute("DELETE FROM tasks WHERE project=?", (project_name,))
            add_activity(f"লাইভ শেষে '{project_name}' অটোমেটিকভাবে ডিলিট করা হয়েছে 🗑️।", "warning")

init_db()
threading.Thread(target=worker, daemon=True).start()

# ==========================================
# ফ্লাস্ক রাউটস (Pages & APIs)
# ==========================================
@app.route("/", methods=["GET", "POST"])
def home():
    if request.method == "POST":
        link = request.form["link"]
        project = request.form.get("project", "Default_Project").strip()
        project = "".join(c for c in project if c.isalnum() or c in (' ', '_', '-')).replace(' ', '_')
        task_id = str(int(time.time()))
        log_path = f"logs/{task_id}.txt"
        
        db_execute("INSERT INTO tasks (id, type, project, link, status, progress, last_update, log_file, cancel_req) VALUES (?,?,?,?,?,?,?,?,?)",
                   (task_id, 'encode', project, link, "ওয়েটিং (অপেক্ষায় আছে)...", "অপেক্ষায়...", "N/A", log_path, 0))
        task_queue.put(task_id)
        add_activity(f"নতুন ভিডিও যুক্ত করা হয়েছে: '{project}'", "info")
        return redirect(url_for("home"))
    
    tasks = db_query("SELECT * FROM tasks WHERE type='encode' ORDER BY id DESC")
    return render_template("index.html", tasks=tasks)

@app.route("/live", methods=["GET", "POST"])
def live_page():
    project_files = {}
    if os.path.exists("projects"):
        for p in os.listdir("projects"):
            if os.path.isdir(os.path.join("projects", p)):
                encoded_dir = os.path.join("projects", p, "encoded")
                if os.path.exists(encoded_dir):
                    project_files[p] = sorted([f for f in os.listdir(encoded_dir) if f.endswith('.flv')])

    msg = ""
    if request.method == "POST":
        project = request.form["project"]
        stream_key = request.form["stream_key"]
        custom_playlist = request.form["playlist_text"]
        auto_delete = request.form.get("auto_delete") == "yes"
        
        if len(active_live_streams) >= MAX_LIVE_STREAMS:
            msg = f"ইতিমধ্যেই সর্বোচ্চ {MAX_LIVE_STREAMS}টি লাইভ চলছে!"
        elif project in active_live_streams:
            msg = f"'{project}' ইতিমধ্যেই লাইভে আছে!"
        elif not custom_playlist.strip():
            msg = "প্লেলিস্ট খালি রাখা যাবে না!"
        else:
            is_processing = db_query("SELECT id FROM tasks WHERE project=? AND status LIKE '%হচ্ছে%' LIMIT 1", (project,))
            if is_processing:
                msg = "এই প্রজেক্টের ভিডিও এখনো রেডি হচ্ছে!"
            else:
                lines = [line.strip() for line in custom_playlist.strip().split('\n') if line.strip()]
                total_duration_sec = len(lines) * 60 
                
                concat_file = os.path.abspath(f"projects/{project}/concat.txt")
                with open(concat_file, "w") as f:
                    for filename in lines:
                        f.write(f"file '{os.path.abspath(f'projects/{project}/encoded/{filename}')}'\n")
                
                active_live_streams[project] = {
                    "process": None, "status": "শুরু হচ্ছে...", 
                    "start_time": time.time(), "total_duration": total_duration_sec
                }
                add_activity(f"'{project}' এর লাইভ শুরু করা হয়েছে। (Auto-Delete: {'Yes' if auto_delete else 'No'})", "success")
                threading.Thread(target=live_stream_worker, args=(project, stream_key, concat_file, auto_delete), daemon=True).start()
                return redirect(url_for("live_page"))

    for p, info in active_live_streams.items():
        if info.get("total_duration") and info["status"] == "লাইভ চলছে...":
            elapsed = time.time() - info["start_time"]
            pct = min(100, int((elapsed / info["total_duration"]) * 100))
            info["progress_pct"] = pct
        else:
            info["progress_pct"] = 0

    return render_template("live.html", active_live_streams=active_live_streams, project_files=project_files, msg=msg, max_streams=MAX_LIVE_STREAMS)

@app.route("/manage", methods=["GET", "POST"])
def manage_page():
    msg = ""
    msg_type = "success"
    
    if request.method == "POST":
        action = request.form.get("action")
        project = request.form.get("project")
        
        is_live = project in active_live_streams
        is_processing = db_query("SELECT id FROM tasks WHERE project=? AND status LIKE '%হচ্ছে%' LIMIT 1", (project,))
        
        if is_live:
            msg = f"⚠️ '{project}' বর্তমানে লাইভে আছে! এটি এখন ডিলিট বা রিনেম করা যাবে না।"
            msg_type = "danger"
        elif is_processing:
            msg = f"⚠️ '{project}' এর কাজ ব্যাকগ্রাউন্ডে চলছে! আগে সেটি শেষ হতে দিন বা বাতিল করুন।"
            msg_type = "danger"
        else:
            if action == "delete":
                shutil.rmtree(f"projects/{project}", ignore_errors=True)
                db_execute("DELETE FROM tasks WHERE project=?", (project,))
                add_activity(f"'{project}' প্রজেক্টটি ডিলিট করা হয়েছে।", "warning")
                msg = f"'{project}' প্রজেক্টটি সফলভাবে ডিলিট হয়েছে।"
            elif action == "rename":
                new_name = request.form.get("new_name")
                new_name = "".join(c for c in new_name if c.isalnum() or c in (' ', '_', '-')).replace(' ', '_')
                if new_name and new_name != project:
                    if os.path.exists(f"projects/{new_name}"):
                        msg = f"⚠️ '{new_name}' নামের প্রজেক্ট আগে থেকেই আছে!"
                        msg_type = "danger"
                    else:
                        if os.path.exists(f"projects/{project}"):
                            os.rename(f"projects/{project}", f"projects/{new_name}")
                        db_execute("UPDATE tasks SET project=? WHERE project=?", (new_name, project))
                        add_activity(f"'{project}' এর নাম পরিবর্তন করে '{new_name}' রাখা হয়েছে।", "info")
                        msg = f"প্রজেক্টের নাম পরিবর্তন করে '{new_name}' রাখা হয়েছে।"

    projects = set()
    if os.path.exists("projects"):
        for p in os.listdir("projects"):
            if os.path.isdir(os.path.join("projects", p)): projects.add(p)
    db_projs = db_query("SELECT DISTINCT project FROM tasks")
    if db_projs:
        for row in db_projs: projects.add(row['project'])
        
    return render_template("manage.html", projects=sorted(list(projects)), msg=msg, msg_type=msg_type, active_live=active_live_streams.keys())

@app.route("/logs")
def logs_page():
    return render_template("logs.html")

@app.route("/api/sys_logs")
def api_sys_logs():
    activities = db_query("SELECT * FROM activities ORDER BY id DESC LIMIT 50")
    if not activities: activities = []
    
    live_logs_data = {}
    for p, info in active_live_streams.items():
        if "log_file" in info:
            live_logs_data[p] = read_tail(info["log_file"], 12)
            
    encode_logs_data = {}
    processing_tasks = db_query("SELECT project, log_file FROM tasks WHERE status LIKE '%হচ্ছে%'")
    if processing_tasks:
        for t in processing_tasks:
            if t['log_file']: encode_logs_data[t['project']] = read_tail(t['log_file'], 12)
            
    return jsonify({"activities": activities, "live_logs": live_logs_data, "encode_logs": encode_logs_data})

@app.route("/view_log/<task_id>")
def view_log(task_id):
    task = db_query("SELECT * FROM tasks WHERE id=?", (task_id,), one=True)
    if not task: return "Task not found"
    log_content = "লগ ফাইল পাওয়া যায়নি বা মুছে ফেলা হয়েছে।"
    if os.path.exists(task['log_file']):
        with open(task['log_file'], 'r') as f: log_content = f.read()
    return render_template("view_log.html", task=task, log_content=log_content)

@app.route("/cancel/<task_id>")
def cancel_task(task_id):
    task = db_query("SELECT project FROM tasks WHERE id=?", (task_id,), one=True)
    if task:
        db_execute("UPDATE tasks SET cancel_req=1 WHERE id=?", (task_id,))
        add_activity(f"'{task['project']}' এর কাজ বাতিল করা হয়েছে।", "warning")
        if task_id in active_processes:
            try: 
                active_processes[task_id].terminate()
                active_processes[task_id].kill()
            except: pass
    return redirect(url_for("home"))

@app.route("/cancel_live/<project_name>")
def cancel_live(project_name):
    if project_name in active_live_streams:
        add_activity(f"'{project_name}' এর লাইভ জোরপূর্বক বন্ধ করা হয়েছে।", "warning")
        proc = active_live_streams[project_name].get("process")
        if proc:
            try: 
                proc.terminate()
                proc.kill()
            except: pass
        del active_live_streams[project_name]
    return redirect(url_for("live_page"))

if __name__ == "__main__":
    os.makedirs("projects", exist_ok=True)
    os.makedirs("logs", exist_ok=True)
    # Railway বা Docker এর জন্য পোর্ট সেটআপ
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
