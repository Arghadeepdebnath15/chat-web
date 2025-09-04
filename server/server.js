import express from "express";
import "dotenv/config";
import cors from "cors";
import http from "http";
import { connectDB } from "./lib/db.js";
import userRouter from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import { Server } from "socket.io";

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app)

// Middleware setup
app.use(express.json({limit: "4mb"}));
app.use(cors({
    origin: ["https://michats.netlify.app", "http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "token"]
}));



// Initialize socket.io server
export const io = new Server(server, {
    cors: {origin: ["https://michats.netlify.app", "http://localhost:5173"]}
})

// Store online users
export const userSocketMap = {}; // { userId: socketId }

// Socket.io connection handler
io.on("connection",(socket)=>{
    const userId = socket.handshake.query.userId;
    console.log("User Connected", userId);

    if(userId) userSocketMap[userId] = socket.id;

    // Emit online users to all connected clients
    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    // Typing indicator events
    socket.on("typing", (data) => {
        const toSocketId = userSocketMap[data.to];
        if (toSocketId) {
            socket.to(toSocketId).emit("typing", { from: data.from });
        }
    });

    socket.on("stopTyping", (data) => {
        const toSocketId = userSocketMap[data.to];
        if (toSocketId) {
            socket.to(toSocketId).emit("stopTyping", { from: data.from });
        }
    });

    // WebRTC signaling events
    socket.on("webrtc-offer", (data) => {
        console.log("Server received webrtc-offer from", userId, "to", data.to);
        console.log("Offer data:", data.offer);
        const toSocketId = userSocketMap[data.to];
        if (toSocketId) {
            console.log("Forwarding offer to socket:", toSocketId);
            socket.to(toSocketId).emit("webrtc-offer", { from: userId, offer: data.offer });
        } else {
            console.log("No socket found for user:", data.to);
        }
    });

    socket.on("webrtc-answer", (data) => {
        const toSocketId = userSocketMap[data.to];
        if (toSocketId) {
            socket.to(toSocketId).emit("webrtc-answer", { answer: data.answer });
        }
    });

    socket.on("webrtc-candidate", (data) => {
        const toSocketId = userSocketMap[data.to];
        if (toSocketId) {
            socket.to(toSocketId).emit("webrtc-candidate", { candidate: data.candidate });
        }
    });

    socket.on("webrtc-call-ended", (data) => {
        const toSocketId = userSocketMap[data.to];
        if (toSocketId) {
            socket.to(toSocketId).emit("webrtc-call-ended");
        }
    });

    // Video call invitation events
    socket.on("webrtc-call-invitation", (data) => {
        const toSocketId = userSocketMap[data.to];
        if (toSocketId) {
            socket.to(toSocketId).emit("webrtc-call-invitation", { from: userId });
        }
    });

    socket.on("webrtc-accept", (data) => {
        const toSocketId = userSocketMap[data.to];
        if (toSocketId) {
            socket.to(toSocketId).emit("webrtc-call-accept");
        }
    });

    socket.on("webrtc-decline", (data) => {
        const toSocketId = userSocketMap[data.to];
        if (toSocketId) {
            socket.to(toSocketId).emit("webrtc-call-decline");
        }
    });

    socket.on("disconnect", ()=>{
        console.log("User Disconnected", userId);
        delete userSocketMap[userId];
        io.emit("getOnlineUsers", Object.keys(userSocketMap))
    })
})


// Routes setup
app.use("/api/status", (req, res)=> res.send("Server is live"));
app.use("/api/auth", userRouter);
app.use("/api/messages", messageRouter)


// Connect to MongoDB
await connectDB();

const PORT = process.env.PORT || 5002;
server.listen(PORT, ()=> console.log("Server is running on PORT: " + PORT));

// Export server for Vercel
export default server;
