import React, { useEffect, useRef, useState, useContext, useCallback } from "react";
import { ChatContext } from "../../context/ChatContext";
import WebRTCService from "../lib/WebRTCService";

const VideoCallNew = ({ onClose, isIncoming = false, caller = null }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const webRTCServiceRef = useRef(null);
  const { socket, selectedUser, authUser } = useContext(ChatContext);

  // State management
  const [callState, setCallState] = useState(isIncoming ? 'incoming' : 'idle');
  const [showAcceptPopup, setShowAcceptPopup] = useState(isIncoming);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState('unknown');
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [localVideoLoading, setLocalVideoLoading] = useState(true);
  const [remoteVideoLoading, setRemoteVideoLoading] = useState(true);
  const [remoteVideoPlaying, setRemoteVideoPlaying] = useState(false);
  const [connectionDiagnostics, setConnectionDiagnostics] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [retrying, setRetrying] = useState(false);

  // Initialize WebRTC service
  useEffect(() => {
    webRTCServiceRef.current = new WebRTCService();

    // Set up event listeners
    const webrtc = webRTCServiceRef.current;

    webrtc.on('initialized', (data) => {
      console.log('WebRTC initialized:', data);
    });

    webrtc.on('localStream', (stream) => {
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        setLocalVideoLoading(false);
      }
    });

    webrtc.on('remoteStream', (stream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        setRemoteVideoLoading(false);

        // Try to play remote video
        setTimeout(() => {
          if (remoteVideoRef.current && !remoteVideoPlaying) {
            remoteVideoRef.current.play().then(() => {
              setRemoteVideoPlaying(true);
            }).catch(console.error);
          }
        }, 100);
      }
    });

    webrtc.on('connected', () => {
      setCallState('connected');
      setConnectionQuality('good');
      setErrorMessage(null);
      setRetrying(false);
    });

    webrtc.on('iceStateChange', (data) => {
      if (data.state === 'connecting') {
        setCallState('connecting');
        setConnectionQuality('connecting');
      } else if (data.state === 'failed' || data.state === 'disconnected') {
        setCallState('failed');
        setConnectionQuality('failed');
        setConnectionAttempts(data.attempts);
      }
    });

    webrtc.on('connectionStateChange', (data) => {
      if (data.state === 'failed') {
        setCallState('failed');
        setConnectionQuality('failed');
      }
    });

    webrtc.on('retrying', (data) => {
      setRetrying(true);
      setConnectionAttempts(data.attempt);
    });

    webrtc.on('failed', (data) => {
      setErrorMessage(`Connection failed: ${data.reason}`);
      setRetrying(false);
    });

    webrtc.on('error', (data) => {
      console.error('WebRTC error:', data);
      setErrorMessage(`Error: ${data.type} - ${data.error.message}`);
    });

    webrtc.on('iceCandidate', (candidate) => {
      socket.emit("webrtc-candidate", {
        to: selectedUser._id,
        candidate,
      });
    });

    webrtc.on('offerCreated', (offer) => {
      socket.emit("webrtc-offer", {
        to: selectedUser._id,
        offer,
      });
    });

    webrtc.on('answerCreated', (answer) => {
      socket.emit("webrtc-answer", {
        to: selectedUser._id,
        answer,
      });
    });

    return () => {
      // Cleanup on unmount
      if (webRTCServiceRef.current) {
        webRTCServiceRef.current.cleanup();
      }
    };
  }, [socket, selectedUser]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !selectedUser) return;

    const handleOffer = async ({ from, offer }) => {
      console.log("Received offer from:", from);
      setCallState('incoming');
      setShowAcceptPopup(true);

      // Store the offer for later use
      if (webRTCServiceRef.current) {
        try {
          await webRTCServiceRef.current.initializePeerConnection(false);
          await webRTCServiceRef.current.handleOffer(offer);
        } catch (error) {
          console.error('Failed to handle offer:', error);
          setErrorMessage('Failed to process incoming call');
        }
      }
    };

    const handleAnswer = async ({ answer }) => {
      console.log("Received answer");
      if (webRTCServiceRef.current) {
        try {
          await webRTCServiceRef.current.handleAnswer(answer);
        } catch (error) {
          console.error("Error handling answer:", error);
          setErrorMessage('Failed to process call answer');
        }
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      console.log("Received ICE candidate");
      if (webRTCServiceRef.current) {
        try {
          await webRTCServiceRef.current.addIceCandidate(candidate);
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }
    };

    const handleCallEnded = () => {
      endCall();
    };

    socket.on("webrtc-offer", handleOffer);
    socket.on("webrtc-answer", handleAnswer);
    socket.on("webrtc-candidate", handleIceCandidate);
    socket.on("webrtc-call-ended", handleCallEnded);

    if (!isIncoming) {
      socket.emit("webrtc-call-invitation", { to: selectedUser._id });
      setCallState('calling');
    }

    return () => {
      socket.off("webrtc-offer", handleOffer);
      socket.off("webrtc-answer", handleAnswer);
      socket.off("webrtc-candidate", handleIceCandidate);
      socket.off("webrtc-call-ended", handleCallEnded);
    };
  }, [socket, selectedUser, isIncoming]);

  // Start outgoing call
  const startCall = async () => {
    setCallState('calling');

    try {
      const webrtc = webRTCServiceRef.current;
      if (!webrtc) return;

      // Initialize peer connection
      const initialized = await webrtc.initializePeerConnection(true);
      if (!initialized) {
        setErrorMessage('Failed to initialize video call');
        return;
      }

      // Get user media
      await webrtc.getUserMedia();

      // Create and send offer
      await webrtc.createOffer();

      setCallState('ringing');
    } catch (error) {
      console.error('Failed to start call:', error);
      setCallState('failed');
      setErrorMessage('Failed to start video call');
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    setShowAcceptPopup(false);
    setCallState('connecting');

    try {
      const webrtc = webRTCServiceRef.current;
      if (!webrtc) return;

      // Get user media
      await webrtc.getUserMedia();

      // Create and send answer
      await webrtc.createAnswer();

      setCallState('connected');
    } catch (error) {
      console.error('Failed to accept call:', error);
      setCallState('failed');
      setErrorMessage('Failed to accept video call');
    }
  };

  // Decline incoming call
  const declineCall = () => {
    socket.emit("webrtc-decline", { to: selectedUser._id });
    onClose();
  };

  // End call
  const endCall = useCallback(() => {
    console.log("Ending call and cleaning up resources");

    if (webRTCServiceRef.current) {
      webRTCServiceRef.current.cleanup();
    }

    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Reset states
    setCallState('idle');
    setIsMuted(false);
    setIsVideoOff(false);
    setLocalVideoLoading(true);
    setRemoteVideoLoading(true);
    setRemoteVideoPlaying(false);
    setConnectionQuality('unknown');
    setConnectionAttempts(0);
    setErrorMessage(null);
    setRetrying(false);

    // Notify other peer
    socket.emit("webrtc-call-ended", { to: selectedUser._id });

    onClose();
  }, [socket, onClose]);

  // Toggle mute
  const toggleMute = () => {
    const webrtc = webRTCServiceRef.current;
    if (webrtc) {
      const muted = webrtc.toggleAudio();
      setIsMuted(!muted);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    const webrtc = webRTCServiceRef.current;
    if (webrtc) {
      const videoOff = webrtc.toggleVideo();
      setIsVideoOff(!videoOff);
    }
  };

  // Manual retry
  const manualRetry = () => {
    const webrtc = webRTCServiceRef.current;
    if (webrtc && callState === 'failed') {
      setConnectionAttempts(prev => prev + 1);
      webrtc.attemptReconnection();
      setCallState('connecting');
    }
  };

  // Run diagnostics
  const runDiagnostics = () => {
    const webrtc = webRTCServiceRef.current;
    if (webrtc) {
      const diagnostics = webrtc.getDiagnostics();
      setConnectionDiagnostics(diagnostics);
      console.log("Connection Diagnostics:", diagnostics);

      // Copy to clipboard
      navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2))
        .then(() => alert("Diagnostics copied to clipboard"))
        .catch(() => alert("Failed to copy diagnostics"));
    }
  };

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

      {/* Error Message */}
      {errorMessage && (
        <div className="absolute top-4 left-4 right-4 bg-red-500 text-white p-4 rounded-lg z-50">
          <div className="flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="ml-4 text-white hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Video Container */}
      <div className="flex gap-6 mb-6 w-full max-w-6xl justify-center">
        {/* Local Video */}
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
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75 z-50">
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
              <div className={`w-3 h-3 rounded-full ${
                callState === 'connected' ? 'bg-green-500' : 'bg-yellow-500'
              } animate-pulse`}></div>
            </div>
          </div>
        </div>

        {/* Remote Video */}
        <div className="flex-1 max-w-md">
          <div className="relative bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-gray-600">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted={false}
              className="w-full h-72 object-cover"
            />
            <div className="absolute bottom-3 left-3 bg-black bg-opacity-70 text-white px-3 py-1 rounded-lg text-sm font-medium">
              {selectedUser?.fullName || "Remote User"}
            </div>
            {callState === 'connected' && (
              <div className="absolute top-3 right-3">
                <div className={`w-3 h-3 rounded-full ${
                  connectionQuality === 'good' ? 'bg-green-500' :
                  connectionQuality === 'poor' ? 'bg-yellow-500' :
                  'bg-red-500'
                } animate-pulse`}></div>
              </div>
            )}
            {remoteVideoLoading && callState === 'connected' && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75 z-50">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-2"></div>
                  <p className="text-white text-sm">Waiting for remote video...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Call Status */}
      <div className="text-white text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          {callState === 'calling' && <p className="text-lg">Calling {selectedUser?.fullName}...</p>}
          {callState === 'ringing' && <p className="text-lg">Ringing...</p>}
          {callState === 'connecting' && <p className="text-lg">Connecting...</p>}
          {callState === 'connected' && <p className="text-lg text-green-400">Connected</p>}
          {callState === 'failed' && (
            <p className="text-lg text-red-400">
              Connection failed {connectionAttempts > 0 && `(${connectionAttempts} attempts)`}
            </p>
          )}
          {callState === 'incoming' && <p className="text-lg">Incoming call...</p>}
          {retrying && <p className="text-lg text-yellow-400">Retrying connection...</p>}
        </div>

        {/* Connection Quality Indicator */}
        {callState === 'connected' && (
          <div className="flex items-center gap-1 mb-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionQuality === 'good' ? 'bg-green-400' :
              connectionQuality === 'poor' ? 'bg-yellow-400' :
              connectionQuality === 'failed' ? 'bg-red-400' :
              'bg-gray-400'
            } animate-pulse`}></div>
            <span className="text-sm text-gray-300">
              {connectionQuality === 'good' ? 'Good' :
               connectionQuality === 'poor' ? 'Poor' :
               connectionQuality === 'failed' ? 'Failed' :
               'Connecting...'}
            </span>
          </div>
        )}
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

        {/* Retry Button (only show when failed) */}
        {callState === 'failed' && (
          <button
            onClick={manualRetry}
            className="p-3 bg-orange-500 hover:bg-orange-600 rounded-full transition-colors"
            title="Retry Connection"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}

        {/* Diagnostics Button */}
        <button
          onClick={runDiagnostics}
          className="p-3 bg-yellow-500 hover:bg-yellow-600 rounded-full transition-colors"
          title="Run Connection Diagnostics"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
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

export default VideoCallNew;
