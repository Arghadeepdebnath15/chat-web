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

    const {socket, axios} = useContext(AuthContext);

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

    // function to send message to selected user
    const sendMessage = async (messageData)=>{
        try {
            const {data} = await axios.post(`/api/messages/send/${selectedUser._id}`, messageData);
            if(data.success){
                setMessages((prevMessages)=>[...prevMessages, data.newMessage])
            }else{
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    }

    // function to subscribe to messages for selected user
    const subscribeToMessages = async () =>{
        if(!socket) return;

        socket.on("newMessage", (newMessage)=>{
            if(selectedUser && newMessage.senderId === selectedUser._id){
                newMessage.seen = true;
                setMessages((prevMessages)=> [...prevMessages, newMessage]);
                axios.put(`/api/messages/mark/${newMessage._id}`);
            }else{
                setUnseenMessages((prevUnseenMessages)=>( {
                    ...prevUnseenMessages, [newMessage.senderId] : prevUnseenMessages[newMessage.senderId] ? prevUnseenMessages[newMessage.senderId] + 1 : 1
                }))
            }
        })

        // Listen for messageSeen event to update single message seen status
        socket.on("messageSeen", (messageId) => {
            setMessages((prevMessages) =>
                prevMessages.map((msg) =>
                    msg._id === messageId ? { ...msg, seen: true } : msg
                )
            );
        });

        // Listen for messagesSeen event to update multiple messages seen status
        socket.on("messagesSeen", (messageIds) => {
            setMessages((prevMessages) =>
                prevMessages.map((msg) =>
                    messageIds.includes(msg._id) ? { ...msg, seen: true } : msg
                )
            );
        });

        // Typing indicator events
        socket.on("typing", ({ from }) => {
            setTypingUsers(prev => ({ ...prev, [from]: true }));
        });

        socket.on("stopTyping", ({ from }) => {
            setTypingUsers(prev => {
                const newTypingUsers = { ...prev };
                delete newTypingUsers[from];
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
    }

    // function to send typing event
    const sendTyping = () => {
        if(socket && selectedUser) {
            socket.emit("typing", { to: selectedUser._id });
        }
    }

    // function to send stop typing event
    const stopTyping = () => {
        if(socket && selectedUser) {
            socket.emit("stopTyping", { to: selectedUser._id });
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
        messages, users, selectedUser, getUsers, searchUsers, getMessages, sendMessage, setSelectedUser, unseenMessages, setUnseenMessages,
        showRightSidebar, setShowRightSidebar, toggleRightSidebar, typingUsers, sendTyping, stopTyping, loadingMessages,
        socket, incomingCall, setIncomingCall
    }

    return (
    <ChatContext.Provider value={value}>
            { children }
    </ChatContext.Provider>
    )
}