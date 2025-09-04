import React, { useEffect, useRef, useState, useContext, useCallback } from "react";
import { ChatContext } from "../../context/ChatContext";

const VideoCall = ({ onClose, isIncoming = false, caller = null }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const { socket, selectedUser, authUser } = useContext(ChatContext);

  const [callState, setCallState] = useState(isIncoming ? 'incoming' : 'idle');
  const [showAcceptPopup, setShowAcceptPopup] = useState(isIncoming);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [pendingOffer, setPendingOffer] = useState(null);
  const [pendingOfferRef] = useState({ current: null });
  const [localVideoLoading, setLocalVideoLoading] = useState(true);
  const [remoteVideoLoading, setRemoteVideoLoading] = useState(true);

  // WebRTC Configuration
  const rtcConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: "turn:turn.anyfirewall.com:443?transport=tcp",
        username: "webrtc",
        credential: "webrtc"
      }
    ],
  };

  // Initialize WebRTC peer connection
  const createPeerConnection = () => {
    peerConnectionRef.current = new RTCPeerConnection(rtcConfiguration);

    // Handle ICE candidates
    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("webrtc-candidate", {
          to: selectedUser._id,
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state changes
    peerConnectionRef.current.onconnectionstatechange = () => {
      console.log("Connection state:", peerConnectionRef.current.connectionState);
      if (peerConnectionRef.current.connectionState === 'connected') {
        setCallState('connected');
      } else if (peerConnectionRef.current.connectionState === 'failed') {
        setCallState('failed');
        setTimeout(() => onClose(), 3000);
      }
    };

    // Handle remote stream
    peerConnectionRef.current.ontrack = (event) => {
      console.log("Received remote stream");
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setRemoteVideoLoading(false);
        setCallState('connected');

        // Ensure remote video plays
        remoteVideoRef.current.onloadedmetadata = () => {
          console.log("Remote video metadata loaded");
          remoteVideoRef.current.play().catch(console.error);
        };
      }
    };

    return peerConnectionRef.current;
  };

  // Get user media
  const getUserMedia = async () => {
    try {
      console.log("Requesting camera and microphone permissions...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      console.log("Permissions granted, local stream obtained");
      localStreamRef.current = stream;

      // Ensure local video element is ready and set the stream
      if (localVideoRef.current) {
        console.log("Setting local video srcObject");
        localVideoRef.current.srcObject = stream;

        // Add event listener to ensure video is loaded
        localVideoRef.current.onloadedmetadata = () => {
          console.log("Local video metadata loaded");
          setLocalVideoLoading(false);
          localVideoRef.current.play().catch(console.error);
        };

        // Force play in case autoplay is blocked
        setTimeout(() => {
          if (localVideoRef.current && localVideoRef.current.paused) {
            localVideoRef.current.play().catch(console.error);
          }
          setLocalVideoLoading(false);
        }, 100);
      } else {
        console.warn("Local video element not ready");
      }

      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      if (error.name === 'NotAllowedError') {
        alert("Camera and microphone access denied. Please allow permissions to make video calls.");
      } else {
        alert("Error accessing camera and microphone: " + error.message);
      }
      onClose();
      return null;
    }
  };

  // Start outgoing call
  const startCall = async () => {
    console.log("Starting call process...");
    setCallState('calling');

    const stream = await getUserMedia();
    if (!stream) return;

    const pc = createPeerConnection();
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    try {
      console.log("Creating WebRTC offer...");
      const offer = await pc.createOffer();
      console.log("Offer created:", offer);
      await pc.setLocalDescription(offer);
      console.log("Local description set");

      console.log("Sending offer to server for user:", selectedUser._id);
      socket.emit("webrtc-offer", {
        to: selectedUser._id,
        offer,
      });
      console.log("Offer sent to server");

      setCallState('ringing');
    } catch (error) {
      console.error("Error creating offer:", error);
      setCallState('failed');
      onClose();
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    console.log("Accepting call...");
    setShowAcceptPopup(false);
    setCallState('connecting');

    const stream = await getUserMedia();
    if (!stream) return;

    const pc = createPeerConnection();
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    try {
      console.log("Setting remote description...");
      if (!pendingOfferRef.current) {
        console.error("No pending offer available!");
        setCallState('failed');
        onClose();
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      console.log("Remote description set");

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("webrtc-answer", {
        to: selectedUser._id,
        answer,
      });

      setCallState('connected');
    } catch (error) {
      console.error("Error accepting call:", error);
      setCallState('failed');
      onClose();
    }
  };

  // Decline incoming call
  const declineCall = () => {
    socket.emit("webrtc-decline", { to: selectedUser._id });
    onClose();
  };

  // End call
  const endCall = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      localStreamRef.current = null;
    }

    if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
      remoteVideoRef.current.srcObject.getTracks().forEach(track => {
        track.stop();
      });
      remoteVideoRef.current.srcObject = null;
    }

    socket.emit("webrtc-call-ended", { to: selectedUser._id });
    onClose();
  };

  // Toggle mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  // Socket event listeners
  useEffect(() => {
    if (!socket || !selectedUser) return;

    console.log("Setting up socket listeners for video call");

    const handleOffer = ({ from, offer }) => {
      console.log("Received WebRTC offer from:", from);
      setPendingOffer(offer);
      pendingOfferRef.current = offer;
      setCallState('incoming');
      setShowAcceptPopup(true);
    };

    const handleAnswer = async ({ answer }) => {
      console.log("Received answer");
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
          console.error("Error setting remote description:", error);
        }
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      console.log("Received ICE candidate");
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }
    };

    const handleCallEnded = () => {
      console.log("Call ended by other party");
      endCall();
    };

    // Register event listeners
    socket.on("webrtc-offer", handleOffer);
    socket.on("webrtc-answer", handleAnswer);
    socket.on("webrtc-candidate", handleIceCandidate);
    socket.on("webrtc-call-ended", handleCallEnded);

    // Start call if outgoing
    if (!isIncoming) {
      console.log("Starting outgoing call to:", selectedUser._id);
      socket.emit("webrtc-call-invitation", { to: selectedUser._id });
      setCallState('calling');
    }

    // Cleanup
    return () => {
      socket.off("webrtc-offer", handleOffer);
      socket.off("webrtc-answer", handleAnswer);
      socket.off("webrtc-candidate", handleIceCandidate);
      socket.off("webrtc-call-ended", handleCallEnded);
      endCall();
    };
  }, [socket, selectedUser, isIncoming]);

  // Handle outgoing call initialization
  useEffect(() => {
    if (!isIncoming && socket && selectedUser) {
      console.log("Initializing outgoing call...");
      startCall();
    }
  }, [isIncoming, socket, selectedUser]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-50 p-4">
      {/* Accept/Decline Popup */}
      {showAcceptPopup && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white p-8 rounded-lg shadow-2xl text-center max-w-sm w-full mx-4">
            <div className="mb-6">
              <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M4 6h11a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Incoming Video Call</h2>
              <p className="text-gray-600">From: {selectedUser?.fullName}</p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={acceptCall}
                className="flex-1 bg-green-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Accept
              </button>
              <button
                onClick={declineCall}
                className="flex-1 bg-red-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Container - Side by Side Layout */}
      <div className="flex gap-6 mb-6 w-full max-w-6xl justify-center">
        {/* Local Video (Your Video) */}
        <div className="flex-1 max-w-md">
          <div className="relative bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-blue-500">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-72 object-cover"
            />
            {localVideoLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <p className="text-white text-sm">Loading camera...</p>
                </div>
              </div>
            )}
            <div className="absolute bottom-3 left-3 bg-black bg-opacity-70 text-white px-3 py-1 rounded-lg text-sm font-medium">
              You {isMuted && "(Muted)"} {isVideoOff && "(Video Off)"}
            </div>
            <div className="absolute top-3 right-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Remote Video (Other Person's Video) */}
        <div className="flex-1 max-w-md">
          <div className="relative bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-gray-600">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-72 object-cover"
            />
            <div className="absolute bottom-3 left-3 bg-black bg-opacity-70 text-white px-3 py-1 rounded-lg text-sm font-medium">
              {selectedUser?.fullName || "Remote User"}
            </div>
            {callState === 'connected' && (
              <div className="absolute top-3 right-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Call Status */}
      <div className="text-white text-center mb-6">
        {callState === 'calling' && <p className="text-lg">Calling {selectedUser?.fullName}...</p>}
        {callState === 'ringing' && <p className="text-lg">Ringing...</p>}
        {callState === 'connecting' && <p className="text-lg">Connecting...</p>}
        {callState === 'connected' && <p className="text-lg text-green-400">Connected</p>}
        {callState === 'failed' && <p className="text-lg text-red-400">Connection failed</p>}
        {callState === 'incoming' && <p className="text-lg">Incoming call...</p>}
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-4">
        {/* Mute Button */}
        <button
          onClick={toggleMute}
          className={`p-4 rounded-full transition-colors ${
            isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-600 hover:bg-gray-700'
          }`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>

        {/* Video Toggle Button */}
        <button
          onClick={toggleVideo}
          className={`p-4 rounded-full transition-colors ${
            isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-600 hover:bg-gray-700'
          }`}
          title={isVideoOff ? "Turn on video" : "Turn off video"}
        >
          {isVideoOff ? (
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M4 6h11a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M4 6h11a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" />
            </svg>
          )}
        </button>

        {/* End Call Button */}
        <button
          onClick={endCall}
          className="p-4 bg-red-500 hover:bg-red-600 rounded-full transition-colors"
          title="End call"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.684A1 1 0 008.28 3H5z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default VideoCall;
