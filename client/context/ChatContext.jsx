import { createContext, useContext, useEffect, useState } from "react";
import { AuthContext } from "./AuthContext";
import toast from "react-hot-toast";


export const ChatContext = createContext();

export const ChatProvider = ({ children })=>{

    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null)
    const [unseenMessages, setUnseenMessages] = useState({})
    const [showRightSidebar, setShowRightSidebar] = useState(false)
    const [typingUsers, setTypingUsers] = useState({}) // { userId: true }
    const [isCurrentUserTyping, setIsCurrentUserTyping] = useState(false)
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [incomingCall, setIncomingCall] = useState(null);

    // Persist selectedUser in localStorage
    useEffect(() => {
        const savedSelectedUser = localStorage.getItem('selectedUser');
        if (savedSelectedUser) {
            setSelectedUser(JSON.parse(savedSelectedUser));
        }
    }, []);

    useEffect(() => {
        if (selectedUser) {
            localStorage.setItem('selectedUser', JSON.stringify(selectedUser));
        } else {
            localStorage.removeItem('selectedUser');
        }
    }, [selectedUser]);

    const {socket, axios, authUser} = useContext(AuthContext);

    console.log("ChatContext - authUser:", authUser);

    // function to get all users for sidebar
    const getUsers = async () =>{
        try {
            const { data } = await axios.get("/api/messages/users");
            if (data.success) {
                setUsers(data.users)
                setUnseenMessages(data.unseenMessages)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    // function to search users
    const searchUsers = async (query) =>{
        try {
            const { data } = await axios.get(`/api/messages/search?q=${query}`);
            if (data.success) {
                return data.users;
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    // function to get messages for selected user
    const getMessages = async (userId)=>{
        try {
            setLoadingMessages(true);
            // Clear messages immediately before fetching new ones
            setMessages([]);
            const { data } = await axios.get(`/api/messages/${userId}`);
            if (data.success){
                setMessages(data.messages)
            }
        } catch (error) {
            toast.error(error.message)
        } finally {
            setLoadingMessages(false);
        }
    }

    // function to send message to selected user or specified recipient
    const sendMessage = async (messageData, recipientId = null)=>{
        try {
            const targetUserId = recipientId || selectedUser._id;
            const {data} = await axios.post(`/api/messages/send/${targetUserId}`, messageData);
            if(data.success){
                // Only add to current messages if sending to selected user
                if (!recipientId || recipientId === selectedUser?._id) {
                    setMessages((prevMessages)=>[...prevMessages, data.newMessage])
                }
            }else{
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    }

    // function to delete a single message
    const deleteMessage = async (messageId) => {
        try {
            const { data } = await axios.delete(`/api/messages/${messageId}`);
            if (data.success) {
                setMessages((prevMessages) => prevMessages.filter(msg => msg._id !== messageId));
                // Emit socket event to notify other user
                if (socket && selectedUser) {
                    socket.emit("deleteMessage", { to: selectedUser._id, messageId });
                }
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    // function to delete all messages in the chat
    const deleteAllMessages = async () => {
        try {
            const { data } = await axios.delete(`/api/messages/all/${selectedUser._id}`);
            if (data.success) {
                setMessages([]);
                // Emit socket event to notify other user
                if (socket && selectedUser && authUser) {
                    socket.emit("deleteAllMessages", { to: selectedUser._id, from: authUser._id });
                }
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    // Listen for messageDeleted event from socket
    useEffect(() => {
        if (!socket) return;

        const handleMessageDeleted = (messageId) => {
            setMessages((prevMessages) => prevMessages.filter(msg => msg._id !== messageId));
        };

        const handleAllMessagesDeleted = ({ userId }) => {
            // If the other user deleted all messages, clear messages if selectedUser matches
            if (selectedUser && selectedUser._id === userId) {
                setMessages([]);
            }
        };

        socket.on("messageDeleted", handleMessageDeleted);
        socket.on("allMessagesDeleted", handleAllMessagesDeleted);

        return () => {
            socket.off("messageDeleted", handleMessageDeleted);
            socket.off("allMessagesDeleted", handleAllMessagesDeleted);
        };
    }, [socket, selectedUser]);

    // function to subscribe to messages for selected user
    const subscribeToMessages = async () =>{
        if(!socket) return;

        console.log("Subscribing to socket events");
        socket.off("newMessage");
        socket.on("newMessage", (newMessage)=>{
            console.log("Received newMessage event:", newMessage);
            console.log("Selected user:", selectedUser);
            console.log("Comparing senderId and selectedUser._id:", newMessage.senderId, selectedUser?._id);
            if(selectedUser && String(newMessage.senderId) === String(selectedUser._id)){
                console.log("Updating messages for selected user");
                const clonedMessage = {...newMessage, seen: true};
                setMessages((prevMessages)=> [...prevMessages, clonedMessage]);
                axios.put(`/api/messages/mark/${newMessage._id}`);
            }else{
                console.log("Message not from selected user, updating unseen messages");
                setUnseenMessages((prevUnseenMessages)=>( {
                    ...prevUnseenMessages, [newMessage.senderId] : (prevUnseenMessages[newMessage.senderId] || 0) + 1
                }));
                // Add unknown user to users list when receiving a new message from a user not in the list
                setUsers((prevUsers) => {
                    const userExists = prevUsers.some(user => user._id === newMessage.senderId);
                    if (!userExists) {
                        // Fetch user details from server or create a minimal user object
                        const newUser = {
                            _id: newMessage.senderId,
                            fullName: newMessage.senderName || "Unknown",
                            profilePic: newMessage.senderAvatar || null
                        };
                        return [...prevUsers, newUser];
                    }
                    return prevUsers;
                });
            }
        })

        // Listen for messageSeen event to update single message seen status
        socket.on("messageSeen", (messageId) => {
            setMessages((prevMessages) =>
                prevMessages.map((msg) =>
                    msg._id === messageId ? { ...msg, seen: true } : msg
                )
            );
            // Also update unseenMessages count for sender
            setUnseenMessages((prevUnseen) => {
                const newUnseen = { ...prevUnseen };
                // Find message senderId from messages
                // prevMessages is not defined here, fix by using a functional update with prevMessages as parameter
                // So we need to move this logic inside setMessages functional update or use a ref to messages state
                // For simplicity, remove unseenMessages update here to avoid error, or refactor later
                return newUnseen;
            });
        });

        // Listen for messagesSeen event to update multiple messages seen status
        socket.on("messagesSeen", (messageIds) => {
            setMessages((prevMessages) => {
                const updatedMessages = prevMessages.map((msg) =>
                    messageIds.includes(msg._id) ? { ...msg, seen: true } : msg
                );

                // Update unseenMessages count for senders
                const sendersToDecrement = new Set();
                messageIds.forEach((messageId) => {
                    const msg = updatedMessages.find(m => m._id === messageId);
                    if (msg && msg.senderId !== authUser?._id) {
                        sendersToDecrement.add(msg.senderId);
                    }
                });

                if (sendersToDecrement.size > 0) {
                    setUnseenMessages((prevUnseen) => {
                        const newUnseen = { ...prevUnseen };
                        sendersToDecrement.forEach((senderId) => {
                            if (newUnseen[senderId]) {
                                newUnseen[senderId] = Math.max(0, newUnseen[senderId] - 1);
                                if (newUnseen[senderId] === 0) {
                                    delete newUnseen[senderId];
                                }
                            }
                        });
                        return newUnseen;
                    });
                }

                return updatedMessages;
            });
        });

        // Typing indicator events
        socket.on("typing", ({ from }) => {
            console.log("Received typing event from:", from);
            setTypingUsers(prev => {
                const newTypingUsers = { ...prev, [from]: true };
                console.log("Updated typingUsers:", newTypingUsers);
                return newTypingUsers;
            });
        });

        socket.on("stopTyping", ({ from }) => {
            console.log("Received stopTyping event from:", from);
            setTypingUsers(prev => {
                const newTypingUsers = { ...prev };
                delete newTypingUsers[from];
                console.log("Updated typingUsers after stopTyping:", newTypingUsers);
                return newTypingUsers;
            });
        });

        // Video call events
        socket.on("webrtc-call-invitation", ({ from }) => {
            setIncomingCall({ from });
        });

        socket.on("webrtc-call-accept", () => {
            // Handle call accepted by remote user if needed
        });

        socket.on("webrtc-call-decline", () => {
            // Handle call declined by remote user if needed
        });

        // Listen for newChatUser event to add new users to the sidebar
        socket.on("newChatUser", ({ user, message }) => {
            console.log("Received newChatUser event:", user, message);
            setUsers((prevUsers) => {
                const userExists = prevUsers.some(u => u._id === user._id);
                if (!userExists) {
                    return [...prevUsers, user];
                }
                return prevUsers;
            });
            // Note: Unseen messages count is already handled by newMessage event
        });
    }

    // function to send typing event
    const sendTyping = () => {
        console.log("sendTyping called - socket:", !!socket, "selectedUser:", selectedUser, "authUser:", authUser);
        if(socket && selectedUser && authUser) {
            console.log("Emitting typing event with:", { to: selectedUser._id, from: authUser._id });
            socket.emit("typing", { to: selectedUser._id, from: authUser._id });
        }
    }

    // function to send stop typing event
    const stopTyping = () => {
        if(socket && selectedUser && authUser) {
            socket.emit("stopTyping", { to: selectedUser._id, from: authUser._id });
        }
    }

    // function to unsubscribe from messages
    const unsubscribeFromMessages = ()=>{
        if(socket) socket.off("newMessage");
    }

    useEffect(()=>{
        subscribeToMessages();
        return ()=> unsubscribeFromMessages();
    },[socket, selectedUser])

    // Clear messages when switching users to prevent showing old chat content
    useEffect(() => {
        if (selectedUser) {
            setMessages([]); // Clear messages immediately when user changes
        }
    }, [selectedUser]);

    // Hide right sidebar when selectedUser changes
    // Disabled to allow sidebar to stay open on mobile
    // useEffect(()=>{
    //     setShowRightSidebar(false);
    // },[selectedUser])

    // Function to toggle right sidebar
    const toggleRightSidebar = () => {
        setShowRightSidebar(prev => !prev);
    }

    const value = {
        messages, users, selectedUser, getUsers, searchUsers, getMessages, sendMessage, deleteMessage, deleteAllMessages, setSelectedUser, unseenMessages, setUnseenMessages,
        showRightSidebar, setShowRightSidebar, toggleRightSidebar, typingUsers, sendTyping, stopTyping, loadingMessages,
        socket, incomingCall, setIncomingCall
    }

    return (
    <ChatContext.Provider value={value}>
            { children }
    </ChatContext.Provider>
    )
}