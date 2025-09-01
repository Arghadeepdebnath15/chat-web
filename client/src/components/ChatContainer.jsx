import React, { useContext, useEffect, useRef, useState } from 'react'
import assets, { messagesDummyData } from '../assets/assets'
import { formatMessageTime } from '../lib/utils'
import { ChatContext } from '../../context/ChatContext'
import { AuthContext } from '../../context/AuthContext'
import toast from 'react-hot-toast'

const ChatContainer = () => {

    const { messages, selectedUser, setSelectedUser, sendMessage,
        getMessages, toggleRightSidebar} = useContext(ChatContext)

    const { authUser, onlineUsers } = useContext(AuthContext)

    const scrollEnd = useRef()

    const [input, setInput] = useState('');

    // Handle sending a message
    const handleSendMessage = async (e)=>{
        e.preventDefault();
        if(input.trim() === "") return null;
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

    useEffect(()=>{
        if(selectedUser){
            getMessages(selectedUser._id)
        }
    },[selectedUser])

    useEffect(()=>{
        if(scrollEnd.current && messages){
            scrollEnd.current.scrollIntoView({ behavior: "smooth"})
        }
    },[messages])

  return selectedUser ? (
    <div className='h-full overflow-scroll relative backdrop-blur-lg'>
      {/* ------- header ------- */}
      <div className='flex items-center gap-3 py-3 px-4 border-b border-purple-400 bg-gradient-to-r from-purple-600/70 to-pink-600/70 backdrop-blur-sm'>
        <img onClick={toggleRightSidebar} src={selectedUser.profilePic || assets.avatar_icon} alt="" className="w-8 rounded-full shadow-md border-2 border-yellow-400 cursor-pointer hover:scale-105 transition-transform"/>
        <p className='flex-1 text-lg text-white flex items-center gap-2 font-semibold'>
            {selectedUser.fullName}
            {onlineUsers.includes(selectedUser._id) && <span className="w-3 h-3 rounded-full bg-lime-400 animate-pulse shadow-lg"></span>}
        </p>
        <img onClick={()=> setSelectedUser(null)} src={assets.arrow_icon} alt="" className='md:hidden max-w-7 hover:opacity-70 transition-opacity cursor-pointer'/>
        <img src={assets.help_icon} alt="" className='max-md:hidden max-w-5 hover:opacity-70 transition-opacity cursor-pointer'/>
      </div>
      {/* ------- chat area ------- */}
      <div className='flex flex-col h-[calc(100%-120px)] overflow-y-scroll p-3 pb-6 bg-gradient-to-b from-transparent to-gray-900/20'>
        {messages.map((msg, index)=>(
            <div key={index} className={`flex items-end gap-2 justify-end animate-fade-in ${msg.senderId !== authUser._id && 'flex-row-reverse'}`}>
                {msg.image ? (
                    <img src={msg.image} alt="" className='max-w-[230px] border border-gray-700 rounded-lg overflow-hidden mb-8 shadow-lg hover:shadow-xl transition-shadow'/>
                ):(
                    <p className={`p-3 max-w-[250px] md:text-sm font-light rounded-lg mb-8 break-all text-white shadow-lg hover:shadow-xl transition-all duration-200 ${msg.senderId === authUser._id ? 'bg-gradient-to-r from-cyan-400 to-blue-500 rounded-br-none' : 'bg-gradient-to-r from-emerald-400 to-green-500 rounded-bl-none'}`}>{msg.text}</p>
                )}
                <div className="text-center text-xs">
                    <img src={msg.senderId === authUser._id ? authUser?.profilePic || assets.avatar_icon : selectedUser?.profilePic || assets.avatar_icon} alt="" className='w-7 h-7 rounded-full shadow-md object-cover' />
                    <p className='text-gray-400 mt-1'>{formatMessageTime(msg.createdAt)}</p>
                </div>
            </div>
        ))}
        <div ref={scrollEnd}></div>
      </div>

{/* ------- bottom area ------- */}
    <div className='absolute bottom-0 left-0 right-0 flex items-center gap-3 p-3 bg-gradient-to-t from-black/50 to-transparent'>
        <div className='flex-1 flex items-center bg-gradient-to-r from-indigo-800/50 to-purple-800/50 px-4 py-2 rounded-full border-2 border-pink-400 shadow-lg backdrop-blur-sm'>
            <input onChange={(e)=> setInput(e.target.value)} value={input} onKeyDown={(e)=> e.key === "Enter" ? handleSendMessage(e) : null} type="text" placeholder="Send a message..."
            className='flex-1 text-sm p-2 border-none outline-none text-white placeholder-gray-400 bg-transparent focus:ring-2 focus:ring-blue-500 rounded-md transition-all'/>
            <input onChange={handleSendImage} type="file" id='image' accept='image/png, image/jpeg' hidden/>
            <label htmlFor="image">
                <img src={assets.gallery_icon} alt="" className="w-5 mr-2 cursor-pointer hover:scale-110 transition-transform filter hue-rotate-180"/>
            </label>
        </div>
        <img onClick={handleSendMessage} src={assets.send_button} alt="" className="w-7 cursor-pointer hover:scale-110 transition-transform shadow-md" />
    </div>


    </div>
  ) : (
    <div className='flex flex-col items-center justify-center gap-2 text-gray-500 bg-white/10 max-md:hidden'>
        <img src={assets.logo_icon} className='max-w-16' alt="" />
        <p className='text-lg font-medium text-white'>Chat anytime, anywhere</p>
    </div>
  )
}

export default ChatContainer
