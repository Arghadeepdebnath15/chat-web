import React, { useEffect, useRef, useState, useContext } from "react";
import { ChatContext } from "../../context/ChatContext";

const VideoCall = ({ onClose }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const { socket, selectedUser, authUser } = useContext(ChatContext);
  const [callActive, setCallActive] = useState(false);

  const configuration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      // Add TURN servers here if needed
    ],
  };

  useEffect(() => {
    if (!socket || !selectedUser) return;

    let localStream;

    const startCall = async () => {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }
        // Check if audio track is enabled
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length === 0) {
          console.warn("No audio tracks found in local stream");
        } else {
          console.log("Audio tracks found:", audioTracks);
          audioTracks.forEach(track => {
            console.log(`Track kind: ${track.kind}, enabled: ${track.enabled}`);
          });
        }

        peerConnectionRef.current = new RTCPeerConnection(configuration);

        // Add local tracks to peer connection
        localStream.getTracks().forEach((track) => {
          peerConnectionRef.current.addTrack(track, localStream);
        });

        // Handle remote stream
        peerConnectionRef.current.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        // Handle ICE candidates
        peerConnectionRef.current.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("webrtc-candidate", {
              to: selectedUser._id,
              candidate: event.candidate,
            });
          }
        };

        // Create offer
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);

        socket.emit("webrtc-offer", {
          to: selectedUser._id,
          offer,
        });

        setCallActive(true);
      } catch (error) {
        console.error("Error starting call:", error);
        onClose();
      }
    };

    // Listen for answer
    socket.on("webrtc-answer", async ({ answer }) => {
      console.log("Received webrtc-answer", answer);
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    // Listen for offer
    socket.on("webrtc-offer", async ({ from, offer }) => {
      console.log("Received webrtc-offer from", from, offer);
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

        peerConnectionRef.current = new RTCPeerConnection(configuration);

        localStream.getTracks().forEach((track) => {
          peerConnectionRef.current.addTrack(track, localStream);
        });

        peerConnectionRef.current.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        peerConnectionRef.current.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("webrtc-candidate", {
              to: from,
              candidate: event.candidate,
            });
          }
        };

        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        socket.emit("webrtc-answer", {
          to: from,
          answer,
        });

        setCallActive(true);
      } catch (error) {
        console.error("Error handling offer:", error);
        onClose();
      }
    });

    // Listen for ICE candidates
    socket.on("webrtc-candidate", async ({ candidate }) => {
      try {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (error) {
        console.error("Error adding received ICE candidate", error);
      }
    });

    // Listen for call end
    socket.on("webrtc-call-ended", () => {
      endCall();
    });

    // Start call if this user initiated it
    startCall();

    const endCall = () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        localVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
        remoteVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
        remoteVideoRef.current.srcObject = null;
      }
      setCallActive(false);
      onClose();
    };

    return () => {
      endCall();
      socket.off("webrtc-answer");
      socket.off("webrtc-offer");
      socket.off("webrtc-candidate");
      socket.off("webrtc-call-ended");
    };
  }, [socket, selectedUser]);

  const handleHangup = () => {
    if (socket && selectedUser) {
      socket.emit("webrtc-call-ended", { to: selectedUser._id });
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      localVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
      remoteVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      remoteVideoRef.current.srcObject = null;
    }
    setCallActive(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-50 p-4">
      <div className="flex gap-4 mb-4">
        <div>
          <p className="text-white text-center mb-2">You</p>
          <video ref={localVideoRef} autoPlay muted playsInline className="w-48 h-36 rounded-md bg-black" />
        </div>
        <div>
          <p className="text-white text-center mb-2">Remote</p>
          <video ref={remoteVideoRef} autoPlay playsInline className="w-48 h-36 rounded-md bg-black" />
        </div>
      </div>
      <button onClick={handleHangup} className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 transition">
        Hang Up
      </button>
    </div>
  );
};

export default VideoCall;
