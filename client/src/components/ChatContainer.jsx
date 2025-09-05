import React, { useContext, useEffect, useRef, useState } from 'react'
import assets, { messagesDummyData } from '../assets/assets'
import { formatMessageTime } from '../lib/utils'
import { ChatContext } from '../../context/ChatContext'
import { AuthContext } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import VideoCallNew from './VideoCallNew'
import './TypingIndicator.css'

const ChatContainer = () => {

    const { messages, users, selectedUser, setSelectedUser, sendMessage,
        getMessages, toggleRightSidebar, typingUsers, sendTyping, stopTyping, loadingMessages, incomingCall, setIncomingCall } = useContext(ChatContext)

    const { authUser, onlineUsers } = useContext(AuthContext)

    const scrollEnd = useRef()
    const typingTimeoutRef = useRef(null);

    const [input, setInput] = useState('');
    const [showVideoCall, setShowVideoCall] = useState(false);
    const [incomingCallDetails, setIncomingCallDetails] = useState(null);

    // Handle sending a message
    const handleSendMessage = async (e)=>{
        if(e) {
            e.preventDefault();
        }
        console.log("handleSendMessage called with input:", input);
        if(input.trim() === "") {
            console.log("Input is empty, not sending message");
            return null;
        }
        // Clear typing timeout and stop typing indicator when sending message
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        stopTyping();
        await sendMessage({text: input.trim()});
        setInput("")
    }

    // Handle sending an image
    const handleSendImage = async (e) =>{
        const file = e.target.files[0];
        if(!file || !file.type.startsWith("image/")){
            toast.error("select an image file")
            return;
        }
        const reader = new FileReader();

        reader.onloadend = async ()=>{
            await sendMessage({image: reader.result})
            e.target.value = ""
        }
        reader.readAsDataURL(file)
    }

    // Handle typing indicator with debounce
    const handleTyping = () => {
        console.log("handleTyping called");
        sendTyping();
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
            console.log("Timeout expired, calling stopTyping");
            stopTyping();
        }, 500); // 0.5 seconds after user stops typing
    };

    useEffect(()=>{
        if(selectedUser){
            // Clear messages immediately when switching users to prevent showing old chat content
            // This will be overridden by the new messages when getMessages completes
            // Note: We can't directly set messages here since it's from context, so we rely on ChatContext's clearing
            getMessages(selectedUser._id)
        }
    },[selectedUser])

    useEffect(()=>{
        if(scrollEnd.current && messages){
            scrollEnd.current.scrollIntoView({ behavior: "smooth"})
        }
    },[messages])

    useEffect(() => {
        if (incomingCall) {
            // Find the caller user from the users list
            const callerUser = users.find(u => u._id === incomingCall.from);
            if (callerUser) {
                setSelectedUser(callerUser); // Switch to the caller
            }
            setIncomingCallDetails(incomingCall);
            setShowVideoCall(true);
            setIncomingCall(null); // Clear after showing
        }
    }, [incomingCall, setIncomingCall, users, setSelectedUser])

    // Cleanup typing timeout when component unmounts or selectedUser changes
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [selectedUser]);

    const handleVideoCallClose = () => {
        setShowVideoCall(false);
        setIncomingCallDetails(null);
    }

  return selectedUser ? (
    <div className='h-full overflow-scroll relative backdrop-blur-lg'>
      {/* ------- header ------- */}
      <div className='flex items-center gap-4 py-2 px-6 border-b border-purple-400/30 bg-purple-600/90 backdrop-blur-md shadow-xl relative overflow-hidden'>
        {/* Subtle animated background elements */}
        <div className='absolute inset-0 bg-purple-500/10 animate-pulse'></div>

        {/* Profile Picture with enhanced styling */}
        <div className='relative z-10'>
          <img onClick={toggleRightSidebar} src={selectedUser.profilePic || assets.avatar_icon} alt=""
               className="w-10 h-10 rounded-full shadow-xl border-2 border-yellow-400/80 cursor-pointer hover:scale-110 transition-all duration-300 hover:shadow-yellow-400/50 hover:border-yellow-300 ring-2 ring-yellow-400/20 hover:ring-yellow-400/40"/>
          {onlineUsers.includes(selectedUser._id) && (
            <div className='absolute -bottom-1 -right-1 w-4 h-4 bg-gradient-to-r from-lime-400 to-green-500 rounded-full border-2 border-white shadow-lg animate-pulse'>
              <div className='w-full h-full bg-gradient-to-r from-lime-300 to-green-400 rounded-full animate-ping'></div>
            </div>
          )}
        </div>

        {/* User Name with enhanced typography */}
        <div className='flex-1 relative z-10'>
          <p className='text-xl text-white font-bold bg-gradient-to-r from-white via-gray-100 to-white bg-clip-text text-transparent drop-shadow-lg'>
            {selectedUser.fullName}
          </p>
          <p className='text-sm text-gray-300 font-medium'>
            {onlineUsers.includes(selectedUser._id) ? (
              <span className='flex items-center gap-1'>
                <span className='w-2 h-2 bg-lime-400 rounded-full animate-pulse'></span>
                Online
              </span>
            ) : (
              <span className='text-gray-400'>Offline</span>
            )}
          </p>
        </div>

        {/* Action buttons with enhanced styling */}
        <div className='flex items-center gap-2 relative z-10'>
          <button
            onClick={() => setShowVideoCall(true)}
            title="Start Video Call"
            className="p-1 rounded-full hover:bg-white/10 transition-all duration-300"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-6 h-6 text-white"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M4 6h11a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z"
              />
            </svg>
          </button>
          <img onClick={()=> setSelectedUser(null)} src={assets.arrow_icon} alt=""
               className='md:hidden max-w-7 hover:opacity-80 transition-all duration-300 cursor-pointer hover:scale-110 p-1 rounded-full hover:bg-white/10'/>
          <img src={assets.help_icon} alt=""
               className='max-md:hidden max-w-5 hover:opacity-80 transition-all duration-300 cursor-pointer hover:scale-110 p-1 rounded-full hover:bg-white/10'/>
        </div>
      </div>
      {/* ------- chat area ------- */}
      <div className='flex flex-col h-[calc(100%-120px)] overflow-y-scroll p-3 pb-6 bg-gradient-to-b from-transparent to-gray-900/20 scroll-smooth touch-auto -webkit-overflow-scrolling-touch'>
        {loadingMessages ? (
          <div className='flex items-center justify-center h-full'>
            <div className='text-white text-center'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2'></div>
              <p>Loading messages...</p>
            </div>
          </div>
        ) : (
          messages.filter(msg => (String(msg.senderId) === String(selectedUser._id) && String(msg.receiverId) === String(authUser._id)) || (String(msg.receiverId) === String(selectedUser._id) && String(msg.senderId) === String(authUser._id))).map((msg, index)=>(
            <div key={index} className={`flex items-end gap-2 justify-end animate-fade-in ${authUser && msg.senderId !== authUser._id && 'flex-row-reverse'}`}>
                {msg.image ? (
                    <img src={msg.image} alt="" className='max-w-[230px] border border-gray-700 rounded-lg overflow-hidden mb-8 shadow-lg hover:shadow-xl transition-shadow'/>
                ):(

                    <p className={`p-3 max-w-[250px] md:text-sm font-light rounded-lg mb-8 break-all text-white shadow-lg hover:shadow-xl transition-all duration-200 ${authUser && msg.senderId === authUser._id ? 'bg-gradient-to-r from-cyan-400 to-blue-500 rounded-br-none' : 'bg-gradient-to-r from-emerald-400 to-green-500 rounded-bl-none'}`}>{msg.text}</p>
                )}
                <div className="text-center text-xs">
                    <img src={authUser && msg.senderId === authUser._id ? authUser?.profilePic || assets.avatar_icon : selectedUser?.profilePic || assets.avatar_icon} alt="" className='w-7 h-7 rounded-full shadow-md object-cover' />
                    <p className='text-gray-400 mt-1'>{formatMessageTime(msg.createdAt)}</p>
                    {authUser && msg.senderId === authUser._id && msg.seen && (
                        <p className='text-blue-400 text-xs mt-1 font-medium'>Seen</p>
                    )}
                </div>
            </div>
          ))
        )}
        <div ref={scrollEnd}></div>
      </div>

      {/* ------- bottom area ------- */}
    <div className='absolute bottom-0 left-0 right-0 flex flex-col gap-1 p-3 bg-gradient-to-t from-black/50 to-transparent transition-all duration-500 ease-out'>
        <div className='flex items-center gap-2'>
            <div className='flex-1 flex items-center bg-gradient-to-r from-indigo-800/50 to-purple-800/50 px-4 py-2 rounded-full border-2 border-pink-400 shadow-lg backdrop-blur-sm'>
                <input onChange={(e)=> {setInput(e.target.value); handleTyping();}} onKeyUp={(e)=> { if (e.key !== "Enter") handleTyping(); }} onBlur={() => { console.log("onBlur called, clearing timeout and stopping typing"); if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); } stopTyping(); }} value={input} onKeyDown={(e)=> { console.log("onKeyDown event:", e.key); if (e.key === "Enter" || e.key === "Shift") { handleSendMessage(e); e.preventDefault(); }}} type="text" placeholder="Send a message..."
                className='flex-1 text-sm p-2 border-none outline-none text-white placeholder-gray-400 bg-transparent focus:ring-2 focus:ring-blue-500 rounded-md transition-all'/>
                <input onChange={handleSendImage} type="file" id='image' accept='image/png, image/jpeg' hidden/>
                <label htmlFor="image">
                    <img src={assets.gallery_icon} alt="" className="w-5 mr-2 cursor-pointer hover:scale-110 transition-transform filter hue-rotate-180"/>
                </label>
            </div>
            <img
              onClick={handleSendMessage}
              src={assets.send_button}
              alt=""
              className={`cursor-pointer shadow-md transition-transform hover:scale-110
                ${input.trim() ? 'w-10 filter saturate-150' : 'w-7 filter saturate-50'}`}
            />
        </div>
        {selectedUser && typingUsers[selectedUser._id] && (
          <div className="typing-indicator">
            {console.log("Typing indicator should show for user:", selectedUser._id, "typingUsers:", typingUsers)}
            <span className="typing-text">Typing</span>
            <span className="typing-dots">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </span>
          </div>
        )}
    </div>

    {showVideoCall && (
        <VideoCallNew
            onClose={handleVideoCallClose}
            isIncoming={!!incomingCallDetails}
            caller={incomingCallDetails?.from}
        />
    )}

    </div>
  ) : (
    <div className='flex flex-col items-center justify-center gap-2 text-gray-500 bg-white/10 max-md:hidden'>
        <img src={assets.logo_icon} className='max-w-16' alt="" />
        <p className='text-lg font-medium text-white'>Chat anytime, anywhere</p>
    </div>
  )
}

export default ChatContainer
