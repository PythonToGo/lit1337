# 🔥 lit1337

**Leet Code Pusher**
Automatically push your solved LeetCode problems to GitHub and visualize your coding journey with a powerful dashboard\


---

## 🚀 What is this?

`lit1337` is an all-in-one platform for tracking your LeetCode progress:

- 🧩 **Chrome Extension:** Push your accepted solutions directly to GitHub.
- 🔐 **FastAPI Backend:** Handle GitHub OAuth, push logic, and authentication.
- 📊 **Web Dashboard:** Visualize your problem-solving progress with lists, charts, rankings, and weekly challenges.

---

## ✨ Features

### 🧠 Chrome Extension
- Detects accepted LeetCode submissions.
- Auto-generates filenames like `0123_Two_Sum.py`.
- Pushes code to GitHub using JWT-secured FastAPI backend.

### ⚡ Backend (FastAPI)
- GitHub OAuth login.
- JWT-based authentication for users.
- Receives & saves pushed code.
- Currently uses SQLite for development.
- **Future-ready:** Will support Docker deployment and PostgreSQL for scalable, production-level multi-user environments.

### 🌐 Web Dashboard
- ✅ List of solved problems.
- 📈 Weekly/monthly problem-solving charts.
- 🏆 Ranking system (see who's solving the most problems).
- 🎯 Weekly challenge & leaderboard.
- 🔗 Click on a problem to jump to its corresponding GitHub file.

---

## 📁 Project Structure

```txt
lit1337/
├── backend/           # FastAPI server (auth, push API, DB)
├── pusher/            # Chrome extension (content + popup)
├── web-dashboard/     # Frontend dashboard (React or other)
├── .gitignore
└── README.md
```

## ⚙️ Getting Started

### 1. Backend (FastAPI)
```
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

- Update your .env with your GitHub OAuth Client ID and Secret.
- Current DB: Uses SQLite for local development.
- Future Deployment: Ready for Docker & PostgreSQL for a scalable, multi-user environment.

### 2. Chrome Extension
1. Go to chrome://extensions
2. Enable Developer Mode
3. Click Load Unpacked and select the pusher/ directory.
4. Login via the popup and start pushing your LeetCode solutions to GitHub!

### 3. Web Dashboard (Coming Soon)
```
cd web-dashboard
npm install
npm run dev
```

## 🛠️ Tech Stack

Layer	| Tech
Frontend |	React (or Next.js), HTML 
Extension |	Vanilla JS, Manifest V3 
Backend |	FastAPI, OAuth2, JWT, SQLAlchemy 
Database |	SQLite (development), PostgreSQL (prod) 
Deployment |	Docker (future), Render/Vercel 


## 🧪 To-Do

 -Implement OAuth for individual users.
 -Develop a full-featured dashboard with filters and shareable stats.
 -Add public profiles for users.
 -Implement a real-time leaderboard.
 -Create a weekly challenge system.
 -Add an extension settings panel for auto-push and other options.

## 📄 License

MIT License with additional restrictions:

- Commercial use is prohibited
- Modification, adaptation, or creation of derivative works is prohibited
- Redistribution in any form is prohibited
- The software may only be used for personal, non-commercial purposes

## 🙌 Contributing

PRs and suggestions are welcome.
Make LeetCode more fun and more lit.
Let's build lit1337 together!

From 💻 Leet to 🔥 Lit.
