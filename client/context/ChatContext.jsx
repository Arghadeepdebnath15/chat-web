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

    // function to get messages for selected user
    const getMessages = async (userId)=>{
        try {
            const { data } = await axios.get(`/api/messages/${userId}`);
            if (data.success){
                setMessages(data.messages)
            }
        } catch (error) {
            toast.error(error.message)
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
                setUnseenMessages((prevUnseenMessages)=>({
                    ...prevUnseenMessages, [newMessage.senderId] : prevUnseenMessages[newMessage.senderId] ? prevUnseenMessages[newMessage.senderId] + 1 : 1
                }))
            }
        })

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
        messages, users, selectedUser, getUsers, getMessages, sendMessage, setSelectedUser, unseenMessages, setUnseenMessages,
        showRightSidebar, setShowRightSidebar, toggleRightSidebar, typingUsers, sendTyping, stopTyping
    }

    return (
    <ChatContext.Provider value={value}>
            { children }
    </ChatContext.Provider>
    )
}