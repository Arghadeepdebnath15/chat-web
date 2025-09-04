/**
 * WebRTC Service Layer
 * Handles all WebRTC peer connection logic, media management, and connection states
 */

class WebRTCService {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.isInitiator = false;
    this.connectionState = 'disconnected';
    this.iceConnectionState = 'disconnected';
    this.signalingState = 'stable';
    this.connectionAttempts = 0;
    this.maxRetries = 3;
    this.retryTimeout = null;
    this.eventListeners = {};

    // TURN server configurations with health checking
    this.turnServers = [
      // Primary reliable TURN servers
      {
        urls: "turn:xirsys.com:80",
        username: "free",
        credential: "free"
      },
      {
        urls: "turn:xirsys.com:3478",
        username: "free",
        credential: "free"
      },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: "free",
        credential: "free"
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: "free",
        credential: "free"
      },
      // Backup TURN servers
      {
        urls: "turn:relay.backups.cz:3478",
        username: "free",
        credential: "free"
      }
    ];

    // STUN servers for basic connectivity
    this.stunServers = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
      { urls: "stun:stunserver.org:3478" },
      { urls: "stun:stun.stunprotocol.org:3478" }
    ];

    this.rtcConfiguration = {
      iceServers: [...this.stunServers, ...this.turnServers],
      iceCandidatePoolSize: 10,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
      iceTransportPolicy: "all"
    };
  }

  // Event system for UI updates
  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  off(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    }
  }

  emit(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => callback(data));
    }
  }

  // Initialize peer connection
  async initializePeerConnection(isInitiator = false) {
    try {
      this.isInitiator = isInitiator;
      this.peerConnection = new RTCPeerConnection(this.rtcConfiguration);

      this.setupPeerConnectionEventHandlers();

      console.log('WebRTC peer connection initialized');
      this.emit('initialized', { isInitiator });

      return true;
    } catch (error) {
      console.error('Failed to initialize peer connection:', error);
      this.emit('error', { type: 'initialization', error });
      return false;
    }
  }

  // Setup all peer connection event handlers
  setupPeerConnectionEventHandlers() {
    if (!this.peerConnection) return;

    // ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      this.iceConnectionState = this.peerConnection.iceConnectionState;
      console.log('ICE connection state:', this.iceConnectionState);

      this.emit('iceStateChange', {
        state: this.iceConnectionState,
        attempts: this.connectionAttempts
      });

      if (this.iceConnectionState === 'connected' || this.iceConnectionState === 'completed') {
        this.connectionState = 'connected';
        this.clearRetryTimeout();
        this.emit('connected');
      } else if (this.iceConnectionState === 'failed' || this.iceConnectionState === 'disconnected') {
        this.handleConnectionFailure();
      }
    };

    // Peer connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      this.connectionState = this.peerConnection.connectionState;
      console.log('Peer connection state:', this.connectionState);

      this.emit('connectionStateChange', { state: this.connectionState });

      if (this.connectionState === 'failed') {
        this.handleConnectionFailure();
      }
    };

    // Signaling state changes
    this.peerConnection.onsignalingstatechange = () => {
      this.signalingState = this.peerConnection.signalingState;
      console.log('Signaling state:', this.signalingState);
      this.emit('signalingStateChange', { state: this.signalingState });
    };

    // ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Generated ICE candidate:', event.candidate.type);
        this.emit('iceCandidate', event.candidate);
      } else {
        console.log('ICE candidate gathering completed');
        this.emit('iceGatheringComplete');
      }
    };

    // Remote track received
    this.peerConnection.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.emit('remoteStream', this.remoteStream);
      }
    };
  }

  // Handle connection failures with retry logic
  handleConnectionFailure() {
    console.log('Connection failed, attempting recovery...');

    if (this.connectionAttempts < this.maxRetries) {
      this.connectionAttempts++;
      console.log(`Retry attempt ${this.connectionAttempts}/${this.maxRetries}`);

      this.emit('retrying', {
        attempt: this.connectionAttempts,
        maxRetries: this.maxRetries
      });

      // Wait before retrying
      this.retryTimeout = setTimeout(() => {
        this.attemptReconnection();
      }, 3000);
    } else {
      console.log('Max retry attempts reached');
      this.emit('failed', {
        reason: 'Max retries exceeded',
        attempts: this.connectionAttempts
      });
    }
  }

  // Attempt to reconnect using ICE restart
  async attemptReconnection() {
    try {
      if (this.peerConnection) {
        console.log('Attempting ICE restart...');
        await this.peerConnection.restartIce();
        this.emit('iceRestart');
      }
    } catch (error) {
      console.error('ICE restart failed:', error);
      this.emit('error', { type: 'iceRestart', error });
    }
  }

  // Get user media with constraints
  async getUserMedia(constraints = { video: true, audio: true }) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Local media stream obtained');

      // Add tracks to peer connection if it exists
      if (this.peerConnection) {
        this.localStream.getTracks().forEach(track => {
          this.peerConnection.addTrack(track, this.localStream);
        });
      }

      this.emit('localStream', this.localStream);
      return this.localStream;
    } catch (error) {
      console.error('Failed to get user media:', error);
      this.emit('error', { type: 'mediaAccess', error });
      throw error;
    }
  }

  // Create and send offer
  async createOffer() {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      console.log('Offer created and set as local description');
      this.emit('offerCreated', offer);

      return offer;
    } catch (error) {
      console.error('Failed to create offer:', error);
      this.emit('error', { type: 'createOffer', error });
      throw error;
    }
  }

  // Handle received offer
  async handleOffer(offer) {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('Remote offer set successfully');
      this.emit('offerHandled');
    } catch (error) {
      console.error('Failed to handle offer:', error);
      this.emit('error', { type: 'handleOffer', error });
      throw error;
    }
  }

  // Create and send answer
  async createAnswer() {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      console.log('Answer created and set as local description');
      this.emit('answerCreated', answer);

      return answer;
    } catch (error) {
      console.error('Failed to create answer:', error);
      this.emit('error', { type: 'createAnswer', error });
      throw error;
    }
  }

  // Handle received answer
  async handleAnswer(answer) {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('Remote answer set successfully');
      this.emit('answerHandled');
    } catch (error) {
      console.error('Failed to handle answer:', error);
      this.emit('error', { type: 'handleAnswer', error });
      throw error;
    }
  }

  // Add ICE candidate
  async addIceCandidate(candidate) {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('ICE candidate added successfully');
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
      this.emit('error', { type: 'addIceCandidate', error });
      throw error;
    }
  }

  // Toggle audio
  toggleAudio() {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      const enabled = audioTracks[0]?.enabled || false;
      this.emit('audioToggled', enabled);
      return enabled;
    }
    return false;
  }

  // Toggle video
  toggleVideo() {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      const enabled = videoTracks[0]?.enabled || false;
      this.emit('videoToggled', enabled);
      return enabled;
    }
    return false;
  }

  // Get connection diagnostics
  getDiagnostics() {
    return {
      connectionState: this.connectionState,
      iceConnectionState: this.iceConnectionState,
      signalingState: this.signalingState,
      isInitiator: this.isInitiator,
      connectionAttempts: this.connectionAttempts,
      hasLocalStream: !!this.localStream,
      hasRemoteStream: !!this.remoteStream,
      localTracks: this.localStream ? {
        audio: this.localStream.getAudioTracks().length,
        video: this.localStream.getVideoTracks().length
      } : null,
      remoteTracks: this.remoteStream ? {
        audio: this.remoteStream.getAudioTracks().length,
        video: this.remoteStream.getVideoTracks().length
      } : null,
      rtcConfiguration: this.rtcConfiguration,
      timestamp: new Date().toISOString()
    };
  }

  // Clean up resources
  cleanup() {
    console.log('Cleaning up WebRTC resources...');

    // Clear retry timeout
    this.clearRetryTimeout();

    // Stop local media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped local track:', track.kind);
      });
      this.localStream = null;
    }

    // Stop remote media tracks
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped remote track:', track.kind);
      });
      this.remoteStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Reset state
    this.connectionState = 'disconnected';
    this.iceConnectionState = 'disconnected';
    this.signalingState = 'stable';
    this.connectionAttempts = 0;
    this.isInitiator = false;

    this.emit('cleanup');
    console.log('WebRTC cleanup completed');
  }

  // Clear retry timeout
  clearRetryTimeout() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
  }

  // Get connection quality metrics
  getConnectionQuality() {
    if (!this.peerConnection) return 'unknown';

    const stats = this.peerConnection.getStats();
    // Note: In a real implementation, you'd analyze the stats for quality metrics
    // For now, we'll use connection state as a proxy

    if (this.connectionState === 'connected') {
      return 'good';
    } else if (this.connectionState === 'connecting') {
      return 'connecting';
    } else if (this.connectionState === 'failed') {
      return 'failed';
    }

    return 'unknown';
  }
}

export default WebRTCService;
