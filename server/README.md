# QuickChat Server

A Node.js backend for the QuickChat application, built with Express.js, Socket.io, and MongoDB.

## Features

- User authentication with JWT
- Real-time messaging with Socket.io
- File uploads with Cloudinary
- MongoDB database integration
- CORS enabled for cross-origin requests

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- MongoDB database
- Cloudinary account for file uploads

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Arghadeepdebnath15/chat-web.git
   cd chat-web/server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the server directory and add your environment variables:
   ```
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```

4. Start the development server:
   ```bash
   npm run server
   ```

The server will run on [http://localhost:5000](http://localhost:5000).

## API Endpoints

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/users` - Get all users
- `POST /api/messages` - Send a message
- `GET /api/messages/:userId` - Get messages for a user

## Deployment

### Render

1. Connect your GitHub repository to Render.
2. Create a new Web Service.
3. Set the runtime to Node.js.
4. Set the build command to `npm install`.
5. Set the start command to `npm start`.
6. Add environment variables in Render's dashboard.
7. Deploy!

### Vercel

1. Connect your GitHub repository to Vercel.
2. Set the root directory to `server`.
3. Vercel will automatically detect the Node.js configuration.
4. Add environment variables in Vercel's dashboard.
5. Deploy!

The `vercel.json` file is already configured for Vercel deployment.

## Scripts

- `npm run server` - Start development server with nodemon
- `npm start` - Start production server

## Technologies Used

- Node.js
- Express.js
- Socket.io
- MongoDB with Mongoose
- JWT for authentication
- Cloudinary for file uploads
- bcryptjs for password hashing
- CORS
