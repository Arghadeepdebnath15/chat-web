import React, { useEffect, useRef, useState, useContext } from "react";
import { ChatContext } from "../../context/ChatContext";

export default function VideoCall({ onClose, isIncoming = false, caller = null }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const { socket, selectedUser, authUser } = useContext(ChatContext);
  const [callActive, setCallActive] = useState(false);
  const [showAcceptPopup, setShowAcceptPopup] = useState(isIncoming);
  const [callingState, setCallingState] = useState(isIncoming ? 'incoming' : 'calling');
  const [pendingOffer, setPendingOffer] = useState(null);
  const hasAcceptedRef = useRef(false);
  const popupShownRef = useRef(false);

  const configuration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      // Add TURN servers here if needed
    ],
  };

  useEffect(() => {
    setShowAcceptPopup(isIncoming);
    setCallingState(isIncoming ? 'incoming' : 'calling');
  }, [isIncoming]);

  useEffect(() => {
    if (!socket || !selectedUser) return;

    let localStream;
    let callAccepted = false;
    let incomingOffer = null;

    const startCall = async () => {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
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
      if (!hasAcceptedRef.current && !popupShownRef.current) {
        setPendingOffer(offer);
        setCallingState('incoming');
        setShowAcceptPopup(true);
        popupShownRef.current = true;
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

    // Listen for call invitation
    socket.on("webrtc-call-invitation", ({ from }) => {
      console.log("Received webrtc-call-invitation from", from);
      if (!hasAcceptedRef.current && !popupShownRef.current) {
        setCallingState('incoming');
        setShowAcceptPopup(true);
        popupShownRef.current = true;
      }
    });

    // Listen for accept
    socket.on("webrtc-accept", async () => {
      console.log("Call accepted");
      setCallingState('connecting');
      await startCall();
    });

    // Listen for decline
    socket.on("webrtc-decline", () => {
      console.log("Call declined");
      setCallingState('declined');
      setTimeout(() => onClose(), 2000);
    });

    // Listen for call end
    socket.on("webrtc-call-ended", () => {
      endCall();
    });

    // Start call if this user initiated it
    if (!isIncoming) {
      socket.emit("webrtc-call-invitation", { to: selectedUser._id });
      setCallingState('calling');
    }

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

  const handleAccept = async () => {
    if (hasAcceptedRef.current) return; // Prevent multiple accepts
    hasAcceptedRef.current = true;
    setShowAcceptPopup(false);
    setCallingState('connecting');
    socket.emit("webrtc-accept", { to: selectedUser._id });
    if (pendingOffer) {
      try {
        const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
          setCallingState('connected');
        };

        peerConnectionRef.current.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("webrtc-candidate", {
              to: selectedUser._id,
              candidate: event.candidate,
            });
          }
        };

        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(pendingOffer));
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        socket.emit("webrtc-answer", {
          to: selectedUser._id,
          answer,
        });

        setCallActive(true);
        setCallingState('connected');
      } catch (error) {
        console.error("Error accepting call:", error);
        onClose();
      }
    }
  };

  const handleDecline = () => {
    socket.emit("webrtc-decline", { to: selectedUser._id });
    onClose();
  };

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
      {showAcceptPopup && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <h2 className="text-xl font-bold mb-4">Incoming Video Call</h2>
            <p className="mb-4">From: {selectedUser?.fullName}</p>
            <div className="flex gap-4">
              <button onClick={handleAccept} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition">
                Accept
              </button>
              <button onClick={handleDecline} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition">
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
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
      <div className="text-white text-center mb-4">
        {callingState === 'calling' && <p>Calling...</p>}
        {callingState === 'ringing' && <p>Ringing...</p>}
        {callingState === 'connecting' && <p>Connecting...</p>}
        {callingState === 'connected' && <p>Connected</p>}
        {callingState === 'declined' && <p>Call declined</p>}
      </div>
      <button onClick={handleHangup} className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 transition">
        Hang Up
      </button>
    </div>
  );
};
