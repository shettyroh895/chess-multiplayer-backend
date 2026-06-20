const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// rooms: { roomCode: { players: [socketId, socketId], board: [...], turn: 'white'|'black', history: [] } }
const rooms = {};

function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Create a new game room
  socket.on('create_room', () => {
    let code = generateCode();
    while (rooms[code]) code = generateCode(); // ensure unique

    rooms[code] = {
      players: [socket.id],
      spectators: [],
      moves: [],
      started: false,
      createdAt: Date.now()
    };

    socket.join(code);
    socket.data.room = code;
    socket.data.color = 'white';

    socket.emit('room_created', { code, color: 'white' });
    console.log(`Room ${code} created by ${socket.id}`);
  });

  // Join an existing room
  socket.on('join_room', ({ code }) => {
    const room = rooms[code?.toUpperCase()];
    const upperCode = code?.toUpperCase();

    if (!room) {
      socket.emit('error', { message: 'Room not found. Check the code and try again.' });
      return;
    }
    if (room.players.length >= 2) {
      // Allow as spectator
      room.spectators.push(socket.id);
      socket.join(upperCode);
      socket.data.room = upperCode;
      socket.data.color = 'spectator';
      socket.emit('joined_as_spectator', { code: upperCode, moves: room.moves });
      return;
    }

    room.players.push(socket.id);
    room.started = true;
    socket.join(upperCode);
    socket.data.room = upperCode;
    socket.data.color = 'black';

    socket.emit('room_joined', { code: upperCode, color: 'black' });

    // Tell both players game is starting
    io.to(upperCode).emit('game_start', { code: upperCode });
    console.log(`Room ${upperCode} started`);
  });

  // A player made a move
  socket.on('move', ({ from, to, promotion, fen }) => {
    const code = socket.data.room;
    const room = rooms[code];
    if (!room) return;

    const move = { from, to, promotion, fen, by: socket.data.color };
    room.moves.push(move);

    // Broadcast move to everyone else in the room
    socket.to(code).emit('opponent_move', { from, to, promotion });
  });

  // Chat message
  socket.on('chat', ({ message }) => {
    const code = socket.data.room;
    if (!code) return;
    const color = socket.data.color;
    io.to(code).emit('chat_message', {
      from: color === 'white' ? 'White' : 'Black',
      message: message.substring(0, 200)
    });
  });

  // Offer draw
  socket.on('offer_draw', () => {
    const code = socket.data.room;
    socket.to(code).emit('draw_offered');
  });

  socket.on('accept_draw', () => {
    const code = socket.data.room;
    io.to(code).emit('game_over', { result: 'draw', reason: 'Agreement' });
  });

  socket.on('decline_draw', () => {
    const code = socket.data.room;
    socket.to(code).emit('draw_declined');
  });

  // Resign
  socket.on('resign', () => {
    const code = socket.data.room;
    const color = socket.data.color;
    io.to(code).emit('game_over', {
      result: color === 'white' ? 'black' : 'white',
      reason: 'Resignation'
    });
  });

  // Rematch request
  socket.on('rematch', () => {
    const code = socket.data.room;
    socket.to(code).emit('rematch_offered');
  });

  socket.on('accept_rematch', () => {
    const code = socket.data.room;
    const room = rooms[code];
    if (!room) return;
    // Swap colors
    const [p1, p2] = room.players;
    room.moves = [];
    // Reassign colors
    const s1 = io.sockets.sockets.get(p1);
    const s2 = io.sockets.sockets.get(p2);
    if (s1 && s2) {
      const c1 = s1.data.color, c2 = s2.data.color;
      s1.data.color = c2; s2.data.color = c1;
      io.to(code).emit('rematch_start', {
        whiteId: s1.data.color === 'white' ? p1 : p2
      });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    const code = socket.data.room;
    const room = rooms[code];
    if (!room) return;

    room.players = room.players.filter(id => id !== socket.id);
    room.spectators = room.spectators.filter(id => id !== socket.id);

    if (room.players.length === 0 && room.spectators.length === 0) {
      delete rooms[code];
      console.log(`Room ${code} deleted`);
    } else {
      socket.to(code).emit('opponent_disconnected');
    }
    console.log('Player disconnected:', socket.id);
  });
});

// Health check
app.get('/', (req, res) => res.json({ status: 'Chess server running', rooms: Object.keys(rooms).length }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Chess server running on port ${PORT}`));
