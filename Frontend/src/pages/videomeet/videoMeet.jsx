import React, { useRef, useState, useEffect, useCallback, memo } from "react";
import server from "../../enviornment";
import { useNavigate, useLocation } from "react-router-dom";

import styles from "../../styles/videoMeet.module.css";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import AppTheme from "../components/AppTheme";
import CssBaseline from "@mui/material/CssBaseline";
import ColorModeSelect from "../components/ColorModeSelect";
import { IconButton, CircularProgress } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import Badge from "@mui/material/Badge";
import ChatIcon from "@mui/icons-material/Chat";
import SendIcon from "@mui/icons-material/Send";
import GroupsIcon from "@mui/icons-material/Groups";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import CloseIcon from "@mui/icons-material/Close";
import FormControl from "@mui/material/FormControl";
import Snackbar from "@mui/material/Snackbar";

import useMedia from "./hooks/useMedia";
import useSocketWebRTC from "./hooks/useSocketWebRTC";
import useResumeUpload from "./hooks/useResumeUpload";

const server_url = `${server}`;

function formatElapsed(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/* ============================================================
   VideoTile
   Memoized so it only re-renders when ITS OWN props change -
   not when unrelated parent state (like a chat draft) changes.
   The local tile uses a stable ref object; remote tiles register
   their DOM node into a ref map and get srcObject assigned from
   a useEffect in the parent keyed on `videos`, never from an
   inline ref callback (which would change identity every render
   and cause the detach/reattach "blink").
   ============================================================ */
const VideoTile = memo(function VideoTile({
  id,
  label,
  isLocal,
  localVideoRef,
  registerRemoteNode,
  muted,
  audioOn,
  videoOn,
  onToggleAudio,
  onToggleVideo,
  isExpanded,
  isMinimized,
  onToggleExpand,
  isWaiting,
}) {
  const tileClass = isExpanded
    ? styles.videoTileMain
    : isMinimized
    ? styles.videoTileMini
    : styles.videoTile;

  if (isWaiting) {
    return (
      <div className={`${tileClass} ${styles.videoTileWaiting}`}>
        <p>Waiting for the other participant to join…</p>
      </div>
    );
  }

  return (
    <div className={tileClass}>
      <div className={styles.videoTileLabel}>
        <span className={styles.liveDot} />
        {label}
      </div>

      <video
        className={styles.tileVideo}
        autoPlay
        muted={muted}
        ref={isLocal ? localVideoRef : (node) => registerRemoteNode(id, node)}
      />

      <button
        className={styles.expandBtn}
        onClick={() => onToggleExpand(id)}
        title={isExpanded ? "Collapse" : "Expand"}
      >
        {isExpanded ? (
          <FullscreenExitIcon fontSize="small" />
        ) : (
          <FullscreenIcon fontSize="small" />
        )}
      </button>

      {isLocal && !isMinimized && (
        <div className={styles.tileControls}>
          <IconButton size="small" className={styles.tileIconBtn} onClick={onToggleAudio}>
            {audioOn ? <MicIcon fontSize="small" /> : <MicOffIcon fontSize="small" />}
          </IconButton>
          <IconButton size="small" className={styles.tileIconBtn} onClick={onToggleVideo}>
            {videoOn ? <VideocamIcon fontSize="small" /> : <VideocamOffIcon fontSize="small" />}
          </IconButton>
        </div>
      )}
    </div>
  );
});

/* ============================================================
   ChatPanel
   Owns its own input state. Typing here re-renders ONLY this
   component, not the video grid or the rest of the page.
   ============================================================ */
const ChatPanel = memo(function ChatPanel({ messages, myId, onSend, onClose }) {
  const [draft, setDraft] = useState("");

  const handleSend = () => {
    const cleaned = draft.trim();
    if (!cleaned) return;
    onSend(cleaned);
    setDraft("");
  };

  return (
    <div className={styles.chatPanel}>
      <div className={styles.panelHeaderRow}>
        <h3 className={styles.panelTitle}>Room Chat</h3>
        {onClose && (
          <IconButton size="small" className={styles.panelCloseBtn} onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </div>
      <div className={styles.chatMessages}>
        <div className={styles.systemMsg}>
          <span className={styles.systemLabel}>System</span>
          <p>Interview started. All the best! 🎉</p>
        </div>
        {messages.length === 0 ? (
          <p className={styles.emptyText}>No messages yet.</p>
        ) : (
          messages.map((item, index) => {
            const isMine = myId === item.id;
            return (
              <div
                key={index}
                className={
                  isMine
                    ? `${styles.chatBubble} ${styles.chatBubbleMine}`
                    : styles.chatBubble
                }
              >
                <span className={styles.chatSender}>{isMine ? "You" : item.sender}</span>
                <p className={styles.chatText}>{item.data}</p>
              </div>
            );
          })
        )}
      </div>
      <div className={styles.chatInputRow}>
        <TextField
          className={styles.chatInputField}
          placeholder="Type a message..."
          variant="outlined"
          size="small"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
        />
        <IconButton onClick={handleSend} className={styles.sendBtn}>
          <SendIcon fontSize="small" />
        </IconButton>
      </div>
    </div>
  );
});

/* ============================================================
   QuestionsPanel
   Owns its own "asked" / tab state locally so toggling a
   question, or typing elsewhere on the page, doesn't ripple
   out to the video grid.
   ============================================================ */
const QuestionsPanel = memo(function QuestionsPanel({
  resumeId,
  questions,
  loading,
  uploadMessage,
  errorMessage,
  onUploadFile,
  onFetchGeneralized,
  onFetchSkill,
  onRegenerate,
  onClose,
}) {
  const [fileName, setFileName] = useState("");
  const [askedIndexes, setAskedIndexes] = useState([]);
  const [questionTab, setQuestionTab] = useState("all");

  const toggleAsked = (idx) => {
    setAskedIndexes((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFileName(selected.name);
    onUploadFile(selected);
  };

  const visibleQuestions =
    questionTab === "asked"
      ? questions.filter((_, idx) => askedIndexes.includes(idx))
      : questions;

  return (
    <aside className={styles.leftSidebar}>
      <div className={styles.panelHeaderRow}>
        <h3 className={styles.panelTitle}>AI Generated Questions</h3>
        <div className={styles.panelHeaderActions}>
          <span className={styles.aiTag}>AI</span>
          {onClose && (
            <IconButton size="small" className={styles.panelCloseBtn} onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </div>
      </div>

      {!resumeId ? (
        <div className={styles.uploadPrompt}>
          <p className={styles.panelSubtext}>
            Upload the candidate's resume to generate interview questions.
          </p>
          <Button
            component="label"
            disabled={loading}
            style={{
              backgroundColor: "var(--accent)",
              color: "#fff",
              fontSize: "0.8rem",
              width: "100%",
            }}
          >
            {loading ? (
              <CircularProgress size={16} style={{ color: "#fff" }} />
            ) : (
              <>
                Upload Resume <FileUploadIcon fontSize="small" />
              </>
            )}
            <input type="file" hidden accept=".pdf" onChange={handleFileChange} />
          </Button>
          {errorMessage && <p className={styles.errorText}>{errorMessage}</p>}
        </div>
      ) : (
        <>
          <p className={styles.panelSubtext}>
            {fileName ? `Based on resume: ${fileName}` : "Resume uploaded"}
          </p>

          <div className={styles.questionActionsRow}>
            <button className={styles.miniActionBtn} onClick={onFetchGeneralized} disabled={loading}>
              Overall
            </button>
            <button className={styles.miniActionBtn} onClick={onFetchSkill} disabled={loading}>
              Skills
            </button>
            <button className={styles.miniActionBtn} onClick={onRegenerate} disabled={loading}>
              <AutorenewIcon fontSize="inherit" /> Regenerate
            </button>
          </div>

          {loading && (
            <div className={styles.loadingRow}>
              <CircularProgress size={16} />
              <span>Generating questions…</span>
            </div>
          )}
          {errorMessage && <p className={styles.errorText}>{errorMessage}</p>}
          {uploadMessage && questions.length === 0 && !loading && (
            <p className={styles.panelSubtext}>Resume ready — pick a question set above.</p>
          )}

          {questions.length > 0 && (
            <>
              <div className={styles.questionTabs}>
                <button
                  className={
                    questionTab === "all"
                      ? `${styles.tabBtn} ${styles.tabBtnActive}`
                      : styles.tabBtn
                  }
                  onClick={() => setQuestionTab("all")}
                >
                  All Questions
                </button>
                <button
                  className={
                    questionTab === "asked"
                      ? `${styles.tabBtn} ${styles.tabBtnActive}`
                      : styles.tabBtn
                  }
                  onClick={() => setQuestionTab("asked")}
                >
                  Asked ({askedIndexes.length})
                </button>
              </div>

              <div className={styles.questionsList}>
                {visibleQuestions.length === 0 ? (
                  <p className={styles.emptyText}>No questions marked as asked yet.</p>
                ) : (
                  visibleQuestions.map((q) => {
                    const originalIndex = questions.indexOf(q);
                    return (
                      <button
                        key={originalIndex}
                        className={
                          askedIndexes.includes(originalIndex)
                            ? `${styles.questionItem} ${styles.questionItemAsked}`
                            : styles.questionItem
                        }
                        onClick={() => toggleAsked(originalIndex)}
                      >
                        <span className={styles.questionNumber}>{originalIndex + 1}</span>
                        <span className={styles.questionBody}>
                          <span className={styles.questionText}>{q.question}</span>
                          <span className={styles.questionTag}>
                            {q.type}
                            {q.level ? ` · ${q.level}` : ""}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </>
      )}
    </aside>
  );
});

/* ============================================================
   ParticipantsPanel
   ============================================================ */
const ParticipantsPanel = memo(function ParticipantsPanel({ username, audioOn, remoteCount, onClose }) {
  return (
    <div className={styles.participantsPanel}>
      <div className={styles.panelHeaderRow}>
        <h4 className={styles.panelTitle}>Participants ({remoteCount + 1})</h4>
        {onClose && (
          <IconButton size="small" className={styles.panelCloseBtn} onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </div>
      <div className={styles.participantRow}>
        <div className={styles.participantAvatar}>
          {username ? username.charAt(0).toUpperCase() : "U"}
        </div>
        <span className={styles.participantName}>{username} (You)</span>
        {audioOn ? (
          <MicIcon fontSize="small" className={styles.participantIcon} />
        ) : (
          <MicOffIcon fontSize="small" className={styles.participantIcon} />
        )}
      </div>
      {Array.from({ length: remoteCount }).map((_, i) => (
        <div className={styles.participantRow} key={i}>
          <div className={styles.participantAvatar}>P</div>
          <span className={styles.participantName}>Participant</span>
          <MicIcon fontSize="small" className={styles.participantIcon} />
        </div>
      ))}
    </div>
  );
});

export default function VideoMeetComponent() {
  let routeTo = useNavigate();
  let location = useLocation();

  const localVideoRef = useRef();
  const remoteNodesRef = useRef({}); // socketId -> <video> DOM node

  const [videoAvailable, setVideoAvailable] = useState();
  const [audioAvailable, setAudioAvailable] = useState();
  const [video, setVideo] = useState();
  const [audio, setAudio] = useState();
  const [screen, setScreen] = useState();
  const [screenAvailable, setScreenAvailable] = useState(false);

  const [messages, setMessages] = useState([]);
  const [newMessages, setNewMessages] = useState(0);
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState("");
  const [videos, setVideos] = useState([]);
  const [open, setOpen] = useState(false);

  const [usernameError, setUsernameError] = useState(false);
  const [usernameErrorMessage, setUsernameErrorMessage] = useState("");

  // --- Layout state: panels start CLOSED, open only on user action ---
  const [showQuestions, setShowQuestions] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

  // --- Entry-screen camera/mic preview toggles ---
  const [previewCamOn, setPreviewCamOn] = useState(true);
  const [previewMicOn, setPreviewMicOn] = useState(true);

  const [expandedId, setExpandedId] = useState(null); // "local" | socketId | null
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const addMessage = useCallback((data, sender, senderID) => {
    setMessages((prev) => [...prev, { sender: sender, data: data, id: senderID }]);
    if (senderID !== socketRefId.current) {
      setNewMessages((prev) => prev + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { connectToSocketServer, connections, socketRef, socketRefId } = useSocketWebRTC({
    server_url,
    setVideos,
    addMessage,
  });

  const { requestPermissions } = useMedia({
    localVideoRef,
    connections,
    socketRefId,
    video,
    audio,
    screen,
    setVideo,
    setAudio,
    setScreen,
    setVideoAvailable,
    setAudioAvailable,
    setScreenAvailable,
  });

  const {
    resumeId,
    questions,
    uploadResume,
    fetchGeneralizedQuestions,
    fetchSkillQuestions,
    regenerateQuestions,
    loading,
    uploadMessage,
    errorMessage,
  } = useResumeUpload();

  // Register / assign remote <video> srcObject only when the `videos`
  // array actually changes (new stream, new peer) - never on unrelated
  // re-renders like chat typing. This is what stops the picture "blink".
  const registerRemoteNode = useCallback((socketId, node) => {
    if (node) {
      remoteNodesRef.current[socketId] = node;
    } else {
      delete remoteNodesRef.current[socketId];
    }
  }, []);

  useEffect(() => {
    videos.forEach((v) => {
      const node = remoteNodesRef.current[v.socketId];
      if (node && v.stream && node.srcObject !== v.stream) {
        node.srcObject = v.stream;
      }
    });
  }, [videos]);

  const getMedia = () => {
    setVideo(videoAvailable && previewCamOn);
    setAudio(audioAvailable && previewMicOn);
    connectToSocketServer();
  };

  const connect = () => {
    setAskForUsername(false);
    getMedia();
  };



  // Camera/mic toggles on the entry screen mute the actual preview
  // stream's tracks (not just hide the UI), so what you see before
  // joining matches what happens when you connect.
  const togglePreviewCam = useCallback(() => {
    setPreviewCamOn((prev) => {
      const next = !prev;
      window.localStream?.getVideoTracks().forEach((t) => (t.enabled = next));
      return next;
    });
  }, []);

  const togglePreviewMic = useCallback(() => {
    setPreviewMicOn((prev) => {
      const next = !prev;
      window.localStream?.getAudioTracks().forEach((t) => (t.enabled = next));
      return next;
    });
  }, []);

  // If permissions resolve (or are retried) after the user already
  // toggled cam/mic off, re-apply that choice to the fresh tracks.
  useEffect(() => {
    if (!askForUsername) return;
    window.localStream?.getVideoTracks().forEach((t) => (t.enabled = previewCamOn));
    window.localStream?.getAudioTracks().forEach((t) => (t.enabled = previewMicOn));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoAvailable, audioAvailable, askForUsername]);

  const handleVideo = useCallback(() => setVideo((v) => !v), []);
  const handleAudio = useCallback(() => setAudio((a) => !a), []);
  const handleScreen = useCallback(() => setScreen((s) => !s), []);

  useEffect(() => {
    if (showChat) setNewMessages(0);
  }, [showChat]);

  useEffect(() => {
    if (askForUsername) return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [askForUsername]);

  useEffect(() => {
    return () => {
      Object.values(connections.current || {}).forEach((peer) => peer.close());
      if (socketRef.current) socketRef.current.disconnect();
      if (window.localStream) {
        window.localStream.getTracks().forEach((track) => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEndCall = () => {
    try {
      let tracks = localVideoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
    } catch {}

    if (location.pathname.startsWith("/guestRoom")) {
      routeTo("/");
    } else {
      routeTo("/home");
    }
  };

  const handleSendMessage = useCallback(
    (text) => {
      socketRef.current.emit("chat-message", text, username);
    },
    [username, socketRef]
  );

  const toggleExpand = useCallback((id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const validateInputs = () => {
    let isValid = true;
    if (!username) {
      setUsernameError(true);
      setUsernameErrorMessage("Please enter your username.");
      isValid = false;
    } else {
      setUsernameError(false);
      setUsernameErrorMessage("");
    }
    return isValid;
  };

  useEffect(() => {
    if (location.state?.isGuest) setOpen(true);
  }, [location.state]);

  if (askForUsername) {
    const cameraChecking = videoAvailable === undefined;
    const micChecking = audioAvailable === undefined;
    const cameraBlocked = videoAvailable === false;
    const micBlocked = audioAvailable === false;
    const stillChecking = cameraChecking || micChecking;

    const statusLabel = (checking, ok) =>
      checking ? "Checking…" : ok ? "Ready" : "Blocked";
    const statusClass = (checking, ok) =>
      checking
        ? `${styles.permissionPill} ${styles.permissionPillChecking}`
        : ok
        ? `${styles.permissionPill} ${styles.permissionPillOk}`
        : `${styles.permissionPill} ${styles.permissionPillBlocked}`;

    const darkFieldSx = {
      "& .MuiOutlinedInput-root": {
        color: "var(--text)",
        backgroundColor: "var(--panel-alt)",
        borderRadius: "10px",
        "& fieldset": { borderColor: "var(--border)" },
        "&:hover fieldset": { borderColor: "var(--accent)" },
        "&.Mui-focused fieldset": { borderColor: "var(--accent)", borderWidth: "1.5px" },
      },
      "& .MuiInputLabel-root": { color: "var(--text-muted)" },
      "& .MuiInputLabel-root.Mui-focused": { color: "var(--accent)" },
      "& .MuiFormHelperText-root": { color: "var(--red)" },
    };

    return (
      <AppTheme>
        <CssBaseline enableColorScheme />
        <ColorModeSelect sx={{ position: "fixed", top: "1rem", right: "1rem" }} />
        <div className={styles.entryScreen}>
          <div className={styles.entryCard}>
            <div className={styles.entryLogoRow}>
              <span className={styles.appName}>BlinkR</span>
            </div>

            <div className={styles.entryHeading}>
              <h2 className={styles.entryTitle}>Join Interview Room</h2>
              <p className={styles.entrySubtitle}>
                Check your camera and microphone, then enter your name to join.
              </p>
            </div>

            <div className={styles.entryVideoFrame}>
              <video className={styles.entryVideo} ref={localVideoRef} autoPlay muted />
              {(cameraBlocked || cameraChecking || !previewCamOn) && (
                <div className={styles.entryVideoOverlay}>
                  {cameraChecking ? (
                    <CircularProgress size={22} style={{ color: "#fff" }} />
                  ) : cameraBlocked ? (
                    <>
                      <VideocamOffIcon />
                      <span>Camera unavailable</span>
                    </>
                  ) : (
                    <>
                      <VideocamOffIcon />
                      <span>Camera off</span>
                    </>
                  )}
                </div>
              )}

              <div className={styles.entryPreviewControls}>
                <IconButton
                  className={
                    previewMicOn
                      ? styles.entryPreviewBtn
                      : `${styles.entryPreviewBtn} ${styles.entryPreviewBtnOff}`
                  }
                  onClick={togglePreviewMic}
                  disabled={micBlocked}
                  title={previewMicOn ? "Turn off microphone" : "Turn on microphone"}
                >
                  {previewMicOn ? <MicIcon /> : <MicOffIcon />}
                </IconButton>
                <IconButton
                  className={
                    previewCamOn
                      ? styles.entryPreviewBtn
                      : `${styles.entryPreviewBtn} ${styles.entryPreviewBtnOff}`
                  }
                  onClick={togglePreviewCam}
                  disabled={cameraBlocked}
                  title={previewCamOn ? "Turn off camera" : "Turn on camera"}
                >
                  {previewCamOn ? <VideocamIcon /> : <VideocamOffIcon />}
                </IconButton>
              </div>
            </div>

            <div className={styles.permissionRow}>
              <span className={statusClass(cameraChecking, videoAvailable)}>
                <VideocamIcon fontSize="inherit" />
                Camera
                <em>{statusLabel(cameraChecking, videoAvailable)}</em>
              </span>
              <span className={statusClass(micChecking, audioAvailable)}>
                <MicIcon fontSize="inherit" />
                Microphone
                <em>{statusLabel(micChecking, audioAvailable)}</em>
              </span>
            </div>

            {(cameraBlocked || micBlocked) && (
              <div className={styles.permissionWarning}>
                <p>
                  {cameraBlocked && micBlocked
                    ? "Camera and microphone access are blocked."
                    : cameraBlocked
                    ? "Camera access is blocked."
                    : "Microphone access is blocked."}{" "}
                  Allow access in your browser's site settings, then retry.
                </p>
                <Button
                  onClick={requestPermissions}
                  className={styles.permissionRetryBtn}
                  style={{ fontWeight: 600 }}
                >
                  Retry
                </Button>
              </div>
            )}

            <div className={styles.entryDivider} />

            <FormControl fullWidth className={styles.entryFormControl}>
              <TextField
                error={usernameError}
                helperText={usernameErrorMessage}
                label="Your name"
                placeholder="e.g. Priya Sharma"
                variant="outlined"
                fullWidth
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !stillChecking && validateInputs()) connect();
                }}
                sx={darkFieldSx}
              />
            </FormControl>

            <Button
              fullWidth
              disabled={stillChecking}
              onClick={() => {
                if (validateInputs()) connect();
              }}
              className={styles.entryConnectBtn}
              style={{
                backgroundColor: stillChecking ? "var(--panel-alt)" : "var(--accent)",
                color: stillChecking ? "var(--text-muted)" : "#fff",
                fontWeight: 600,
              }}
            >
              {stillChecking ? "Checking camera & mic…" : "Connect"}
            </Button>
          </div>
        </div>
        <Snackbar
          open={open}
          autoHideDuration={2000}
          onClose={() => setOpen(false)}
          message={"Meeting link copied to clipboard!"}
        />
      </AppTheme>
    );
  }

  const anyPanelOpen = showQuestions || showChat || showParticipants;

  return (
    <AppTheme>
      <CssBaseline enableColorScheme />
      <div className={styles.appShell}>
        {/* ---------- Header ---------- */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.appName}>BlinkR</span>
            <span className={styles.headerDivider} />
            <span className={styles.roomLabel}>Interview Room</span>
          </div>

          <div className={styles.headerCenter}>
            <span className={styles.statusDot} />
            <span className={styles.statusText}>Interview in Progress</span>
            <span className={styles.timer}>{formatElapsed(elapsedSeconds)}</span>
          </div>

          <div className={styles.headerRight}>
            <IconButton
              className={styles.headerIconBtn}
              onClick={() => setShowParticipants((v) => !v)}
              title="Participants"
            >
              <GroupsIcon />
            </IconButton>
            <ColorModeSelect />
            <div className={styles.avatarCircle}>
              {username ? username.charAt(0).toUpperCase() : "U"}
            </div>
          </div>
        </header>

        {/* ---------- Main layout ---------- */}
        <div className={styles.mainArea}>
          {showQuestions && (
            <QuestionsPanel
              resumeId={resumeId}
              questions={questions}
              loading={loading}
              uploadMessage={uploadMessage}
              errorMessage={errorMessage}
              onUploadFile={uploadResume}
              onFetchGeneralized={fetchGeneralizedQuestions}
              onFetchSkill={fetchSkillQuestions}
              onRegenerate={regenerateQuestions}
              onClose={() => setShowQuestions(false)}
            />
          )}

          <div className={styles.centerArea}>
            <div
              className={
                expandedId ? `${styles.videoGrid} ${styles.videoGridExpanded}` : styles.videoGrid
              }
            >
              <VideoTile
                id="local"
                label={username || "You"}
                isLocal
                localVideoRef={localVideoRef}
                registerRemoteNode={registerRemoteNode}
                muted
                audioOn={!!audio}
                videoOn={!!video}
                onToggleAudio={handleAudio}
                onToggleVideo={handleVideo}
                isExpanded={expandedId === "local"}
                isMinimized={!!expandedId && expandedId !== "local"}
                onToggleExpand={toggleExpand}
              />

              {videos.length === 0 && (
                <VideoTile
                  id="waiting"
                  isWaiting
                  isMinimized={!!expandedId}
                />
              )}

              {videos.map((v) => (
                <VideoTile
                  key={v.socketId}
                  id={v.socketId}
                  label="Participant"
                  isLocal={false}
                  registerRemoteNode={registerRemoteNode}
                  muted={false}
                  isExpanded={expandedId === v.socketId}
                  isMinimized={!!expandedId && expandedId !== v.socketId}
                  onToggleExpand={toggleExpand}
                />
              ))}
            </div>
          </div>

          {anyPanelOpen && (showChat || showParticipants) && (
            <aside className={styles.rightSidebar}>
              {showChat && (
                <ChatPanel
                  messages={messages}
                  myId={socketRefId.current}
                  onSend={handleSendMessage}
                  onClose={() => setShowChat(false)}
                />
              )}
              {showParticipants && (
                <ParticipantsPanel
                  username={username}
                  audioOn={!!audio}
                  remoteCount={videos.length}
                  onClose={() => setShowParticipants(false)}
                />
              )}
            </aside>
          )}
        </div>

        {/* ---------- Bottom control bar ---------- */}
        <div className={styles.bottomBar}>
          <button className={styles.bottomBtn} onClick={handleAudio}>
            {audio ? <MicIcon /> : <MicOffIcon />}
            <span>Mic</span>
          </button>
          <button className={styles.bottomBtn} onClick={handleVideo}>
            {video ? <VideocamIcon /> : <VideocamOffIcon />}
            <span>Camera</span>
          </button>
          {screenAvailable && (
            <button
              className={
                screen ? `${styles.bottomBtn} ${styles.bottomBtnActive}` : styles.bottomBtn
              }
              onClick={handleScreen}
            >
              {screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
              <span>Share Screen</span>
            </button>
          )}
          <button
            className={
              showChat ? `${styles.bottomBtn} ${styles.bottomBtnActive}` : styles.bottomBtn
            }
            onClick={() => setShowChat((v) => !v)}
          >
            <Badge badgeContent={newMessages} color="secondary">
              <ChatIcon />
            </Badge>
            <span>Chat</span>
          </button>
          <button
            className={
              showQuestions ? `${styles.bottomBtn} ${styles.bottomBtnActive}` : styles.bottomBtn
            }
            onClick={() => setShowQuestions((v) => !v)}
          >
            <FileUploadIcon />
            <span>Questions</span>
          </button>
          <button
            className={
              showParticipants
                ? `${styles.bottomBtn} ${styles.bottomBtnActive}`
                : styles.bottomBtn
            }
            onClick={() => setShowParticipants((v) => !v)}
          >
            <GroupsIcon />
            <span>Participants</span>
          </button>
          <button className={styles.leaveBtn} onClick={handleEndCall}>
            <CallEndIcon fontSize="small" />
            Leave Interview
          </button>
        </div>
      </div>

      <Snackbar
        open={open}
        autoHideDuration={2000}
        onClose={() => setOpen(false)}
        message={"Meeting link copied to clipboard!"}
      />
    </AppTheme>
  );
}