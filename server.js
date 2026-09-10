
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, "public")));

const rooms = {};

function getRoom(id) {
  if (!rooms[id]) rooms[id] = { players: {}, bullets: [] };
  return rooms[id];
}

io.on("connection", (socket) => {
  socket.on("joinRoom", ({ roomId, name }) => {
    roomId = String(roomId || "publico").slice(0, 32);
    name = String(name || "Jogador").slice(0, 20);
    socket.join(roomId);
    socket.data.roomId = roomId;

    const room = getRoom(roomId);
    room.players[socket.id] = {
      id: socket.id,
      name,
      x: 350 + Math.random() * 500,
      y: 250 + Math.random() * 250,
      angle: 0,
      hp: 100,
      ammo: 12,
      crouching: false,
      sprinting: false
    };

    io.to(roomId).emit("state", room);
  });

  socket.on("playerUpdate", (data) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || !room.players[socket.id]) return;
    const p = room.players[socket.id];
    p.x = Number(data.x) || p.x;
    p.y = Number(data.y) || p.y;
    p.angle = Number(data.angle) || 0;
    p.crouching = !!data.crouching;
    p.sprinting = !!data.sprinting;
    p.ammo = Math.max(0, Math.min(12, Number(data.ammo) || 0));
    io.to(roomId).emit("state", room);
  });

  socket.on("shoot", ({ x, y, vx, vy }) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || !room.players[socket.id]) return;
    const p = room.players[socket.id];
    if (p.ammo <= 0) return;
    p.ammo--;
    room.bullets.push({
      id: `${socket.id}-${Date.now()}-${Math.random()}`,
      owner: socket.id,
      x, y, vx, vy, life: 90
    });
  });

  socket.on("reload", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || !room.players[socket.id]) return;
    room.players[socket.id].ammo = 12;
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    delete rooms[roomId].players[socket.id];
    io.to(roomId).emit("state", rooms[roomId]);
    if (!Object.keys(rooms[roomId].players).length) delete rooms[roomId];
  });
});

setInterval(() => {
  for (const [roomId, room] of Object.entries(rooms)) {
    for (const b of room.bullets) {
      b.x += b.vx;
      b.y += b.vy;
      b.life--;
      for (const p of Object.values(room.players)) {
        if (p.id === b.owner || p.hp <= 0) continue;
        const dx = p.x - b.x, dy = p.y - b.y;
        if (dx*dx + dy*dy < 22*22) {
          p.hp -= 25;
          b.life = 0;
          if (p.hp <= 0) {
            p.hp = 100;
            p.x = 250 + Math.random() * 700;
            p.y = 180 + Math.random() * 420;
          }
        }
      }
    }
    room.bullets = room.bullets.filter(b => b.life > 0 && b.x > -50 && b.x < 1600 && b.y > -50 && b.y < 900);
    io.to(roomId).emit("state", room);
  }
}, 1000/30);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Silva Testes rodando em http://localhost:${PORT}`));
