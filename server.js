const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Serve the static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Track rooms and users
const rooms = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  let currentRoom = null;

  socket.on('join', ({ room }) => {
    currentRoom = room;
    socket.join(room);

    if (!rooms[room]) rooms[room] = [];
    rooms[room].push(socket.id);

    // Tell existing users about the new user
    socket.to(room).emit('user-joined', { id: socket.id });

    // Tell the new user about existing users
    const others = rooms[room].filter(id => id !== socket.id);
    socket.emit('room-users', { users: others });

    console.log(`${socket.id} joined room: ${room} (${rooms[room].length} users)`);
  });

  // WebRTC signaling relay
  socket.on('signal', ({ to, signal }) => {
    io.to(to).emit('signal', { from: socket.id, signal });
  });

  socket.on('leave', () => {
    if (currentRoom && rooms[currentRoom]) {
      rooms[currentRoom] = rooms[currentRoom].filter(id => id !== socket.id);
      socket.to(currentRoom).emit('user-left', { id: socket.id });
      if (rooms[currentRoom].length === 0) delete rooms[currentRoom];
      socket.leave(currentRoom);
      console.log(`${socket.id} left room: ${currentRoom}`);
      currentRoom = null;
    }
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms[currentRoom]) {
      rooms[currentRoom] = rooms[currentRoom].filter(id => id !== socket.id);
      socket.to(currentRoom).emit('user-left', { id: socket.id });
      if (rooms[currentRoom].length === 0) delete rooms[currentRoom];
    }
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`SoundLab server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
