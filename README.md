# Chess Multiplayer Server

Real-time chess server using Node.js + Socket.io.

## Deploy to Render.com (Free)

1. Push this folder to a GitHub repo
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Environment:** Node
5. Click Deploy
6. Copy your Render URL (e.g. https://chess-server-xyz.onrender.com)
7. Paste it into chess-game.html replacing `SERVER_URL`

## Local Testing

```bash
npm install
node server.js
# Server runs on http://localhost:3001
```

## How It Works

- Player 1 clicks "Create Online Game" → gets a 4-letter room code
- Player 2 enters the code → game starts
- Moves sync in real-time via WebSockets
- Chat, resign, draw offer all supported
