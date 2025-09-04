# TODO: Update Friend List and Add Seen Indicators

## Tasks:
- [x] Update `getUsersForSidebar` in `server/controllers/messageController.js` to include users who have sent unread messages, even without prior chat history.
- [x] Add "seen" indicators to messages sent by the current user that have been seen by the recipient in `client/src/components/ChatContainer.jsx`.
- [ ] Test the updated endpoint to ensure users with unread messages are included in the friend list.
- [ ] Verify that unread message counters are displayed correctly in the UI.
- [ ] Test the "seen" indicators to ensure they appear correctly for seen messages.

## Notes:
- The counter functionality is already implemented in the client-side Sidebar component.
- The "seen" indicators are displayed below messages sent by the current user when `msg.seen` is true.
- The seen status is updated when messages are fetched or marked as seen via API calls.
