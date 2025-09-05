# TODO: Fix Seen Indicator to Show Only When Message is Actually Seen

## Tasks
- [x] Remove automatic marking in `getMessages` controller (server/controllers/messageController.js)
- [x] Add IntersectionObserver in ChatContainer to detect visible messages (client/src/components/ChatContainer.jsx)
- [x] Update socket newMessage handler to not auto-set seen (client/context/ChatContext.jsx)
- [x] Test the functionality
- [x] Fix send button clickability issue and message duplication

## Details
- Remove updateMany in getMessages that marks all messages as seen on chat open
- Use IntersectionObserver to mark messages as seen when they enter viewport
- Modify frontend to call markMessageAsSeen API when message is visible
- Ensure seen indicator only shows for messages that have been viewed
