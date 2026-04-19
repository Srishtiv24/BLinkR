import { useRef } from "react";
import { io } from "socket.io-client";

const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun2.l.google.com:19302" }],
};

export default function useSocketWebRTC({
  server_url,
  setVideos,
  addMessage,
}) {
  const connections = useRef({});
  const socketRef = useRef();
  const socketRefId = useRef();

  const gotMessageFromServer = async (fromId, message) => {
    const signal = JSON.parse(message);
    const peer = connections.current[fromId];
    if (!peer) return;

    if (signal.sdp) {
      const desc = new RTCSessionDescription(signal.sdp);

      if (desc.type === "offer") {
        await peer.setRemoteDescription(desc);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socketRef.current.emit(
          "signal",
          fromId,
          JSON.stringify({ sdp: answer })
        );
      } else if (desc.type === "answer") {
        if (peer.signalingState === "have-local-offer") {
          await peer.setRemoteDescription(desc);
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

  const connectToSocketServer = () => {
    socketRef.current = io(server_url);

    socketRef.current.on("signal", gotMessageFromServer);

    socketRef.current.on("connect", () => {
      socketRef.current.emit("join-call", window.location.href);
      socketRefId.current = socketRef.current.id;

      socketRef.current.on("chat-message", addMessage);

      socketRef.current.on("user-left", (id) => {
        if (connections.current[id]) {
          connections.current[id].close();
          delete connections.current[id];
        }

        setVideos((videos) =>
          videos.filter((video) => video.socketId !== id)
        );
      });

      socketRef.current.on("user-joined", async (id, clients) => {
        for (let clientId of clients) {
          if (!connections.current[clientId]) {
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

            // Attach local stream
            if (!window.localStream) return;

            window.localStream.getTracks().forEach((track) => {
              peer.addTrack(track, window.localStream);
            });

            peer.ontrack = (event) => {
              setVideos((prev) => {
                const exists = prev.find(
                  (video) => video.socketId === clientId
                );

                if (exists) {
                  return prev.map((video) =>
                    video.socketId === clientId
                      ? { ...video, stream: event.streams[0] }
                      : video
                  );
                }

                return [
                  ...prev,
                  {
                    socketId: clientId,
                    stream: event.streams[0],
                  },
                ];
              });
            };

            connections.current[clientId] = peer;

            // Create offer
            if (clientId !== id) {
              const offer = await peer.createOffer();
              await peer.setLocalDescription(offer);

              socketRef.current.emit(
                "signal",
                clientId,
                JSON.stringify({ sdp: offer })
              );
            }
          }
        }
      });
    });
  };

  return {
    connectToSocketServer,
    connections,
    socketRef,
    socketRefId,
  };
}