import { useEffect } from "react";

export default function useMedia({
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
}) {
  const silence = () => {
    let ctx = new AudioContext();
    let oscillator = ctx.createOscillator();
    let dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    oscillator.stop();
    return dst.stream.getAudioTracks()[0];
  };

  const black = ({ width = 640, height = 480 } = {}) => {
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

  const getPermissions = async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setVideoAvailable(false);
        setAudioAvailable(false);
        setScreenAvailable(false);
        return;
      }

      const userMediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setScreenAvailable(
        typeof navigator?.mediaDevices?.getDisplayMedia === "function"
      );

      if (userMediaStream) {
        window.localStream = userMediaStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = userMediaStream;
        }
        setVideoAvailable(true);
        setAudioAvailable(true);
      }
    } catch (e) {
      console.log(e);
    }
  };

  const getUserMediaSuccess = async (stream) => {
    try {
      window.localStream?.getTracks().forEach((track) => track.stop());
    } catch {}

    window.localStream = stream;
    localVideoRef.current.srcObject = stream;

    stream.getTracks().forEach((track) => {
      track.onended = async () => {
        setVideo(false);
        setAudio(false);
        const blackSilence = ({ width = 640, height = 480 } = {}) =>
          new MediaStream([black({ width, height }), silence()]);
        localVideoRef.current.srcObject = blackSilence();
      };
    });

    for (const id in connections.current) {
      if (id === socketRefId.current) continue;

      window.localStream.getTracks().forEach((track) => {
        const sender = connections.current[id]
          .getSenders()
          .find((s) => s.track && s.track.kind === track.kind);
        if (sender) sender.replaceTrack(track);
      });
    }
  };

  const getUserMedia = () => {
    if (video || audio) {
      navigator.mediaDevices
        .getUserMedia({ video: video, audio: audio })
        .then(getUserMediaSuccess)
        .catch(console.log);
    } else {
      try {
        let tracks = localVideoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      } catch {}
    }
  };

  const getDisplayMediaSuccess = async (stream) => {
    try {
      window.localStream?.getTracks().forEach((track) => track.stop());
    } catch {}

    window.localStream = stream;
    localVideoRef.current.srcObject = stream;

    stream.getTracks().forEach((track) => {
      track.onended = async () => {
        setScreen(false);
        const blackSilence = ({ width = 640, height = 480 } = {}) =>
          new MediaStream([black({ width, height }), silence()]);
        localVideoRef.current.srcObject = blackSilence();
      };
    });

    for (const id in connections.current) {
      if (id === socketRefId.current) continue;

      window.localStream.getTracks().forEach((track) => {
        const sender = connections.current[id]
          .getSenders()
          .find((s) => s.track && s.track.kind === track.kind);
        if (sender) sender.replaceTrack(track);
      });
    }
  };

  const getDisplayMedia = async () => {
    if (!screen || !navigator?.mediaDevices?.getDisplayMedia) {
      setScreen(false);
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      let audioStream = null;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
      } catch {}

      const combinedStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...(audioStream ? audioStream.getAudioTracks() : []),
      ]);

      getDisplayMediaSuccess(combinedStream);
    } catch {
      setScreen(false);
    }
  };

  useEffect(() => {
    getPermissions();
  }, []);

  useEffect(() => {
    if (video !== undefined || audio !== undefined) {
      getUserMedia();
    }
  }, [video, audio]);

  useEffect(() => {
    if (screen === true) {
      getDisplayMedia();
    } else if (screen === false) {
      getUserMedia();
    }
  }, [screen]);
}