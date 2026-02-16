import React, { useRef, useState, useEffect } from "react";
import server from "../enviornment";

import styles from "../styles/videoMeet.module.css";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import AppTheme from "./components/AppTheme";
import CssBaseline from "@mui/material/CssBaseline";
import ColorModeSelect from "./components/ColorModeSelect";
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
import { io } from "socket.io-client";
import { useNavigate, useLocation } from "react-router-dom";

const server_url = `${server}`;

const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun2.l.google.com:19302" }],
};

export default function VideoMeetComponent() {
  let routeTo = useNavigate();
  let location = useLocation();

  const connections = useRef({}); //state not changes //no of connections connect to the client
  var socketRef = useRef(); //Socket.IO client instance.
  let socketRefId = useRef();
  let localVideoRef = useRef();
  let [videoAvailable, setVideoAvailable] = useState(); //bool
  let [audioAvailable, setAudioAvailable] = useState(); //bool
  let [video, setVideo] = useState(); //bool
  let [audio, setAudio] = useState(); //bool
  let [screen, setScreen] = useState();
  let [showModal, setModal] = useState(false);
  let [screenAvailable, setScreenAvailable] = useState();
  let [messages, setMessages] = useState([]);
  let [message, setMessage] = useState("");
  let [newMessages, setNewMessages] = useState(0);
  let [askForUsername, setAskForUsername] = useState(true);
  let [username, setUsername] = useState("");
  let [videos, setVideos] = useState([]);
  let [duration, setDuration] = useState();

  const [usernameError, setUsernameError] = React.useState(false);
  const [usernameErrorMessage, setUsernameErrorMessage] = React.useState("");

  const getPermissions = async () => {
    try {
      const userMediaStream = await navigator.mediaDevices.getUserMedia({
        //video audio
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (navigator.mediaDevices.getDisplayMedia) {
        //share screen
        setScreenAvailable(true);
      } else {
        setScreenAvailable(false);
      }
      if (userMediaStream) {
        window.localStream = userMediaStream; //for gloabal access , makes it accessible anywhere in app (not just inside this component).
        if (localVideoRef.current) {
          //localVideoRef is a React ref pointing to <video> element.
          localVideoRef.current.srcObject = userMediaStream; //This attaches the live MediaStream (camera/mic feed) to <video> element.
        }
        setVideoAvailable(true);
        setAudioAvailable(true);
      } else {
        setVideoAvailable(false);
        setAudioAvailable(false);
      }
    } catch (e) {
      console.log(e);
    }
  };
  useEffect(() => {
    getPermissions();
  }, []); //execute only on 1st render for permissions

  let getUserMedia = () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      navigator.mediaDevices
        .getUserMedia({ video: video, audio: audio })
        .then(getUserMediaSuccess) //update audio/vodeo status on/off in all devices connected in network
        .catch((err) => {
          console.log(err);
        });
    } else {
      try {
        let tracks = localVideoRef.current.srcObject.getTracks(); //Runs when neither video nor audio is enabled/available. Stops all existing media tracks (turns off camera/mic). Cleans up by stopping the stream
        tracks.forEach((track) => track.stop());
      } catch (err) {
        console.log(err);
      }
    }
  };

  useEffect(() => {
    if (video !== undefined || audio !== undefined) {
      getUserMedia(); //This ensures that toggling audio/video on/off immediately updates the media stream.
    }
  }, [audio, video]); //whenever any of these changes it triggers

  let silence = () => {
    //silent audio stream
    let ctx = new AudioContext();
    let oscillator = ctx.createOscillator();
    let dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    oscillator.stop();
    return dst.stream.getAudioTracks()[0];
  };

  let black = ({ width = 640, height = 480 } = {}) => {
    let canvas = Object.assign(document.createElement("canvas"), {
      width,
      height,
    });
    let ctx = canvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    let stream = canvas.captureStream();
    return stream.getVideoTracks()[0];
  };

  const getUserMediaSuccess = async (stream) => {
    // 1. stop any existing local track
    try {
      window.localStream?.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    // 2. set new stream
    window.localStream = stream;
    localVideoRef.current.srcObject = stream;

    // 3.If the real camera/mic tracks end unexpectedly, mark video/audio as off and replace them with a fake stream that looks like a black screen and silence, so the connection doesn’t break.
    stream.getTracks().forEach((track) => {
      track.onended = async () => {
        setVideo(false);
        setAudio(false);
        const blackSilence = ({ width = 640, height = 480 } = {}) => {
          return new MediaStream([black({ width, height }), silence()]);
        };
        localVideoRef.current.srcObject = blackSilence(); // swap to fake tracks
      };
    });

    // 4. update all peer connections
    for (const id in connections.current) {
      if (id === socketRefId.current) continue;

      //replace already existed tracks
      window.localStream.getTracks().forEach((track) => {
        const sender = connections.current[id]
          .getSenders()
          .find((s) => s.track && s.track.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        }
      });
    }
  };

  let gotMessageFromServer = async (fromId, message) => {
    const signal = JSON.parse(message);
    const peer = connections.current[fromId];
    if (!peer) {
      return;
    }

      if (signal.sdp) {
        const desc = new RTCSessionDescription(signal.sdp);

        if (desc.type === "offer") {
          // Handle incoming offer
          await peer.setRemoteDescription(desc);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socketRef.current.emit(
            "signal",
            fromId,
            JSON.stringify({ sdp: answer })
          );
        } else if (desc.type === "answer") {
          // Handle incoming answer
          if (peer.signalingState === "have-local-offer") {
            await peer.setRemoteDescription(desc);
          } else {
            console.warn("Unexpected answer in state:", peer.signalingState);
          }
        }
      }

    if (signal.ice) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(signal.ice));
      } catch (err) {
        console.log(err);
      }
    }
  };

  let addMessage = (data, sender, senderID) => {
    //sync data,sender,socketid of sender
    setMessages((prev) => [
      ...prev,
      { sender: sender, data: data, id: senderID },
    ]);

    if (senderID !== socketRefId.current) {
      setNewMessages((prev) => prev + 1);
    }
  };

  //on-receving , emit-sending
  let connectToSocketServer = () => {
    socketRef.current = io(server_url);
    if (!socketRef.current) {
      console.error("Socket connection failed");
      return;
    }

    socketRef.current.on("signal", (fromId, message) => {
      gotMessageFromServer(fromId, message);
    });

    socketRef.current.on("connect", () => {
      console.log("Connected to socket server");

      socketRef.current.emit("join-call", window.location.href);
      socketRefId.current = socketRef.current.id;
      console.log(socketRefId);

      socketRef.current.on("chat-message", addMessage);

      socketRef.current.on("user-left", (id, diffTime) => {

        if (connections.current[id]) {
          connections.current[id].close();
          delete connections.current[id];
        }
      
        setVideos((videos) => videos.filter((video) => video.socketId !== id));
      });
      

      socketRef.current.on("user-joined", async (id, clients) => {
        console.log("New user joined:", id, "All clients:", clients);

        for (let clientId of clients) {
          if (!connections.current[clientId]) {
            //new client
            const peer = new RTCPeerConnection(peerConfigConnections);

            peer.onicecandidate = (event) => {
              if (event.candidate) {
                socketRef.current.emit(
                  "signal",
                  clientId,
                  JSON.stringify({ ice: event.candidate })
                );
              }
            };

            //local stream attach
            if (!window.localStream) {
              let blackSilence = (...args) =>
                new MediaStream([black(...args), silence()]);
              window.localStream = blackSilence();
            }

            window.localStream.getTracks().forEach((track) => {
              peer.addTrack(track, window.localStream);
            });

            // Handle remote streams
            peer.ontrack = (event) => {
              setVideos((prev) => {
                const exists = prev.find(
                  (video) => video.socketId === clientId
                );
                if (exists) {
                  return prev.map((video) =>
                    video.socketId === clientId
                      ? { ...video, stream: event.streams[0] } //updated stream
                      : video
                  );
                }
                return [
                  ...prev,
                  {
                    //new stream
                    socketId: clientId,
                    stream: event.streams[0],
                    autoplay: true,
                    playsinline: true,
                  },
                ];
              });
            };

            // Save connection
            connections.current[clientId] = peer;

            // SDP offer
            if (clientId !== id) {
              try {
                const offer = await peer.createOffer();
                await peer.setLocalDescription(offer);
                socketRef.current.emit(
                  "signal",
                  clientId,
                  JSON.stringify({ sdp: offer })
                );
              } catch (err) {
                console.log(`error in sdp offer ${err}`);
              }
            }
          }
        }
      });
    });
  };

  let getMedia = () => {
    setVideo(videoAvailable); //s0-connect when btn clicked ,s1 - get permissions , s2 -get media connect and get video audio , s3 - get user media  across all screens
    setAudio(audioAvailable);
    connectToSocketServer();
  };

  let connect = () => {
    setAskForUsername(false);
    getMedia();
  };

  let getDisplayMediaSuccess = async (stream) => {
    // 1. stop any existing local track
    try {
      window.localStream?.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    // 2. set new stream
    window.localStream = stream;
    localVideoRef.current.srcObject = stream;
    setScreenAvailable(true);

    // 3.If the track end unexpectedly, mark screen as off and replace with a fake stream that looks like a black screen and silence, so the connection doesn’t break.
    stream.getTracks().forEach((track) => {
      track.onended = async () => {
        setScreen(false);
        setScreenAvailable(false);
        const blackSilence = ({ width = 640, height = 480 } = {}) => {
          return new MediaStream([black({ width, height }), silence()]);
        };
        localVideoRef.current.srcObject = blackSilence(); // swap to fake tracks
      };
    });

    // 4. update all peer connections
    for (const id in connections.current) {
      if (id === socketRefId.current) continue;

      //replace already existed tracks
      window.localStream.getTracks().forEach((track) => {
        const sender = connections.current[id]
          .getSenders()
          .find((s) => s.track && s.track.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        }
      });
    }
  };
  let getDisplayMedia = async () => {
    if (!screen || !navigator.mediaDevices.getDisplayMedia) return;
  
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
  
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
  
      const combinedStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...audioStream.getAudioTracks(),
      ]);
  
      getDisplayMediaSuccess(combinedStream);
  
    } catch (err) {
      console.log("Screen share error:", err);
      setScreen(false);
    }
  };
  

  useEffect(() => {
    if (screen !== undefined) {
      getDisplayMedia();
    }
  }, [screen]);

  let handleVideo = () => setVideo(!video);
  let handleAudio = () => setAudio(!audio);
  let handleScreen = () => setScreen(!screen);
  let handleChat = () => {
    setModal(!showModal);
  };
  useEffect(() => {
    if (showModal === true) {
      setNewMessages(0);
    }
  }, [showModal]);

  useEffect(() => {
    return () => {
      // Close all peer connections
      Object.values(connections.current).forEach((peer) => {
        peer.close();
      });
  
      connections.current = {};
  
      // Disconnect socket
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
  
      // Stop media tracks
      if (window.localStream) {
        window.localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  let handleEndCall = () => {
    try {
      let tracks = localVideoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    if (location.pathname.startsWith("/guestRoom")) {
      routeTo("/");
    } else {
      routeTo("/home");
    }
  };
  let sendMessage = () => {
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
  return (
    <AppTheme>
      <CssBaseline enableColorScheme />
      <ColorModeSelect sx={{ position: "fixed", top: "1rem", right: "1rem" }} />
      <div>
        {askForUsername === true ? (
          <div className={styles.preview}>
            <div>
              <FormControl>
                <TextField
                  error={usernameError}
                  helperText={usernameErrorMessage}
                  id="outlined-basic"
                  label="Username"
                  variant="outlined"
                  name="username"
                  color={usernameError ? "red" : "primary"}
                  onChange={(e) => {
                    setUsername(e.target.value);
                  }}
                  value={username}
                  sx={{
                    "& .MuiOutlinedInput-root.Mui-error .MuiOutlinedInput-notchedOutline":
                      {
                        borderColor: "#E53935", // border color when error
                      },
                    "& .MuiFormLabel-root.Mui-error": {
                      color: "#E53935", // label color when error
                    },
                    "& .MuiFormHelperText-root.Mui-error": {
                      color: "#E53935", // helper text color when error
                    },
                  }}
                />
              </FormControl>
              <Button
                onClick={() => {
                  if (validateInputs()) {
                    connect();
                  }
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
            <ColorModeSelect
              sx={{ position: "fixed", top: "1rem", right: "1rem" }}
            />
            {showModal && (
              <div className={styles.chatRoom}>
                <div className={styles.chatContainer}>
                  <div className={styles.chatHeading}>
                    <h2>Chat</h2>
                    <QuestionAnswerRoundedIcon />
                  </div>
                  <hr style={{ color: "gray", width: "90%", opacity: "0.2" }} />
                  <div className={styles.chattingArea}>
                    <br />
                    {messages.length > 0 ? (
                      messages.map((item, index) => {
                        return (
                          <div
                            className={
                              socketRefId.current !== item.id
                                ? styles.msgReceived
                                : styles.msgSended
                            }
                            style={{ marginBottom: "20px" }}
                            key={index}
                          >
                            <p
                              style={{
                                fontWeight: "bold",
                                fontStyle: "italic",
                              }}
                            >
                              @{item.sender}
                            </p>
                            <p className={styles.msg}>{item.data}</p>
                          </div>
                        );
                      })
                    ) : (
                      <p>No message yet.</p>
                    )}
                  </div>
                  <div className={styles.sendingArea}>
                    <TextField
                      id="outlined-basic"
                      label="Enter message"
                      variant="outlined"
                      value={message}
                      onChange={(e) => {
                        setMessage(e.target.value);
                      }}
                    />
                    <IconButton onClick={sendMessage}>
                      <SendIcon />
                    </IconButton>
                  </div>
                </div>
              </div>
            )}
            <div className={styles.buttonContainer}>
              <IconButton onClick={handleVideo}>
                {video === true ? <VideocamIcon /> : <VideocamOffIcon />}
              </IconButton>
              <IconButton onClick={handleAudio}>
                {audio === true ? <MicIcon /> : <MicOffIcon />}
              </IconButton>
              <IconButton style={{ color: "red" }} onClick={handleEndCall}>
                <CallEndIcon />
              </IconButton>
              {screenAvailable === true && (
                <IconButton onClick={handleScreen}>
                 {screen === true ? <StopScreenShareIcon /> : <ScreenShareIcon />}

                </IconButton>
              )}
              <Badge badgeContent={newMessages} color="secondary">
                <IconButton onClick={handleChat}>
                  <ChatIcon />
                </IconButton>
              </Badge>
            </div>
            <video
              className={styles.meetUserVideo}
              ref={localVideoRef}
              autoPlay
              muted //our voice can cause echo
            />
            <div className={styles.conferenceView}>
              {videos.map((video) => (
                <video
                key={video.socketId}
                  data-socket={video.socketId}
                  ref={(ref) => {
                    if (ref && video.stream) {
                      ref.srcObject = video.stream;
                    }
                  }}
                  autoPlay
                ></video>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppTheme>
  );
}

/*
Alice clicks Connect → connectToSocketServer() runs → Alice’s browser connects to localhost:8000.
Bob does the same → now both are connected to the same signaling server.
Alice’s app sends an SDP offer via socket.emit("offer", data).
Server relays it to Bob → Bob responds with an SDP answer.
ICE candidates are exchanged the same way.
Direct WebRTC connection is established → audio/video flows peer-to-peer.

Once the peers have exchanged this info, the signaling server is no longer in the media path 
— the audio/video/data flows peer-to-peer (or via TURN if needed).
*/
