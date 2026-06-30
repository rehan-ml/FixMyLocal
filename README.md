# 🏙️ FixMyLocal — AI-Powered Hyperlocal Civic Issue Reporter

> Built for **Vibe2Ship Hackathon** by Coding Ninjas × Google for Developers
> Problem Statement 2: Community Hero – Hyperlocal Problem Solver

🔗 **Live App:** [https://fixmylocal-164988193935.asia-south1.run.app](https://fixmylocal-164988193935.asia-south1.run.app)

---

## 🎯 What is FixMyLocal?

FixMyLocal is a civic engagement platform that lets citizens report local infrastructure problems — potholes, broken streetlights, water leaks, garbage overflow, and more — with a simple photo upload. Google's Gemini AI instantly analyzes the report, categorizes it, assesses severity, detects spam, and routes it to the correct government department. The community can verify reports, track resolution status in real time, and even auto-escalate urgent issues with AI-generated official complaint letters.

## ✨ Key Features

- 📸 **Photo-based issue reporting** with GPS auto-location
- 🤖 **Gemini AI vision analysis** — categorizes issues, detects spam/irrelevant images, assigns severity & routing department
- 🗺️ **Live interactive map** with clustering, search-by-city, and nearby-reports detection
- 👥 **Community verification** — upvote/downvote system with True/False report marking
- 🚨 **AI auto-escalation** — issues with high community votes auto-escalate to URGENT priority
- 📝 **AI-generated complaint letters** — editable, official letters ready to send to authorities
- 💬 **AI chatbot assistant** — ask questions about civic data, get instant answers from Gemini
- 📊 **AI City Reports** — one-click AI-generated infrastructure analysis reports
- 🏆 **Leaderboard** — gamified community contribution tracking
- 🔐 **Full authentication system** — signup, login, forgot password, profile editing, account deletion
- 🌗 **Dark/Light mode toggle**
- 📱 **Fully responsive** — mobile-first design

## 🛠️ Technologies Used

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js, Express.js |
| Database & Auth | Firebase Firestore, Firebase Authentication |
| AI | Google Gemini API (gemini-3.1-flash-lite) — vision analysis, chat, report generation |
| Maps | Leaflet.js + CartoDB tiles, Nominatim Geocoding |
| Image Hosting | ImgBB API |
| Deployment | Google Cloud Run (Docker container) |

## 🤖 Google Technologies Utilized

- **Gemini API** — image-based spam detection, issue categorization, severity scoring, department routing, AI chatbot, AI complaint letter generation, AI city reports
- **Firebase Firestore** — real-time database for issues and user profiles
- **Firebase Authentication** — secure email/password auth with verification & password reset
- **Google Cloud Run** — containerized deployment of the full-stack application

## 🚀 How It Works

1. **Report** — User uploads a photo, selects category, adds description and location
2. **AI Analyzes** — Gemini Vision checks if it's a real civic issue, categorizes it, assigns severity & routes to the correct department
3. **Community Verifies** — Other citizens upvote/downvote to confirm the issue's validity
4. **Auto-Escalation** — High-vote issues automatically escalate to urgent priority with an AI-generated complaint letter ready to send
5. **Track & Resolve** — Reporters can update status as the issue moves from Open → In Progress → Resolved

## 📂 Project Structure

FixMyLocal/

├── index.html          # Main app structure

├── style.css           # Design system & styling

├── app.js              # Core frontend logic

├── firebase-init.js    # Firebase configuration

├── config.js           # Frontend config

├── server.js           # Express backend — Gemini API proxy

├── package.json

├── Dockerfile

├── images/              # App assets & avatars

## 🏃 Running Locally

```bash
npm install
node server.js
```

Visit `http://localhost:8080`

## 👨‍💻 Built By

Rehan Raza — B.Tech CSE (AI/ML)
