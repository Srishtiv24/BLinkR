import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  createLocalVideoTrack,
} from "livekit-client";
import axios from "axios";
import "../styles/AIInterviewer.css";
import server from "../enviornment"; // adjust relative path to match where environment.js actually sits

const initials = (name) =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

// ---- Icons (inline SVG, stroke-based, no external icon library needed) ----
const MicIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
);

const MicOffIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" y1="2" x2="22" y2="22" />
    <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
    <path d="M5 10v2a7 7 0 0 0 12 5" />
    <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
);

const PhoneOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 4.03.64 2 2 0 0 1 2 2v3.5a2 2 0 0 1-2 2 19 19 0 0 1-8.63-2.98 19.5 19.5 0 0 1-6-6 19 19 0 0 1-3-8.63 2 2 0 0 1 2-2H8.5a2 2 0 0 1 2 2 12.84 12.84 0 0 0 .64 4.03 2 2 0 0 1-.45 2.11z" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const TrendUpIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const TargetIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

// ---- Feedback scoring helpers ----
const scoreBand = (score) => {
  if (score == null) return "unknown";
  if (score >= 7.5) return "strong";
  if (score >= 5) return "medium";
  return "weak";
};

const bandColor = { strong: "#4ade80", medium: "#fbbf24", weak: "#f87171", unknown: "#71717a" };
const bandLabel = { strong: "Strong", medium: "Good", weak: "Needs Work", unknown: "—" };

const overallBand = (score) => {
  if (score == null) return "unknown";
  if (score >= 75) return "strong";
  if (score >= 50) return "medium";
  return "weak";
};

// ---- Radar chart: shows the "shape" of strengths/weaknesses at a glance ----
const RadarChart = ({ categories }) => {
  const size = 280;
  const center = size / 2;
  const maxR = size / 2 - 46; // leave room for axis labels
  const n = categories.length;
  if (n < 3) return null; // a radar chart needs at least 3 axes to make visual sense

  const angleFor = (i) => (-90 + (360 / n) * i) * (Math.PI / 180);

  const pointAt = (i, value) => {
    const angle = angleFor(i);
    const r = (value / 10) * maxR;
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
  };

  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const dataPoints = categories.map((c, i) => pointAt(i, c.score || 0));
  const dataPath = dataPoints.map((p) => p.join(",")).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="radar-svg">
      {/* background grid rings */}
      {gridLevels.map((level, gi) => {
        const ringPts = categories
          .map((_, i) => pointAt(i, level * 10).join(","))
          .join(" ");
        return (
          <polygon
            key={gi}
            points={ringPts}
            fill="none"
            stroke="#26262f"
            strokeWidth="1"
          />
        );
      })}

      {/* axis lines + labels */}
      {categories.map((c, i) => {
        const [x, y] = pointAt(i, 10);
        const [lx, ly] = pointAt(i, 12.2); // push labels slightly beyond the outer ring
        return (
          <g key={i}>
            <line x1={center} y1={center} x2={x} y2={y} stroke="#26262f" strokeWidth="1" />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              className="radar-axis-label"
            >
              {c.name}
            </text>
          </g>
        );
      })}

      {/* the actual data shape */}
      <polygon points={dataPath} fill="rgba(139, 92, 246, 0.25)" stroke="#8b5cf6" strokeWidth="2" />
      {dataPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill={bandColor[scoreBand(categories[i].score)]} />
      ))}
    </svg>
  );
};

const BotIcon = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="8" width="16" height="12" rx="3" />
    <circle cx="9" cy="14" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="14" r="1.2" fill="currentColor" stroke="none" />
    <path d="M12 8V4" />
    <circle cx="12" cy="3" r="1" fill="currentColor" stroke="none" />
    <path d="M4 13H2" />
    <path d="M22 13h-2" />
  </svg>
);

const AIInterviewer = ({ candidateName: propName, role: propRole, onEnd }) => {
  const navigate = useNavigate();
  const [started, setStarted] = useState(!!propName);
  const [candidateName, setCandidateName] = useState(propName || "");
  const [role, setRole] = useState(propRole || "");
  const [interviewType, setInterviewType] = useState("Technical");
  const [experienceLevel, setExperienceLevel] = useState("Mid-level");
  const [focusAreas, setFocusAreas] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [status, setStatus] = useState("connecting"); // connecting | live | ended
  const [messages, setMessages] = useState([]); // {sender, text, time}
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [errorBanner, setErrorBanner] = useState(null);
  const [feedbackState, setFeedbackState] = useState("none"); // none | loading | ready | error
  const [feedbackErrorReason, setFeedbackErrorReason] = useState("timeout"); // timeout | failed
  const [feedback, setFeedback] = useState(null);

  const roomRef = useRef(null);
  const audioElRef = useRef(null);
  const localVideoElRef = useRef(null);
  const localTrackRef = useRef(null);
  const localVideoTrackRef = useRef(null);
  const connectedOnceRef = useRef(false);

  const pushMessage = useCallback((sender, text) => {
    setMessages((prev) => [
      ...prev,
      { sender, text, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
    ]);
  }, []);

  useEffect(() => {
    if (!started) return;
    if (connectedOnceRef.current) return;
    connectedOnceRef.current = true;
    let room;

    const connect = async () => {
      try {
        const authToken = localStorage.getItem("token");
        const { data } = await axios.post(
          `${server}/api/interview/token`,
          { candidateName, role, interviewType, experienceLevel, focusAreas, difficulty },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );

        room = new Room();
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            track.attach(audioElRef.current);
            setAgentSpeaking(true);
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            track.detach();
            setAgentSpeaking(false);
          }
        });

        room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
          segments.forEach((seg) => {
            if (!seg.final) return;
            const isYou = !(participant?.isAgent || participant?.identity?.includes("agent"));
            pushMessage(isYou ? "You" : "BlinkR AI", seg.text);
          });
        });

        room.on(RoomEvent.DataReceived, (payload) => {
          try {
            const msg = JSON.parse(new TextDecoder().decode(payload));
            console.log("[AIInterviewer] data received:", msg.type);
            if (msg.type === "interview_error") {
              setErrorBanner(msg.message);
            } else if (msg.type === "interview_feedback") {
              setFeedback(msg.data);
              setFeedbackState("ready");
            } else if (msg.type === "interview_feedback_error") {
              setFeedbackErrorReason("failed");
              setFeedbackState("error");
            }
          } catch {
            // ignore malformed/unrelated data messages
          }
        });

        room.on(RoomEvent.Disconnected, () => {
          setStatus("ended");
        });

        await room.connect(data.url, data.token);
        setStatus("live");

        const micTrack = await createLocalAudioTrack();
        localTrackRef.current = micTrack;
        await room.localParticipant.publishTrack(micTrack);

        try {
          const videoTrack = await createLocalVideoTrack();
          localVideoTrackRef.current = videoTrack;
          if (localVideoElRef.current) {
            videoTrack.attach(localVideoElRef.current);
          }
          await room.localParticipant.publishTrack(videoTrack);
        } catch (camErr) {
          // Camera may be unavailable/denied — interview still works audio-only.
          console.warn("Camera unavailable, continuing audio-only:", camErr);
        }
      } catch (err) {
        console.error("Failed to start interview:", err);
        setStatus("ended");
      }
    };

    connect();

    return () => {
      localTrackRef.current?.stop();
      localVideoTrackRef.current?.stop();
      roomRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, candidateName, role, interviewType, experienceLevel, focusAreas, difficulty]);

  const toggleMute = () => {
    if (!roomRef.current) return;
    const next = !muted;
    roomRef.current.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  };

  const disconnectNow = async () => {
    localTrackRef.current?.stop();
    localVideoTrackRef.current?.stop();
    await roomRef.current?.disconnect();
    setStatus("ended");
    onEnd?.(messages);
  };

  const endInterview = async () => {
    if (roomRef.current && status === "live") {
      setFeedbackState("loading");
      try {
        console.log("[AIInterviewer] sending request_feedback...");
        await roomRef.current.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify({ type: "request_feedback" })),
          { reliable: true }
        );
        console.log("[AIInterviewer] request_feedback sent successfully");
      } catch (e) {
        console.error("Failed to request feedback:", e);
        setFeedbackErrorReason("failed");
        setFeedbackState("error");
        return;
      }

      // Safety net: if the agent doesn't respond within 60s (real-world
      // round trip includes the agent finishing its current speech, then
      // calling out to Kilo Gateway), show a "taking longer than expected"
      // state — but keep the room connected in the background rather than
      // disconnecting, so a late-but-successful response can still arrive
      // and update the screen instead of being silently dropped.
      setTimeout(() => {
        setFeedbackState((current) => {
          if (current === "loading") {
            console.warn("[AIInterviewer] feedback request taking longer than expected (60s)");
            setFeedbackErrorReason("timeout");
            return "error";
          }
          return current;
        });
      }, 60000);
    } else {
      await disconnectNow();
    }
  };

  useEffect(() => {
    if (feedbackState === "ready") {
      disconnectNow();
    }
    // Deliberately NOT disconnecting on "error" — a late response might
    // still arrive and flip this back to "ready" (see DataReceived handler).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedbackState]);

  const skipFeedback = async () => {
    await disconnectNow();
    navigate("/home");
  };

  const goHome = async () => {
    if (roomRef.current && status === "live") {
      await disconnectNow();
    }
    navigate("/home");
  };

  // ---- Feedback: loading ----
  if (feedbackState === "loading") {
    return (
      <div className="ai-interview-container">
        <button className="floating-back-btn" onClick={goHome} aria-label="Back to home">
          <BackIcon />
        </button>
        <div className="feedback-status-panel">
          <div className="feedback-spinner" />
          <h2>Generating your feedback...</h2>
          <p className="setup-sub">This usually takes a few seconds.</p>
          <button className="skip-btn" onClick={skipFeedback}>
            Skip & Close
          </button>
        </div>
      </div>
    );
  }

  // ---- Feedback: failed ----
  if (feedbackState === "error") {
    return (
      <div className="ai-interview-container">
        <button className="floating-back-btn" onClick={goHome} aria-label="Back to home">
          <BackIcon />
        </button>
        <div className="feedback-status-panel">
          {feedbackErrorReason === "timeout" ? (
            <>
              <h2>This is taking longer than expected</h2>
              <p className="setup-sub">
                Your feedback may still arrive in a moment. You can wait here, or head
                back to home and check again later.
              </p>
            </>
          ) : (
            <>
              <h2>Couldn't generate feedback</h2>
              <p className="setup-sub">
                Something went wrong generating your feedback. Your interview has ended.
              </p>
            </>
          )}
          <button className="start-btn" onClick={goHome}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ---- Feedback: ready ----
  if (feedbackState === "ready" && feedback) {
    const overall = typeof feedback.overall_score === "number" ? feedback.overall_score : null;
    const categories = Array.isArray(feedback.categories) ? feedback.categories : [];
    const circumference = 2 * Math.PI * 54;
    const filled = overall != null ? (overall / 100) * circumference : 0;
    const oBand = overallBand(overall);

    const rankedCategories = [...categories]
      .filter((c) => typeof c.score === "number")
      .sort((a, b) => b.score - a.score);
    const strongest = rankedCategories[0];
    const weakest = rankedCategories[rankedCategories.length - 1];
    const showCallouts = strongest && weakest && strongest.name !== weakest.name;

    return (
      <div className="ai-interview-container feedback-screen">
        <div className="ai-interview-header">
          <button className="back-btn" onClick={goHome} aria-label="Back to home">
            <BackIcon />
            <span>Home</span>
          </button>
          <span className="status-pill ended">
            <span className="status-dot" />
            Interview complete
          </span>
          <div className="header-spacer" />
        </div>

        <div className="feedback-body">
          <div className="feedback-score-card">
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="54" fill="none" stroke="#26262f" strokeWidth="12" />
              {overall != null && (
                <circle
                  cx="70"
                  cy="70"
                  r="54"
                  fill="none"
                  stroke={bandColor[oBand]}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${filled} ${circumference}`}
                  transform="rotate(-90 70 70)"
                />
              )}
              <text x="70" y="66" textAnchor="middle" className="donut-score">
                {overall != null ? overall : "—"}
              </text>
              <text x="70" y="86" textAnchor="middle" className="donut-label">
                / 100
              </text>
            </svg>
            {overall != null && (
              <span className={`overall-band-chip band-${oBand}`}>
                {oBand === "strong" && "Strong Performance"}
                {oBand === "medium" && "Good, Room to Grow"}
                {oBand === "weak" && "Needs Improvement"}
              </span>
            )}
            <p className="feedback-summary">{feedback.summary}</p>
          </div>

          {showCallouts && (
            <div className="callout-row">
              <div className="callout-card callout-strong">
                <div className="callout-icon"><TrendUpIcon /></div>
                <div>
                  <p className="callout-label">Your strongest area</p>
                  <p className="callout-name">{strongest.name}</p>
                  <p className="callout-score">{strongest.score}/10</p>
                </div>
              </div>
              <div className="callout-card callout-weak">
                <div className="callout-icon"><TargetIcon /></div>
                <div>
                  <p className="callout-label">Focus here next</p>
                  <p className="callout-name">{weakest.name}</p>
                  <p className="callout-score">{weakest.score}/10</p>
                </div>
              </div>
            </div>
          )}

          {categories.length >= 3 && (
            <div className="feedback-radar-card">
              <h3>Your Skills Profile</h3>
              <p className="setup-sub radar-sub">
                The bigger the shape, the stronger the area — a quick visual of where you
                shine and where to focus.
              </p>
              <div className="radar-wrap">
                <RadarChart categories={categories} />
              </div>
              <div className="radar-legend">
                <span><i style={{ background: bandColor.strong }} /> Strong (7.5+)</span>
                <span><i style={{ background: bandColor.medium }} /> Good (5-7.4)</span>
                <span><i style={{ background: bandColor.weak }} /> Needs Work (&lt;5)</span>
              </div>
            </div>
          )}

          <div className="feedback-categories-card">
            <h3>Breakdown by category</h3>
            {categories.length === 0 && (
              <p className="setup-sub">No category breakdown available.</p>
            )}
            {categories.map((cat, i) => {
              const band = scoreBand(cat.score);
              return (
                <div className="category-row" key={i}>
                  <div className="category-row-top">
                    <span className="category-name">{cat.name}</span>
                    <span className={`category-chip chip-${band}`}>{bandLabel[band]}</span>
                    <span className="category-score">{cat.score}/10</span>
                  </div>
                  <div className="category-bar-track">
                    <div
                      className="category-bar-fill"
                      style={{
                        width: `${Math.max(0, Math.min(10, cat.score || 0)) * 10}%`,
                        background: bandColor[band],
                      }}
                    />
                  </div>
                  {cat.comment && <p className="category-comment">{cat.comment}</p>}
                </div>
              );
            })}
          </div>

          {(feedback.strengths?.length > 0 || feedback.improvements?.length > 0) && (
            <div className="feedback-lists-card">
              {feedback.strengths?.length > 0 && (
                <div className="feedback-list-col">
                  <h4>Strengths</h4>
                  <ul>
                    {feedback.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {feedback.improvements?.length > 0 && (
                <div className="feedback-list-col">
                  <h4>Areas to improve</h4>
                  <ul>
                    {feedback.improvements.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {feedback.improvement_plan?.length > 0 && (
            <div className="improvement-plan-card">
              <h3>Detailed Improvement Plan</h3>
              <p className="setup-sub improvement-plan-sub">
                Specific, actionable steps based on how you actually answered.
              </p>
              {feedback.improvement_plan.map((item, i) => (
                <div className="improvement-item" key={i}>
                  <div className="improvement-item-header">
                    <span className="improvement-number">{i + 1}</span>
                    <span className="improvement-area">{item.area}</span>
                  </div>

                  {item.example_from_interview && (
                    <div className="improvement-quote">
                      "{item.example_from_interview}"
                    </div>
                  )}

                  {item.observation && (
                    <p className="improvement-text">
                      <strong>What happened: </strong>
                      {item.observation}
                    </p>
                  )}

                  {item.why_it_matters && (
                    <p className="improvement-text">
                      <strong>Why it matters: </strong>
                      {item.why_it_matters}
                    </p>
                  )}

                  {item.how_to_improve && (
                    <p className="improvement-text improvement-action">
                      <strong>How to improve: </strong>
                      {item.how_to_improve}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <button className="start-btn" onClick={goHome}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ---- Setup screen ----
  if (!started) {
    return (
      <div className="ai-interview-container setup-screen">
        <button className="floating-back-btn" onClick={() => navigate("/home")} aria-label="Back to home">
          <BackIcon />
        </button>
        <div className="setup-panel setup-panel-wide">
          <h2>BlinkR AI Interviewer</h2>
          <p className="setup-sub">Tell us a bit about the interview you want, and we'll tailor it.</p>
          <form
            className="setup-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!candidateName.trim()) return;
              setStatus("connecting");
              setStarted(true);
            }}
          >
            <label>
              Your Name
              <input
                type="text"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="e.g. Priya Sharma"
                required
              />
            </label>

            <label>
              Role you're interviewing for
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Frontend Developer - JS"
              />
            </label>

            <div className="setup-form-row">
              <label>
                Interview Type
                <select value={interviewType} onChange={(e) => setInterviewType(e.target.value)}>
                  <option>Technical</option>
                  <option>Behavioral</option>
                  <option>HR/Screening</option>
                  <option>Mixed</option>
                </select>
              </label>

              <label>
                Experience Level
                <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)}>
                  <option>Fresher / Entry-level</option>
                  <option>Mid-level</option>
                  <option>Senior</option>
                </select>
              </label>
            </div>

            <div className="setup-form-row">
              <label>
                Difficulty
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </select>
              </label>

              <label>
                Focus Areas <span className="optional-tag">(optional)</span>
                <input
                  type="text"
                  value={focusAreas}
                  onChange={(e) => setFocusAreas(e.target.value)}
                  placeholder="e.g. React, System Design"
                />
              </label>
            </div>

            <button type="submit" className="start-btn">
              Start Interview
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-interview-container">
      <audio ref={audioElRef} autoPlay />

      {/* Header */}
      <div className="ai-interview-header">
        <div className="header-left">
          <button className="icon-back-btn" onClick={goHome} aria-label="Back to home">
            <BackIcon />
          </button>
          <div className="brand">
            Blink<span className="brand-accent">R</span>
          </div>
        </div>
        <span className={`status-pill ${status}`}>
          <span className="status-dot" />
          {status === "connecting" && "Connecting"}
          {status === "live" && "Interview in progress"}
          {status === "ended" && "Interview ended"}
        </span>
        <button className="header-end-btn" onClick={endInterview}>
          <PhoneOffIcon />
          <span>End Interview</span>
        </button>
      </div>

      {errorBanner && (
        <div className="error-banner">
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {/* Body */}
      <div className="ai-interview-body">
        <div className="avatar-panel">
          <div className="avatar-ring-wrapper">
            <div className="ring ring-mid" />
            <div className={`avatar-ring ${agentSpeaking ? "speaking" : ""}`}>
              <div className="avatar-face">
                <BotIcon size={44} />
              </div>
            </div>
          </div>
          <p className="avatar-label">BlinkR AI Interviewer</p>
          <p className="avatar-state">{agentSpeaking ? "Speaking" : "Listening"}</p>
          <div className={`mini-wave ${agentSpeaking ? "active" : ""}`}>
            {Array.from({ length: 20 }).map((_, i) => (
              <span key={i} style={{ animationDelay: `${i * 0.05}s` }} />
            ))}
          </div>
        </div>

        <div className="transcript-panel">
          {messages.length === 0 && (
            <div className="transcript-empty">Your conversation will appear here.</div>
          )}
          {messages.map((m, i) => {
            const isYou = m.sender === "You";
            return (
              <div key={i} className={`bubble-row ${isYou ? "you" : "ai"}`}>
                {!isYou && (
                  <div className="avatar-chip ai-chip">
                    <BotIcon size={18} />
                  </div>
                )}
                <div>
                  <div className={`bubble-sender-row ${isYou ? "you" : ""}`}>
                    <span className="bubble-sender">{m.sender}</span>
                  </div>
                  <div className={`bubble ${isYou ? "you" : "ai"}`}>
                    <div className="bubble-text">{m.text}</div>
                    <div className="bubble-time">{m.time}</div>
                  </div>
                </div>
                {isYou && (
                  <div className="avatar-chip you-chip">{initials(candidateName || "You")}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="self-video-tile">
        <video ref={localVideoElRef} autoPlay muted playsInline />
        <span className="self-video-label">{candidateName || "You"}</span>
      </div>

      {/* Bottom control bar */}
      <div className="controls-bar">
        <button className="pill-btn" onClick={toggleMute}>
          {muted ? <MicOffIcon /> : <MicIcon />}
          <span>{muted ? "Unmute" : "Mute"}</span>
        </button>

        <div className="mic-center">
          <p className="mic-label">{status === "live" ? "Listening" : "Connecting"}</p>
          <button
            className={`mic-btn ${muted ? "muted" : ""}`}
            onClick={toggleMute}
            aria-label={muted ? "Unmute microphone" : "Mute microphone"}
          >
            {muted ? <MicOffIcon /> : <MicIcon />}
          </button>
          <p className="mic-hint">Click the mic to {muted ? "resume" : "pause"} speaking</p>
        </div>

        <div className="controls-bar-spacer" />
      </div>
    </div>
  );
};

export default AIInterviewer;