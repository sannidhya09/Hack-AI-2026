# Co Driver — AI Driving Partner

A real-time AI co-driver that monitors your driving, talks to you naturally,
detects fatigue and stress, warns about speed limits, and calls 911 if you crash.

## Architecture

```
ESP32-S3 (CoDriver WiFi hotspot @ 192.168.4.1)
    ↕ WebSocket (sensor data stream)
Phone Browser (React web app)
    ↕ HTTPS API calls over cellular
Python FastAPI Backend (Railway/Render)
    ├── Gemini 1.5 Flash (AI brain)
    ├── ElevenLabs Turbo v2 (voice)
    ├── Presage (face/emotion analysis)
    ├── Overpass API/OSM (speed limits, FREE)
    └── MongoDB Atlas (trip history + ML tips)
```

## Quick Start

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

Edit `backend/.env`:
```
GEMINI_API_KEY=your_key
ELEVENLABS_API_KEY=your_key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
MONGODB_URI=your_mongodb_atlas_uri
```

Run backend:
```bash
python main.py
```

### 2. Frontend Setup

```bash
cd frontend
npm install
```

Edit `frontend/.env`:
```
VITE_PRESAGE_API_KEY=your_presage_key
VITE_BACKEND_URL=http://localhost:8000
VITE_ESP32_WS=ws://192.168.4.1:81
```

Run frontend:
```bash
npm run dev
```

Open on phone: `http://YOUR_LAPTOP_IP:5173`

### 3. Hardware

Flash the Arduino code to ESP32-S3.
Connect phone to "CoDriver" WiFi (password: codriver123).
Open the web app in phone browser.

## Deploy to Railway (for demo)

1. Push to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Deploy `backend/` folder
4. Add environment variables in Railway dashboard
5. Update `VITE_BACKEND_URL` in frontend `.env` to your Railway URL
6. Deploy frontend too (or run locally)

## Features

- 🚗 Real-time speed monitoring with speed limit warnings (every 15s)
- 😴 Fatigue & stress detection via Presage + front camera
- 🤖 Natural AI conversation via Gemini 1.5 Flash
- 🔊 Human-quality voice via ElevenLabs Turbo v2
- 🚨 Crash detection with 5-second 911 countdown
- 🎵 Music search via voice command
- 📊 Trip summary report at end of journey
- 💡 ML-powered personalized driving tips
- 📡 Live sensor data from MPU6050 + INMP441 via ESP32-S3
- 🗺️ Free speed limits via OpenStreetMap (no billing required)

## Hardware Wiring

| Component | ESP32-S3 Pin |
|-----------|-------------|
| MPU6050 SDA | GPIO 8 |
| MPU6050 SCL | GPIO 9 |
| INMP441 SD | GPIO 4 |
| INMP441 WS | GPIO 5 |
| INMP441 SCK | GPIO 6 |
| All VCC | 3.3V rail |
| All GND | GND rail |
