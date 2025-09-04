# Video Calling Feature Fixes

## Issues Identified
- Event name inconsistencies between client and server
- Signaling flow problems with invitation/offer handling
- Outdated TURN servers causing connection failures
- Complex autoplay handling failing on some browsers
- State management conflicts

## Tasks to Complete

### 1. Fix Server-Side Event Names (server/server.js)
- [x] Change "webrtc-accept" to "webrtc-call-accept"
- [x] Change "webrtc-decline" to "webrtc-call-decline"
- [x] Ensure all WebRTC events are properly forwarded

### 2. Update Client-Side Signaling (client/src/components/VideoCall.jsx)
- [x] Fix event emission for accept/decline to match server
- [x] Simplify the call initiation flow
- [x] Add proper handlers for call-accept and call-decline
- [x] Improve error handling and connection states

### 3. Update TURN Servers
- [x] Replace outdated TURN servers with working public ones
- [x] Add fallback STUN servers
- [x] Test connectivity with different server combinations

### 4. Improve Video Playback
- [x] Simplify autoplay handling for both local and remote videos
- [x] Add better user interaction prompts
- [x] Ensure videos play on both desktop and mobile

### 5. Fix State Management
- [x] Align VideoCall component state with ChatContext
- [x] Ensure proper cleanup on call end
- [x] Handle incoming calls properly

### 6. Testing
- [ ] Test outgoing calls
- [ ] Test incoming calls
- [ ] Test call acceptance/decline
- [ ] Test video display on both sides
- [ ] Test on different browsers/devices
