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
    // Reset to "checking" state (undefined) so the UI can show a
    // pending indicator, e.g. while the user is retrying after a
    // browser permission prompt.
    setVideoAvailable(undefined);
    setAudioAvailable(undefined);

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
      // getUserMedia rejects the whole request if EITHER device is
      // denied/unavailable, even if the other one would have worked.
      // Fall back to checking each device individually so the UI can
      // tell the user exactly which permission is missing.
      let camOk = false;
      let micOk = false;

      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        camOk = true;
        camStream.getTracks().forEach((t) => t.stop());
      } catch {}

      try {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        micOk = true;
        micStream.getTracks().forEach((t) => t.stop());
      } catch {}

      setVideoAvailable(camOk);
      setAudioAvailable(micOk);
      setScreenAvailable(
        typeof navigator?.mediaDevices?.getDisplayMedia === "function"
      );

      if (!camOk && !micOk) return;

      // At least one device works - grab a combined stream (real +
      // faked-silent/black for whichever is missing) so the preview
      // and the call still function.
      try {
        const tracks = [];
        if (camOk) {
          const s = await navigator.mediaDevices.getUserMedia({ video: true });
          tracks.push(...s.getVideoTracks());
        } else {
          tracks.push(black());
        }
        if (micOk) {
          const s = await navigator.mediaDevices.getUserMedia({ audio: true });
          tracks.push(...s.getAudioTracks());
        } else {
          tracks.push(silence());
        }
        const mixedStream = new MediaStream(tracks);
        window.localStream = mixedStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mixedStream;
        }
      } catch (err) {
        console.log(err);
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Exposed so the entry screen can offer a "Retry" button after a
  // denied permission prompt, without duplicating this logic.
  return { requestPermissions: getPermissions };
}