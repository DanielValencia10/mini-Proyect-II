import { createServer, IncomingMessage, ServerResponse } from 'http';
import { Server } from 'socket.io';
import { handleUsers } from './routes/users';
import { handleRooms } from './routes/rooms';
import { handleApiDocs } from './swagger';
import { verifyToken } from './middleware/auth';
import { registerWebRTCHandlers } from './socket/webrtcHandler';
import { auth } from './firebase';

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const PORT = process.env.PORT ?? 3000;

interface Participant {
  id: string;
  name: string;
  speaking: boolean;
  camOn: boolean;
  micOn: boolean;
}

// Mapa de salas: roomId -> Map<userId, Participant>
const rooms = new Map<string, Map<string, Participant>>();

// ── Servidor HTTP ───────────────────────────────────────────────────
const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  res.setHeader('Access-Control-Allow-Origin', CLIENT_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url ?? '/';

  if (req.method === 'GET' && url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  if (req.method === 'GET' && url.startsWith('/users/check-username/')) {
    await handleUsers(req, res, url.slice('/users'.length) || '');
    return;
  }

  if (url.startsWith('/users')) {
    if (!await verifyToken(req, res)) return;
    await handleUsers(req, res, url.slice('/users'.length) || '');
    return;
  }

  const roomsMatch = url.match(/^\/rooms\/?([^/?]*)/);
  if (roomsMatch) {
    if (!await verifyToken(req, res)) return;
    await handleRooms(req, res, roomsMatch[1] || undefined);
    return;
  }

  if (url.startsWith('/api-docs')) {
    handleApiDocs(req, res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ── Socket.IO Server ────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

// Middleware de autenticación
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Token no proporcionado'));

  try {
    const decoded = await auth.verifyIdToken(token);
    socket.data.userId = decoded.uid;
    socket.data.email = decoded.email ?? '';
    next();
  } catch {
    next(new Error('Token inválido'));
  }
});

// ── Eventos de salas y chat ─────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`Socket conectado: ${socket.id}`);

  // ─── Unirse a sala ────────────────────────────────────────────────
  socket.on('join-room', ({ roomId, userName }: { roomId: string; userName: string }) => {
    const userId = socket.data.userId;
    if (!userId) return;

    socket.join(roomId);
    socket.join(userId); // sala personal para señalización WebRTC

    if (!rooms.has(roomId)) rooms.set(roomId, new Map());

    rooms.get(roomId)!.set(userId, {
      id: userId,
      name: userName,
      speaking: false,
      camOn: false,
      micOn: false,
    });

    io.to(roomId).emit('room-participants', Array.from(rooms.get(roomId)!.values()));
    console.log(`${userName} (${userId}) entró a la sala ${roomId}`);
  });

  // ─── Actualizar estado multimedia ─────────────────────────────────
  socket.on('update-media-state', ({ roomId, camOn, micOn }: { roomId: string; camOn: boolean; micOn: boolean }) => {
    const userId = socket.data.userId;
    const room = rooms.get(roomId);
    if (!room) return;

    const participant = room.get(userId);
    if (participant) {
      participant.camOn = camOn;
      participant.micOn = micOn;
      io.to(roomId).emit('room-participants', Array.from(room.values()));
    }
  });

  // ─── Abandonar sala ───────────────────────────────────────────────
  socket.on('leave-room', ({ roomId }: { roomId: string }) => {
    const userId = socket.data.userId;
    if (!userId) return;

    socket.leave(roomId);
    socket.leave(userId);

    const room = rooms.get(roomId);
    if (room) {
      room.delete(userId);
      if (room.size === 0) {
        rooms.delete(roomId);
      } else {
        io.to(roomId).emit('room-participants', Array.from(room.values()));
      }
    }

    console.log(`${userId} abandonó la sala ${roomId}`);
  });

  // ─── Chat ─────────────────────────────────────────────────────────
  socket.on('send_message', ({ roomId, message }: { roomId: string; message: string }) => {
    const userId = socket.data.userId;
    const room = rooms.get(roomId);
    const participant = room?.get(userId);
    const author = participant?.name ?? userId ?? 'Anónimo';

    io.to(roomId).emit('receive_message', {
      id: Date.now(),
      author,
      text: message,
    });
  });

  // ─── Desconexión ──────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const userId = socket.data.userId;
    if (!userId) return;
    console.log(`Socket desconectado: ${socket.id}, userId: ${userId}`);

    rooms.forEach((participants, roomId) => {
      if (participants.has(userId)) {
        // Eliminamos al participante del mapa de la sala
        participants.delete(userId);

        // 2. Forzamos el aviso de WebRTC desde aquí, ya que el estado es 100% certero
        io.to(roomId).emit('user-left-call', { userId });

        if (participants.size === 0) {
          rooms.delete(roomId);
        } else {
          // 3. Notificamos la lista actualizada de participantes
          io.to(roomId).emit('room-participants', Array.from(participants.values()));
        }
      }
    });
  });
});

// ── Registrar manejadores WebRTC (ya incluye emisión de user-left-call) ──
registerWebRTCHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});