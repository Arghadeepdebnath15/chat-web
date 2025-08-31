# QuickChat Full-Stack

A real-time chat application built with React, Node.js, Express, Socket.io, and MongoDB.

## Project Structure

- `client/` - React frontend application
- `server/` - Node.js backend API

## Features

- Real-time messaging
- User authentication
- File uploads
- Responsive design
- Profile management

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- MongoDB
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Arghadeepdebnath15/chat-web.git
   cd QuickChat-Full-Stack
   ```

2. Install client dependencies:
   ```bash
   cd client
   npm install
   cd ..
   ```

3. Install server dependencies:
   ```bash
   cd server
   npm install
   cd ..
   ```

4. Set up environment variables:
   - Create `.env` files in both `client/` and `server/` directories
   - See respective READMEs for required variables

5. Start the development servers:
   ```bash
   # Terminal 1: Start server
   cd server
   npm run server

   # Terminal 2: Start client
   cd client
   npm run dev
   ```

6. Open [http://localhost:5173](http://localhost:5173) in your browser.

## Deployment

### Netlify (Frontend)

See [client/README.md](client/README.md) for detailed deployment instructions.

### Render (Full-Stack)

1. Connect your GitHub repository to Render.
2. Use the `render.yaml` file for multi-service deployment:
   - It defines both the backend (Node.js) and frontend (static site) services
   - Set environment variables in Render's dashboard for each service
   - Deploy both services simultaneously

### Vercel (Both)

See [client/README.md](client/README.md) and [server/README.md](server/README.md) for detailed deployment instructions.

## Technologies Used

### Frontend
- React 19
- Vite
- Tailwind CSS
- Socket.io Client
- Axios

### Backend
- Node.js
- Express.js
- Socket.io
- MongoDB
- JWT
- Cloudinary

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

This project is licensed under the ISC License.
