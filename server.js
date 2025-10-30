import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(join(__dirname, 'public')));

// Store connected users
const users = new Map();
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  // User joins
  socket.on('join', (userData) => {
    users.set(socket.id, {
      id: socket.id,
      name: userData.name || `User${Math.floor(Math.random() * 1000)}`
    });
    
    // Send updated user list to all clients
    io.emit('users', Array.from(users.values()));
    console.log(`User joined: ${users.get(socket.id).name}`);
  });

  // Handle signaling for WebRTC
  socket.on('signal', (data) => {
    console.log(`Signal from ${socket.id} to ${data.to}`);
    io.to(data.to).emit('signal', {
      signal: data.signal,
      from: socket.id,
      name: users.get(socket.id)?.name
    });
  });

  // Handle room creation
  socket.on('create-room', (roomName) => {
    const roomId = `room_${Date.now()}`;
    rooms.set(roomId, {
      id: roomId,
      name: roomName,
      creator: socket.id,
      members: [socket.id]
    });
    socket.join(roomId);
    io.emit('rooms', Array.from(rooms.values()));
    console.log(`Room created: ${roomName} (${roomId})`);
  });

  // Handle room joining
  socket.on('join-room', (roomId) => {
    const room = rooms.get(roomId);
    if (room) {
      room.members.push(socket.id);
      socket.join(roomId);
      io.to(roomId).emit('user-joined', {
        userId: socket.id,
        userName: users.get(socket.id)?.name
      });
      console.log(`User ${socket.id} joined room ${roomId}`);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    users.delete(socket.id);
    
    // Remove user from rooms
    rooms.forEach((room, roomId) => {
      const index = room.members.indexOf(socket.id);
      if (index > -1) {
        room.members.splice(index, 1);
        if (room.members.length === 0) {
          rooms.delete(roomId);
        }
      }
    });
    
    io.emit('users', Array.from(users.values()));
    io.emit('rooms', Array.from(rooms.values()));
  });

  // Send initial data
  socket.emit('users', Array.from(users.values()));
  socket.emit('rooms', Array.from(rooms.values()));
});

server.listen(PORT, () => {
  console.log(`Signaling server running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready for connections`);
});
