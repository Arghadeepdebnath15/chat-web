# TODO: Update Friend List to Include Users with Unread Messages

## Tasks:
- [x] Update `getUsersForSidebar` in `server/controllers/messageController.js` to include users who have sent unread messages, even without prior chat history.
- [ ] Test the updated endpoint to ensure users with unread messages are included in the friend list.
- [ ] Verify that unread message counters are displayed correctly in the UI.

## Notes:
- The counter functionality is already implemented in the client-side Sidebar component.
- Only the server-side logic needs to be updated to fetch the correct set of users.
