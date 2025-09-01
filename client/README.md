# My Chat Client
ext inputA React-based chat application frontend built with Vite, Tailwind CSS, and Socket.io for real-time communication.

## Features

- Real-time messaging with Socket.io
- User authentication
- Responsive design with Tailwind CSS
- Profile management
- Chat history

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Arghadeepdebnath15/chat-web.git
   cd chat-web/client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the client directory and add your environment variables:
   ```
   VITE_API_URL=your_backend_api_url
   VITE_SOCKET_URL=your_socket_server_url
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser.

## Build for Production

```bash
npm run build
```

## Deployment

### Netlify

1. Connect your GitHub repository to Netlify.
2. Set the build command to `npm run build`.
3. Set the publish directory to `dist`.
4. Add environment variables in Netlify's dashboard.
5. Deploy!

The `netlify.toml` file is already configured for Netlify deployment.

### Vercel

1. Connect your GitHub repository to Vercel.
2. Vercel will automatically detect the Vite configuration.
3. Add environment variables in Vercel's dashboard.
4. Deploy!

The `vercel.json` file is already configured for Vercel deployment.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Technologies Used

- React 19
- Vite
- Tailwind CSS
- Socket.io Client
- Axios
- React Router DOM
- React Hot Toast
