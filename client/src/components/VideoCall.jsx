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
  const [connectionDiagnostics, setConnectionDiagnostics] = useState(null);
  const [connectionQuality, setConnectionQuality] = useState('unknown');
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [retryTimeout, setRetryTimeout] = useState(null);
  const [remoteVideoPlaying, setRemoteVideoPlaying] = useState(false);

  // WebRTC Configuration with updated reliable TURN servers
  const rtcConfiguration = {
    iceServers: [
      // Primary STUN servers (Google's reliable STUN servers)
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },

      // Additional STUN servers for better coverage
      { urls: "stun:stun.stunprotocol.org:3478" },
      { urls: "stun:stun.nextcloud.com:443" },

      // Reliable TURN servers (updated with working public servers)
      // Open Relay Project - Free TURN servers with good reliability
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject"
      },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject"
      },
      {
        urls: "turn:openrelay.metered.ca:443?transport=tcp",
        username: "openrelayproject",
        credential: "openrelayproject"
      },

      // Alternative free TURN servers
      {
        urls: "turn:relay.metered.ca:80",
        username: "free",
        credential: "free"
      },
      {
        urls: "turn:relay.metered.ca:443",
        username: "free",
        credential: "free"
      },
      {
        urls: "turn:relay.metered.ca:443?transport=tcp",
        username: "free",
        credential: "free"
      },

      // Fallback TURN servers (may have limitations)
      {
        urls: "turn:turn.bistri.com:80",
        username: "homeo",
        credential: "homeo"
      },
      {
        urls: "turn:turn.anyfirewall.com:443?transport=tcp",
        username: "webrtc",
        credential: "webrtc"
      }
    ],
    iceCandidatePoolSize: 10,
    // Additional configuration for better connectivity
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
    // Enable ICE restart for better recovery
    iceTransportPolicy: "all"
  };

  // Initialize WebRTC peer connection with enhanced configuration
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(rtcConfiguration);

    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("webrtc-candidate", {
          to: selectedUser._id,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("Received remote track:", event.track.kind, "from stream:", event.streams[0]?.id);

      if (remoteVideoRef.current && event.streams[0]) {
        console.log("Setting remote video srcObject with stream:", event.streams[0].id);

        // Clear any existing srcObject first
        if (remoteVideoRef.current.srcObject) {
          remoteVideoRef.current.srcObject = null;
        }

        // Set the new stream
        remoteVideoRef.current.srcObject = event.streams[0];

        // Force a reload of the video element
        remoteVideoRef.current.load();

        // Try to play the video with a small delay to ensure the stream is ready
        setTimeout(() => {
          if (remoteVideoRef.current && remoteVideoRef.current.srcObject && !remoteVideoPlaying) {
            // Ensure video is not already playing to avoid conflicts
            if (remoteVideoRef.current.paused || remoteVideoRef.current.ended) {
              const playPromise = remoteVideoRef.current.play();
              if (playPromise !== undefined) {
                playPromise.then(() => {
                  console.log("Remote video playing successfully");
                  setRemoteVideoPlaying(true);
                  setRemoteVideoLoading(false);
                }).catch(error => {
                  console.log("Autoplay blocked for remote video:", error);
                  // Even if autoplay is blocked, the video element should still show the stream
                  // The user can manually click to play if needed
                  setRemoteVideoLoading(false);
                });
              } else {
                // If play() returns undefined, video should still work
                setRemoteVideoPlaying(true);
                setRemoteVideoLoading(false);
              }
            } else {
              console.log("Remote video already playing");
              setRemoteVideoPlaying(true);
              setRemoteVideoLoading(false);
            }
          }
        }, 100);
      } else {
        console.log("Remote video ref not ready or no stream received");
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state changed:", pc.iceConnectionState);
      console.log("Peer connection state:", pc.connectionState);
      console.log("Signaling state:", pc.signalingState);

      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        console.log("ICE connection established successfully");
        setCallState('connected');
        setConnectionQuality('good');
        // Clear any pending retry timeout on successful connection
        if (retryTimeout) {
          clearTimeout(retryTimeout);
          setRetryTimeout(null);
        }
      } else if (pc.iceConnectionState === 'connecting') {
        console.log("ICE connecting...");
        setCallState('connecting');
        setConnectionQuality('connecting');
      } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        console.log("ICE connection failed or disconnected");
        console.log("This may indicate TURN server issues or network problems");
        setCallState('failed');
        setConnectionQuality('failed');

        // Log additional diagnostic information
        console.log("Current ICE gathering state:", pc.iceGatheringState);
        console.log("Local ICE candidates count:", pc.getSenders().length);
        console.log("Remote ICE candidates count:", pc.getReceivers().length);

        // Don't automatically close the call - let user decide
        // setTimeout(() => onClose(), 3000);

        // Retry connection after delay if attempts < 3
        if (connectionAttempts < 3) {
          const timeout = setTimeout(() => {
            console.log("Retrying connection attempt", connectionAttempts + 1);
            setConnectionAttempts(prev => prev + 1);
            if (peerConnectionRef.current) {
              try {
                peerConnectionRef.current.restartIce();
                console.log("ICE restart initiated");
              } catch (error) {
                console.error("Failed to restart ICE:", error);
              }
            }
          }, 5000);
          setRetryTimeout(timeout);
        } else {
          console.log("Max retry attempts reached. Connection failed.");
        }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Peer connection state changed:", pc.connectionState);
      if (pc.connectionState === 'failed') {
        console.log("Peer connection failed - this may indicate TURN server issues");
        setConnectionQuality('failed');
        setCallState('failed');
        // Don't automatically close the call - let user decide
        // setTimeout(() => onClose(), 3000);
      } else if (pc.connectionState === 'connected') {
        console.log("Peer connection established successfully");
        setCallState('connected');
        setConnectionQuality('good');
      } else if (pc.connectionState === 'disconnected') {
        console.log("Peer connection disconnected");
        setConnectionQuality('poor');
      } else if (pc.connectionState === 'connecting') {
        console.log("Peer connection connecting...");
        setConnectionQuality('connecting');
      }
    };

    return pc;
  };

  // Get user media with device-specific optimizations
  const getUserMedia = async () => {
    try {
      const constraints = {
        video: true,
        audio: true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;

        // Try to play the local video
        const playPromise = localVideoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log("Local video playing successfully");
            setLocalVideoLoading(false);
          }).catch(error => {
            console.log("Autoplay blocked for local video:", error);
            setLocalVideoLoading(false);
            // For local video, we can show a play button
            setCallState('local-autoplay-blocked');
          });
        } else {
          setLocalVideoLoading(false);
        }
      }

      return stream;
    } catch (error) {
      alert("Error accessing camera and microphone: " + error.message);
      onClose();
      return null;
    }
  };

  // Start outgoing call
  const startCall = async () => {
    setCallState('calling');

    const stream = await getUserMedia();
    if (!stream) return;

    const pc = createPeerConnection();
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("webrtc-offer", {
        to: selectedUser._id,
        offer,
      });

      setCallState('ringing');
    } catch (error) {
      setCallState('failed');
      onClose();
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    setShowAcceptPopup(false);
    setCallState('connecting');

    const stream = await getUserMedia();
    if (!stream) return;

    const pc = createPeerConnection();
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    try {
      if (!pendingOfferRef.current) {
        setCallState('failed');
        onClose();
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("webrtc-accept", {
        to: selectedUser._id,
      });

      socket.emit("webrtc-answer", {
        to: selectedUser._id,
        answer,
      });

      setCallState('connected');
    } catch (error) {
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
    console.log("Ending call and cleaning up resources");

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log("Stopped local track:", track.kind);
      });
      localStreamRef.current = null;
    }

    // Clear remote video with proper cleanup
    if (remoteVideoRef.current) {
      try {
        // Pause the video element first to prevent autoplay conflicts
        remoteVideoRef.current.pause();

        if (remoteVideoRef.current.srcObject) {
          remoteVideoRef.current.srcObject.getTracks().forEach(track => {
            track.stop();
            console.log("Stopped remote track:", track.kind);
          });
          remoteVideoRef.current.srcObject = null;
        }

        // Reset video element state
        remoteVideoRef.current.load();
      } catch (error) {
        console.log("Error during remote video cleanup:", error);
        // Force cleanup even if there's an error
        if (remoteVideoRef.current.srcObject) {
          remoteVideoRef.current.srcObject = null;
        }
      }
    }

    // Clear any pending retry timeout
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      setRetryTimeout(null);
    }

    // Reset all states
    setCallState('idle');
    setIsMuted(false);
    setIsVideoOff(false);
    setLocalVideoLoading(true);
    setRemoteVideoLoading(true);
    setRemoteVideoPlaying(false);
    setPendingOffer(null);
    setConnectionQuality('unknown');
    setConnectionAttempts(0);

    // Notify other peer
    socket.emit("webrtc-call-ended", { to: selectedUser._id });

    // Close the component
    onClose();
  };

  // Toggle mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => (track.enabled = !track.enabled));
      setIsMuted(!isMuted);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => (track.enabled = !track.enabled));
      setIsVideoOff(!isVideoOff);
    }
  };

  // Run connection diagnostics
  const runDiagnostics = () => {
    const diagnostics = {
      userAgent: navigator.userAgent,
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
      hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
      hasRTCPeerConnection: !!window.RTCPeerConnection,
      connectionState: peerConnectionRef.current?.connectionState || 'Not connected',
      iceConnectionState: peerConnectionRef.current?.iceConnectionState || 'Not connected',
      iceGatheringState: peerConnectionRef.current?.iceGatheringState || 'Not connected',
      connectionQuality: connectionQuality,
      connectionAttempts: connectionAttempts,
      signalingState: peerConnectionRef.current?.signalingState || 'Not connected',
      localStreamTracks: localStreamRef.current ? {
        video: localStreamRef.current.getVideoTracks().length,
        audio: localStreamRef.current.getAudioTracks().length,
        videoEnabled: localStreamRef.current.getVideoTracks()[0]?.enabled,
        audioEnabled: localStreamRef.current.getAudioTracks()[0]?.enabled
      } : null,
      remoteStreamTracks: remoteVideoRef.current?.srcObject ? {
        video: remoteVideoRef.current.srcObject.getVideoTracks().length,
        audio: remoteVideoRef.current.srcObject.getAudioTracks().length,
        videoEnabled: remoteVideoRef.current.srcObject.getVideoTracks()[0]?.enabled,
        audioEnabled: remoteVideoRef.current.srcObject.getAudioTracks()[0]?.enabled
      } : null,
      rtcConfiguration: rtcConfiguration,
      timestamp: new Date().toISOString(),
      troubleshooting: {
        issue: "ICE connection failing on laptops",
        possibleCauses: [
          "TURN server authentication failed",
          "Network firewall blocking TURN traffic",
          "TURN server is down or rate limited",
          "NAT traversal issues",
          "Browser WebRTC policy restrictions"
        ],
        recommendations: [
          "Try different network (WiFi vs mobile data)",
          "Disable VPN if active",
          "Check firewall settings",
          "Try incognito/private browsing mode",
          "Update browser to latest version"
        ]
      }
    };

    setConnectionDiagnostics(diagnostics);
    console.log("Connection Diagnostics:", diagnostics);

    // Copy diagnostics to clipboard for troubleshooting
    navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2))
      .then(() => {
        console.log("Diagnostics copied to clipboard");
        alert("Diagnostics copied to clipboard. Please share this information for troubleshooting.");
      })
      .catch(() => {
        console.log("Failed to copy diagnostics");
        alert("Failed to copy diagnostics. Please check browser console for details.");
      });
  };

  // Socket event listeners
  useEffect(() => {
    if (!socket || !selectedUser) return;

    const handleOffer = ({ from, offer }) => {
      console.log("Received offer from:", from);
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
          console.log("Remote description set successfully");
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
          console.log("ICE candidate added successfully");
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
      // Only end call if component is unmounting, not just when useEffect re-runs
      if (!isIncoming) {
        endCall();
      }
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
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75 z-50">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <p className="text-white text-sm">Loading camera...</p>
                </div>
              </div>
            )}
            {callState === 'local-autoplay-blocked' && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75 z-50">
                <div className="text-center">
                  <button
                    onClick={() => {
                      if (localVideoRef.current) {
                        localVideoRef.current.play().then(() => {
                          setCallState('connected');
                        }).catch(console.error);
                      }
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg mb-2"
                  >
                    <svg className="w-6 h-6 inline mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    Enable Camera
                  </button>
                  <p className="text-white text-sm">Click to enable your camera</p>
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
              muted={false}
              className="w-full h-72 object-cover"
              onLoadedData={() => {
                console.log("Remote video loaded data successfully");
                setRemoteVideoLoading(false);
              }}
              onCanPlay={() => {
                console.log("Remote video can play");
              }}
              onError={(e) => {
                console.error("Remote video error:", e);
              }}
            />
            <div className="absolute bottom-3 left-3 bg-black bg-opacity-70 text-white px-3 py-1 rounded-lg text-sm font-medium">
              {selectedUser?.fullName || "Remote User"}
            </div>
            {callState === 'connected' && (
              <div className="absolute top-3 right-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
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

            {/* Manual play button for remote video if autoplay is blocked */}
            {callState === 'connected' && remoteVideoRef.current?.srcObject && remoteVideoRef.current?.paused && (
              <div className="absolute bottom-4 right-4 z-40">
                <button
                  onClick={async () => {
                    if (remoteVideoRef.current) {
                      try {
                        // Check if video is already playing to avoid conflicts
                        if (!remoteVideoRef.current.paused && !remoteVideoRef.current.ended) {
                          console.log("Remote video already playing");
                          return;
                        }

                        const playPromise = remoteVideoRef.current.play();
                        if (playPromise !== undefined) {
                          await playPromise;
                          console.log("Remote video manually started");
                          setRemoteVideoPlaying(true);
                        }
                      } catch (error) {
                        console.error("Manual play failed:", error);
                      }
                    }
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm shadow-lg transition-colors"
                  title="Enable remote video"
                >
                  <svg className="w-5 h-5 inline mr-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  Play Remote
                </button>
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
          {callState === 'failed' && connectionAttempts < 3 && <p className="text-lg text-red-400">Connection failed - Click retry to try again</p>}
          {callState === 'failed' && connectionAttempts >= 3 && <p className="text-lg text-red-400">Connection failed - Please try a new call</p>}
          {callState === 'incoming' && <p className="text-lg">Incoming call...</p>}
          {callState === 'connected' && !remoteVideoRef.current?.srcObject && <p className="text-lg text-yellow-400">Waiting for remote video stream...</p>}
          {callState === 'local-autoplay-blocked' && <p className="text-lg text-yellow-400">Click to enable camera</p>}

          {/* Connection Quality Indicator */}
          {callState === 'connected' && (
            <div className="flex items-center gap-1">
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

        {/* Connection Attempts Counter */}
        {connectionAttempts > 0 && (
          <p className="text-xs text-gray-400">
            Connection attempts: {connectionAttempts}
            {retryTimeout && connectionAttempts < 3 && (
              <span className="ml-2 text-yellow-400">Retrying in 5 seconds...</span>
            )}
          </p>
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

        {/* Retry Connection Button (only show when failed) */}
        {callState === 'failed' && connectionAttempts < 3 && (
          <button
            onClick={() => {
              console.log("Manual retry initiated");
              setConnectionAttempts(prev => prev + 1);
              if (peerConnectionRef.current) {
                peerConnectionRef.current.restartIce();
              }
              setCallState('connecting');
            }}
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

export default VideoCall;
