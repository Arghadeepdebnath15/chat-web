import mongoose from "mongoose";

// Function to connect to the mongodb database
// Make sure your current IP address is whitelisted in your MongoDB Atlas cluster
// Also ensure the environment variable MONGO_URI is set correctly with your connection string
export const connectDB = async () => {
    try {
        mongoose.connection.on('connected', () => console.log('Database Connected'));
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI environment variable is not set");
        }
        await mongoose.connect(`${process.env.MONGO_URI}/chat-app`);
    } catch (error) {
        console.error("MongoDB connection error:", error);
    }
};
