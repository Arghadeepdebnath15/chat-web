import Message from "../models/Message.js";
import User from "../models/User.js";
import cloudinary from "../lib/cloudinary.js"
import { io, userSocketMap } from "../server.js";


// Get all users with whom the logged in user has chatted or has unread messages from
export const getUsersForSidebar = async (req, res)=>{
    try {
        const userId = req.user._id;

        // Find all unique user IDs that have sent or received messages with the current user
        const messageUsers = await Message.distinct("senderId", { receiverId: userId });
        const messageUsers2 = await Message.distinct("receiverId", { senderId: userId });

        // Find users who have sent unread messages to the current user
        const unreadMessageSenders = await Message.distinct("senderId", { receiverId: userId, seen: false });

        const allUserIds = [...new Set([...messageUsers, ...messageUsers2, ...unreadMessageSenders])];

        const filteredUsers = await User.find({_id: {$in: allUserIds}}).select("-password");

        // Count number of messages not seen
        const unseenMessages = {}
        const promises = filteredUsers.map(async (user)=>{
            const messages = await Message.find({senderId: user._id, receiverId: userId, seen: false})
            if(messages.length > 0){
                unseenMessages[user._id] = messages.length;
            }
        })
        await Promise.all(promises);
        res.json({success: true, users: filteredUsers, unseenMessages})
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

// Search users by name
export const searchUsers = async (req, res)=>{
    try {
        const userId = req.user._id;
        const { q } = req.query;

        if (!q) {
            return res.json({success: true, users: []});
        }

        const searchedUsers = await User.find({
            _id: {$ne: userId},
            fullName: {$regex: q, $options: 'i'}
        }).select("-password");

        res.json({success: true, users: searchedUsers})
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

// Get all messages for selected user
export const getMessages = async (req, res) =>{
    try {
        const { id: selectedUserId } = req.params;
        const myId = req.user._id;

        const messages = await Message.find({
            $or: [
                {senderId: myId, receiverId: selectedUserId},
                {senderId: selectedUserId, receiverId: myId},
            ]
        })
        const updated = await Message.updateMany({senderId: selectedUserId, receiverId: myId, seen: false}, {seen: true});
        if (updated.modifiedCount > 0) {
            // Emit messagesSeen event to sender's socket with list of updated message IDs
            const updatedMessages = await Message.find({senderId: selectedUserId, receiverId: myId, seen: true});
            const senderSocketId = userSocketMap[selectedUserId];
            if (senderSocketId) {
                const seenMessageIds = updatedMessages.map(msg => msg._id.toString());
                io.to(senderSocketId).emit("messagesSeen", seenMessageIds);
            }
        }

        res.json({success: true, messages})


    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

// api to mark message as seen using message id
export const markMessageAsSeen = async (req, res)=> {
    try {
        const { id } = req.params;
        const updatedMessage = await Message.findByIdAndUpdate(id, {seen: true}, {new: true});
        // Emit messageSeen event to sender's socket
        const senderSocketId = userSocketMap[updatedMessage.senderId];
        if (senderSocketId) {
            io.to(senderSocketId).emit("messageSeen", updatedMessage._id.toString());
        }
        res.json({success: true})
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

// Send message to selected user
export const sendMessage = async (req, res) =>{
    try {
        const {text, image} = req.body;
        const receiverId = req.params.id;
        const senderId = req.user._id;

        let imageUrl;
        if(image){
            const uploadResponse = await cloudinary.uploader.upload(image)
            imageUrl = uploadResponse.secure_url;
        }
        const newMessage = await Message.create({
            senderId,
            receiverId,
            text,
            image: imageUrl
        })

        // Emit the new message to the receiver's socket
        const receiverSocketId = userSocketMap[receiverId];
        if (receiverSocketId){
            io.to(receiverSocketId).emit("newMessage", newMessage)
        }

        res.json({success: true, newMessage});

    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}