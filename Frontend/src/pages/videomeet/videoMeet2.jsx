import React, { useRef, useState, useEffect } from "react";
import server from "../../enviornment";
import { useNavigate, useLocation } from "react-router-dom";

import styles from "../../styles/videoMeet.module.css";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import AppTheme from "../components/AppTheme";
import CssBaseline from "@mui/material/CssBaseline";
import ColorModeSelect from "../components/ColorModeSelect";
import { IconButton } from "@mui/material";
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
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import FormControl from "@mui/material/FormControl";
import Snackbar from "@mui/material/Snackbar";
import TryIcon from "@mui/icons-material/Try";
import FileUploadIcon from "@mui/icons-material/FileUpload";

import useMedia from "./hooks/useMedia";
import useSocketWebRTC from "./hooks/useSocketWebRTC";
import useResumeUpload from "./hooks/useResumeUpload";

const server_url = `${server}`;

export default function VideoMeetComponent() {
  let routeTo = useNavigate();
  let location = useLocation();

  const localVideoRef = useRef();

  const [videoAvailable, setVideoAvailable] = useState();
  const [audioAvailable, setAudioAvailable] = useState();
  const [video, setVideo] = useState();
  const [audio, setAudio] = useState();
  const [screen, setScreen] = useState();
  const [screenAvailable, setScreenAvailable] = useState(false);

  const [showChatModal, setShowChatModal] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [newMessages, setNewMessages] = useState(0);
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState("");
  const [videos, setVideos] = useState([]);
  const [open, setOpen] = useState(false);

  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [file, setFile] = useState();

  const [usernameError, setUsernameError] = useState(false);
  const [usernameErrorMessage, setUsernameErrorMessage] = useState("");

  const addMessage = (data, sender, senderID) => {
    setMessages((prev) => [
      ...prev,
      { sender: sender, data: data, id: senderID },
    ]);

    if (senderID !== socketRefId.current) {
      setNewMessages((prev) => prev + 1);
    }
  };

  const { connectToSocketServer, connections, socketRef, socketRefId } =
    useSocketWebRTC({
      server_url,
      setVideos,
      addMessage,
    });

  useMedia({
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

  const getMedia = () => {
    setVideo(videoAvailable);
    setAudio(audioAvailable);
    connectToSocketServer();
  };

  const connect = () => {
    setAskForUsername(false);
    getMedia();
  };

  const handleVideo = () => setVideo(!video);
  const handleAudio = () => setAudio(!audio);
  const handleScreen = () => setScreen(!screen);
  const handleChatBtn = () => setShowChatModal(!showChatModal);
  const handleQuestionBtn = () => setShowQuestionModal(!showQuestionModal);
  const handleResumeUpload = () => {
    if (!file) return;
    uploadResume(file);
  };

  useEffect(() => {
    if (showChatModal === true) {
      setNewMessages(0);
    }
  }, [showChatModal]);

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

  const sendMessage = () => {
    const cleaned = message.trim();
    if (!cleaned) return;

    socketRef.current.emit("chat-message", cleaned, username);
    setMessage("");
  };

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
    if (location.state?.isGuest) {
      setOpen(true);
    }
  }, [location.state]);

  return (
    <AppTheme>
      <CssBaseline enableColorScheme />
      <ColorModeSelect sx={{ position: "fixed", top: "1rem", right: "1rem" }} />

      <div>
        {askForUsername ? (
          <div className={styles.preview}>
            <div>
              <FormControl>
                <TextField
                  error={usernameError}
                  helperText={usernameErrorMessage}
                  label="Username"
                  variant="outlined"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </FormControl>

              <Button
                onClick={() => {
                  if (validateInputs()) connect();
                }}
                style={{
                  backgroundColor: "#893bff",
                  color: "#fff",
                  fontWeight: 600,
                  marginLeft: "0.5rem",
                }}
              >
                Connect
              </Button>
            </div>
            <br />
            <div>
              <video ref={localVideoRef} autoPlay />
            </div>
          </div>
        ) : (
          <div className={styles.meetVideoContainer}>
            {showChatModal && (
              <div className={styles.chatRoom}>
                <div className={styles.chatContainer}>
                  <div className={styles.chatHeading}>
                    <h2>Chat</h2>
                    <QuestionAnswerRoundedIcon />
                  </div>

                  <div className={styles.chattingArea}>
                    {messages.length > 0 ? (
                      messages.map((item, index) => (
                        <div
                          key={index}
                          className={
                            socketRefId.current !== item.id
                              ? styles.msgReceived
                              : styles.msgSended
                          }
                        >
                          <p style={{ fontWeight: "bold" }}>@{item.sender}</p>
                          <p>{item.data}</p>
                        </div>
                      ))
                    ) : (
                      <p>No message yet.</p>
                    )}
                  </div>

                  <div className={styles.sendingArea}>
                    <TextField
                      label="Enter message"
                      variant="outlined"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                    <IconButton onClick={sendMessage}>
                      <SendIcon />
                    </IconButton>
                  </div>
                </div>
              </div>
            )}
            {showQuestionModal && (
              <div className={styles.chatRoom}>
                <div className={styles.chatContainer}>
                  <div className={styles.chatHeading}>
                    <h2>AI Question Generator </h2>
                  </div>

                  <div className={styles.chattingArea}>
                    {questions.length > 0 ? (
                      questions.map((item, index) => (
                        <div key={index} className={styles.msgReceived}>
                          <p>{item.data}</p>
                        </div>
                      ))
                    ) : (
                      <p></p>
                    )}
                  </div>

                  <div className={styles.sendingArea}>
                  {!file?
                    <Button
                      component="label"
                      style={{
                        backgroundColor: "#893bff",
                        color: "#fff",
                        fontSize: "0.8rem",
                      }}
                      onClick={handleResumeUpload}
                    >
                      Upload Resume <FileUploadIcon fontSize="small" />
                      <input
                        type="file"
                        hidden
                        accept=".pdf"
                        onChange={(e) => {
                          setFile(e.target.files[0]);
                        }}
                      />
                    </Button>
                      :<div>
                        <Button
                          component="label"
                          style={styles.btnAI}
                          onClick={fetchGeneralizedQuestions}
                        >
                          Overall
                        </Button>
                        <Button
                          component="label"
                          style={styles.btnAI}
                          onClick={fetchGeneralizedQuestions}
                        >
                          Skills
                        </Button>
                        <Button
                          component="label"
                          style={styles.btnAI}
                          onClick={fetchGeneralizedQuestions}
                        >
                          Regenerate
                        </Button>
                      </div>
                    }
                  </div>
                </div>
              </div>
            )}

            <div className={styles.buttonContainer}>
              <IconButton onClick={handleVideo}>
                {video ? <VideocamIcon /> : <VideocamOffIcon />}
              </IconButton>

              <IconButton onClick={handleAudio}>
                {audio ? <MicIcon /> : <MicOffIcon />}
              </IconButton>

              <IconButton style={{ color: "red" }} onClick={handleEndCall}>
                <CallEndIcon />
              </IconButton>

              {screenAvailable && (
                <IconButton onClick={handleScreen}>
                  {screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                </IconButton>
              )}

              <Badge badgeContent={newMessages} color="secondary">
                <IconButton onClick={handleChatBtn}>
                  <ChatIcon />
                </IconButton>
              </Badge>

              <IconButton onClick={handleQuestionBtn}>
                <TryIcon />
              </IconButton>
            </div>

            <video
              className={styles.meetUserVideo}
              ref={localVideoRef}
              autoPlay
              muted
            />

            <div className={styles.conferenceView}>
              {videos.map((video) => (
                <video
                  key={video.socketId}
                  ref={(ref) => {
                    if (ref && video.stream) {
                      ref.srcObject = video.stream;
                    }
                  }}
                  autoPlay
                />
              ))}
            </div>
          </div>
        )}
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
