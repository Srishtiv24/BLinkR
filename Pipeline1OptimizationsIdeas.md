# BLinkr Pipeline 1: Human-to-Human Mock Interview Optimization

This document outlines the strategic, architectural, and feature-level optimizations required to upgrade BLinkr's Pipeline 1 from a simple video-calling room to a fully structured, professional interview platform. The focus is strictly on the human-to-human live mock interview pipeline.

---

## 1. Core Architectural Shifts

### 1.1 Proper "Interview Session" Model
Move away from identifying meetings solely by a meeting code. The backend must introduce a robust `InterviewSession` concept.

**Workflow:**
`Resume` → `Question Generation` → `Interview Session Created` → `Shareable Link`

**Proposed Data Model:**
```text
InterviewSession
│
├── sessionId (Unique identifier)
├── meetingCode (For joining URLs)
├── host/interviewer (User ID)
├── candidate (User ID)
├── resumeId (Reference to parsed resume)
├── questions[] (Generated & custom questions)
├── startTime / endTime / duration
├── status (SCHEDULED, WAITING, IN_PROGRESS, COMPLETED, ABANDONED)
├── participants (Max 2)
├── messages (Chat history tied to session)
├── feedback (Structured post-interview data)
└── metadata
```

### 1.2 Separation of State: DB vs. Real-time
Separate persistent data from real-time WebRTC/Socket state.
*   **MongoDB (Persistent):** InterviewSession, Questions, Participants, Feedback, Metadata.
*   **Socket.IO/WebRTC (Volatile):** Connected users, typing status, offer/answer, ICE candidates, screen share state, live connection status.

---

## 2. Access Control & Security

### 2.1 Enforce Participant Limits
Explicitly enforce a **2-person limit** (`MAX_PARTICIPANTS = 2`) on the server/Socket.IO level, not just the frontend. If a third person attempts to join, the server must reject the connection with an "Interview room is full" error.

### 2.2 Role-Based Access (Candidate vs. Interviewer)
Do not trust roles strictly from the frontend. Verify permissions on the backend:
*   When a user joins `blinkr.com/interview/ABC123`, the backend checks `sessionId`, `candidateId`, and `interviewerId` to assign the correct UI and permissions.

### 2.3 Secure & Expiring Links
*   Use sufficiently random room/session identifiers (e.g., UUIDs), not sequential or easily guessable IDs.
*   Implement link expiry (e.g., 24 hours, or immediately upon interview completion).

---

## 3. Pre-Interview & Setup Experience

### 3.1 Pre-Interview Device Check
Force a hardware check before entering the main room to prevent WebRTC issues.
*   Check Camera, Microphone, Speaker, and Internet connection.
*   Show a `[Join Interview]` button only when checks pass.

### 3.2 Waiting Room
Improve UX when participants join at different times.
*   If the candidate joins first: Show camera preview and a "Waiting for interviewer..." state.
*   If the interviewer joins: Notify them that the candidate is waiting in the lobby.

### 3.3 Session Configuration
Allow configuration during interview creation:
*   **Number of questions:** 5 / 10 / 15
*   **Duration:** 30 / 45 / 60 min
*(Keep it simple for Phase 1; expand to Difficulty and Focus areas later).*

---

## 4. In-Interview Experience

### 4.1 Interviewer Dashboard & Question Tracking
Integrate generated questions into an interactive sidebar for the interviewer.

**Features:**
*   Mark questions as: `Asked`, `Not asked`, `Skipped`.
*   Navigate: Next, Previous, Skip.
*   Categorize: Introduction, Technical, Projects, Behavioral.

### 4.2 WebRTC & Connection Reliability
*   **Connection State Handling:** UI must clearly show states: `Connected`, `Reconnecting...`, `Disconnected`.
*   **Reconnection Logic:** Essential for temporary drops (e.g., switching WiFi to hotspot). Implement automatic reconnection without ending the interview.
*   **Page Refresh Recovery:** Re-joining should instantly restore the user to the `same sessionId`, `same room`, and `same questions` based on DB state.
*   **Network Quality Indicator:** Display a simple visual indicator (Good/Poor) derived from WebRTC stats (packet loss, RTT).

### 4.3 Screen Sharing & Media Management
*   Provide distinct UI states for Camera Video vs. Screen Share.
*   Handle external screen-share termination gracefully (e.g., browser-level "Stop Sharing" button).

### 4.4 Server-Authoritative Timer
Display a live timer (e.g., `00:27:42`). Calculate duration using the server's `startedAt` timestamp to prevent manipulation or sync issues on page refresh.

### 4.5 Contextual Chat
Treat chat messages as part of the `InterviewSession` schema, not a standalone Socket conversation, enabling future chat history reviews.

---

## 5. Post-Interview & History

### 5.1 Explicit Completion
Implement an `[End Interview]` button with a confirmation dialog. This officially updates the backend status to `COMPLETED`, calculates total duration, and redirects users to a summary page.

### 5.2 Interview Feedback Form
Provide a concise feedback form for the interviewer immediately after the session.
*   **Ratings (1-5):** Technical Skills, Communication, Problem Solving, Overall.
*   **Text fields:** Strengths, Areas for Improvement.

### 5.3 Redesigned History & Summary
Transition from a "meeting log" to a proper "Interview History".
*   **Store (Must):** Session IDs, participants, timestamps, duration, status, questions asked.
*   **Store (Highly Useful):** Interviewer ratings, strengths, improvements, specific question feedback.
*   **Summary Page:** Display completion status, duration, rating, and feedback immediately after the session ends.

### 5.4 Analytics (Future Scope)
Use stored structured data to build candidate progress tracking (e.g., average duration, recurring weak areas, technical skill growth over time).

---

## 6. Implementation Priority Roadmap

### 🔴 P0 — Foundation (Do These First)
- [ ] Explicit 2-person room limit (Server-side)
- [ ] Candidate/Interviewer roles and permissions
- [ ] Proper `InterviewSession` database model
- [ ] Resume-generated questions inside the interviewer panel
- [ ] Question tracking (asked/unasked/skipped)
- [ ] Question count & duration limit configuration
- [ ] Explicit interview start/end and server-calculated duration
- [ ] Proper interview status lifecycle (Scheduled, In Progress, Completed, etc.)
- [ ] Post-interview feedback form
- [ ] History page redesign based on structured session data

### 🟠 P1 — Reliability & UX (Do These Next)
- [ ] WebRTC automatic reconnection handling
- [ ] Live connection status indicators
- [ ] Camera/mic pre-check screen
- [ ] Waiting room functionality
- [ ] Browser refresh recovery (State persistence)
- [ ] Screen-share lifecycle handling
- [ ] Server-authoritative timer in UI
- [ ] Secure/random + expiring interview links

### 🟡 P2 — Polish (Future Features)
- [ ] Detailed Interview Summary page
- [ ] Persistent chat history viewing
- [ ] Interview analytics (Progress over multiple interviews)
- [ ] Repeated weak-area tracking
- [ ] Custom interviewer questions during the session
- [ ] Interview templates/settings

**Golden Rule for Pipeline 1:** Do not add more features just for the sake of making the app look bigger. Focus on turning the existing video call functionality into a structured, reliable, and measurable interview experience. Once this foundation is solid, Pipeline 2 (AI Interviewer) can seamlessly plug into this exact same architecture.