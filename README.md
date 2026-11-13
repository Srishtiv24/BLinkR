# BLinkR — Smart Mock Interview Practice Platform

BLinkR is a web-based mock interview platform designed to help
candidates practise interviews in a more realistic and interactive
environment. Users can practise with an AI interviewer or connect with
another person, communicate in real time, and use AI-assisted features
to prepare for interviews.

**Live Demo:** https://blinkr-teal.vercel.app

---

## Features

- **AI-powered mock interviews:** Practise with a real-time voice AI
  interviewer. Questions are tailored from your resume and chosen role,
  experience level, and difficulty.
- **Live audio and video:** Real-time interview sessions with WebRTC.
- **Peer interviews:** Share a meeting link and practise with a friend
  or another participant.
- **Real-time communication:** In-session chat and screen sharing.
- **Authentication:** Google sign-in through Auth0 and local
  email/password accounts, with JWT-based protection for backend routes.
- **Resume upload and parsing:** Upload a resume so the AI can generate
  relevant interview questions from your experience.
- **AI-assisted question generation:** Uses Google Gemini to produce
  interview questions from a resume.
- **Interview feedback:** After each AI interview, the agent scores your
  performance across categories (Technical Knowledge, Communication,
  Problem Solving, and more) and provides an improvement plan.
- **Interview history:** Every AI and peer interview is recorded so you
  can review past sessions.
- **Password reset:** Forgot-password flow via email (Nodemailer).

> Feature availability may vary as the project evolves.

---

## Tech Stack

| Area | Technologies |
|---|---|
| Frontend | React, Vite, Material UI |
| Backend | Node.js, Express.js |
| Database | MongoDB (Mongoose) |
| Authentication | Auth0, JWT |
| Real-time communication | WebRTC, Socket.IO |
| AI — question generation | Google Gemini |
| AI — voice interview pipeline | Python, LiveKit, Google/Gemini STT, LLM, ElevenLabs TTS, Deepgram |
| Email | Nodemailer (Gmail) |

---

## How It Works

1. **Sign in** using Google (Auth0) or create a local account.
2. **Upload your resume** so questions can be tailored to your experience.
3. **Choose your interview type:**
   - **AI interview** — the voice agent asks and evaluates you in real time.
   - **Peer interview** — share a link and practise with another person.
4. **Join the session** using the live audio/video experience.
5. **End the interview** — the AI agent generates a score and improvement
   plan which is saved to your history.
6. **Review past interviews** from the history page.

---

## Project Structure

```text
BLinkR/
├── Frontend/           # React + Vite application
└── Backend/            # Node.js + Express API
    └── ai-agent/       # Python LiveKit voice-interview agent
```

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- MongoDB (local instance or a MongoDB Atlas connection string)
- Python 3.10+ (for the voice-agent)
- Git

### 1. Clone the repository

```bash
git clone https://github.com/Srishtiv24/BLinkR.git
cd BLinkR
```

### 2. Set up the backend

```bash
cd Backend
npm install
```

Create a `.env` file in the `Backend/` directory:

```env
# MongoDB
ATLAS_DB_URL=your_mongodb_connection_string

# JWT
JWT_SECRET_KEY=your_jwt_secret
JWT_SECRET_KEY2=your_second_jwt_secret

# Auth0
AUTH0_DOMAIN=your_auth0_domain
AUTH0_CLIENT_ID=your_auth0_client_id
AUTH0_CLIENT_SECRET=your_auth0_client_secret

# Email (Nodemailer via Gmail app password)
GMAIL_APP_USER=your_gmail_address
GMAIL_APP_PASS=your_gmail_app_password

# LiveKit
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

# AI / LLM
GOOGLE_API_Key=your_google_gemini_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
KILO_API_KEY=your_kilo_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

# Misc
NODE_ENV=development
BACKEND_DEPLOY=http://localhost:8000
```

Start the backend:

```bash
npm run dev
```

The server starts on port `8000` by default.

### 3. Set up the frontend

Open a new terminal from the repo root:

```bash
cd Frontend
npm install
```

Create a `.env` file in the `Frontend/` directory:

```env
VITE_AUTH0_DOMAIN=your_auth0_domain
VITE_AUTH0_CLIENT_ID=your_auth0_client_id
VITE_APP_AUTH0_CLIENT_SECRET=your_auth0_client_secret
BACKEND_DEPLOY=http://localhost:8000
```

Start the frontend:

```bash
npm run dev
```

The app opens at `http://localhost:5173` by default.

### 4. Set up the voice agent

The voice-interview agent is a standalone Python process that must run
alongside the backend. It lives in `Backend/ai-agent/`.

Install its dependencies:

```bash
pip install "livekit-agents[google,silero,elevenlabs,openai]" python-dotenv openai
```

Create a `.env` file in `Backend/ai-agent/` (or export the variables)
with the LiveKit, Google, ElevenLabs, and Kilo credentials:

```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
GOOGLE_API_KEY=your_google_gemini_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
KILO_API_KEY=your_kilo_api_key
```

Run the agent:

```bash
cd Backend/ai-agent
python interview_agent.py dev
```

Use `start` instead of `dev` in production.

---

## Environment Variables and Security

- Use the **exact variable names** shown above — the application code
  references them directly.
- Never commit `.env` files. Add them to `.gitignore`.
- Configure Auth0's **Allowed Callback URLs**, **Allowed Logout URLs**,
  and **Allowed Web Origins** for both `http://localhost:5173` and your
  deployed frontend URL.
- Set the Auth0 API audience to match the backend configuration.
- Use HTTPS and secure cookie settings in production.

---

## AI Voice Interview Flow

```text
Candidate's microphone
       |
       v
Speech-to-Text  (Google / Gemini / Deepgram)
       |
       v
Language Model  (Gemini — with OpenRouter / Kilo fallbacks)
       |
       v
Text-to-Speech  (ElevenLabs)
       |
       v
AI Interviewer's voice → LiveKit room → candidate's speaker
```

After the interview ends, the agent generates a structured feedback
report (overall score, category scores, improvement plan) and sends it
back to the frontend via the LiveKit data channel. The frontend then
posts it to the backend where it is validated and saved to MongoDB.

---

## Future Improvements

- Weak-topic tracking across multiple sessions.
- Better question variation to reduce repetition.
- A coding environment for technical interviews.
- Detailed progress charts and trend analytics.
- Adaptive question difficulty based on performance history.

---

## Contributing

Contributions, suggestions, and bug reports are welcome.

1. Fork the repository.
2. Create a branch for your change.
3. Make and test your changes.
4. Open a pull request with a clear description of the update.

---

## Author

**Srishti Verma**

- GitHub: [@Srishtiv24](https://github.com/Srishtiv24)

---

## License

Add a license to this repository if you intend to distribute or reuse
the project. Until a license is added, the repository's default
copyright terms apply.
