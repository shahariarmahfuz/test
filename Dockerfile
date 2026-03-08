# পাইথনের হালকা ভার্সন (Slim)
FROM python:3.9-slim

# লিনাক্সে FFmpeg ইন্সটল করা হচ্ছে
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# কাজের ফোল্ডার সেট করা হচ্ছে
WORKDIR /app

# রিকোয়ারমেন্টস কপি ও ইন্সটল
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# প্রজেক্টের সব ফাইল (app.py, templates ফোল্ডার ইত্যাদি) কপি করা হচ্ছে
COPY . .

# Railway বা Docker এর জন্য ফ্লাস্ক অ্যাপ চালু করা হচ্ছে
CMD ["python3", "app.py"]
