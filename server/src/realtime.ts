import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerWebRTCHandlers } from './socket/webrtcHandler';
import { auth } from './firebase';

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const PORT = process.env.REALTIME_PORT ?? process.env.PORT ?? 3001;

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  speaking: boolean;
  camOn: boolean;
  micOn: boolean;
}

// Mapa de salas: roomId -> Map<userId, Participant>
const rooms = new Map<string, Map<string, Participant>>();

// Timers de gracia: userId -> timeout. Evita emitir user-left-call en reconexiones breves.
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', server: 'realtime', timestamp: new Date().toISOString() }));
});

console.log('⚡ [Socket.IO] Inicializando servidor en tiempo real...');
const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['polling', 'websocket'],
});

// Middleware de autenticación de Sockets
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  console.log(`🔒 [Socket Auth] Verificando handshake para el socket: ${socket.id}`);

  if (!token) {
    console.error(`❌ [Socket Auth] Conexión denegada: No se proporcionó Token en el socket ${socket.id}`);
    return next(new Error('Token no proporcionado'));
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    socket.data.userId = decoded.uid;
    socket.data.email = decoded.email ?? '';
    console.log(`✅ [Socket Auth] Token verificado. UID: ${decoded.uid} (${decoded.email ?? 'Sin Email'})`);
    next();
  } catch (err: any) {
    console.error(`❌ [Socket Auth] Token inválido en socket ${socket.id}:`, err.message);
    next(new Error('Token inválido'));
  }
});

// ── Eventos de salas y chat ─────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🟢 [Socket Event] Cliente conectado. Socket ID: ${socket.id}, UID: ${socket.data.userId}`);

  // ─── Unirse a sala ────────────────────────────────────────────────
  socket.on('join-room', ({ roomId, userName, avatar }: { roomId: string; userName: string; avatar?: string }) => {
    const userId = socket.data.userId;
    if (!userId) {
      console.warn(`⚠️ [Room] Intento de join-room sin userId válido en socket: ${socket.id}`);
      return;
    }

    socket.data.name = userName;

    // Cancelar limpieza pendiente si el usuario reconectó dentro de la gracia
    const pendingTimer = disconnectTimers.get(userId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      disconnectTimers.delete(userId);
      console.log(`♻️ [Room] Usuario [${userId}] reconectó dentro del período de gracia. Limpieza cancelada.`);
    }

    socket.data.userName = userName;
    console.log(`🚪 [Room] Usuario '${userName}' (${userId}) se une a la sala: ${roomId}`);

    socket.join(roomId);
    socket.join(userId); // Sala personal vital para señalización WebRTC individual

    if (!rooms.has(roomId)) rooms.set(roomId, new Map());

    rooms.get(roomId)!.set(userId, {
      id: userId,
      name: userName,
      avatar: avatar ?? "",
      speaking: false,
      camOn: false,
      micOn: false,
    });

    const participantList = Array.from(rooms.get(roomId)!.values());
    io.to(roomId).emit('room-participants', participantList);
    console.log(`👥 [Room] Participantes en sala [${roomId}]: ${participantList.length}`);
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
      console.log(`📸 [Media] Estado de [${participant.name}]: Cam: ${camOn}, Mic: ${micOn}`);
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
      if (room.size === 0) rooms.delete(roomId);
      else io.to(roomId).emit('room-participants', Array.from(room.values()));
    }

    console.log(`🚪 [Room] Usuario [${userId}] abandonó la sala ${roomId}`);
  });

  // ─── Chat ─────────────────────────────────────────────────────────
  socket.on('send_message', async ({ roomId, message }: { roomId: string; message: string }) => {
    const userId = socket.data.userId;

    let room = rooms.get(roomId);
    if (!room) {
      room = new Map();
      rooms.set(roomId, room);
    }

    let participant = room.get(userId);
    if (!participant) {
      participant = {
        id: userId,
        name: socket.data.userName ?? 'Anónimo',
        speaking: false,
        camOn: false,
        micOn: false,
      };
      room.set(userId, participant);
      io.to(roomId).emit('room-participants', Array.from(room.values()));
      console.log(`🔧 [Chat] Participante [${userId}] reinsertado en sala [${roomId}].`);
    }

    const author = participant.name;
    const newMessage = {
      id: Date.now(),
      author,
      text: message,
      createdAt: new Date(),
    };

    try {
      const { db } = await import('./firebase');
      await db.collection('rooms').doc(roomId).collection('messages').add(newMessage);
      console.log(`💾 [Chat] Mensaje guardado en Firestore para sala [${roomId}]`);
    } catch (err) {
      console.error('❌ [Chat] Error guardando mensaje en Firestore:', err);
    }

    io.to(roomId).emit('receive_message', newMessage);
  });

  // ─── Desconexión ──────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const userId = socket.data.userId;
    console.log(`🔴 [Socket Event] Desconectado: ${socket.id}, userId: ${userId}`);
    if (!userId) return;

    // Guardar salas afectadas ANTES de borrar al usuario
    const affectedRooms: string[] = [];
    rooms.forEach((participants, roomId) => {
      if (participants.has(userId)) {
        affectedRooms.push(roomId);
        participants.delete(userId);
        if (participants.size === 0) rooms.delete(roomId);
        else io.to(roomId).emit('room-participants', Array.from(participants.values()));
        console.log(`🧹 [CleanUp] Usuario [${userId}] removido de sala [${roomId}].`);
      }
    });

    // Diferir user-left-call 8 s: si reconecta antes, join-room cancela el timer
    const timer = setTimeout(() => {
      disconnectTimers.delete(userId);
      console.log(`⏰ [CleanUp] Gracia expirada para [${userId}]. Emitiendo user-left-call.`);
      affectedRooms.forEach(roomId => {
        io.to(roomId).emit('user-left-call', { userId });
      });
    }, 8000);

    disconnectTimers.set(userId, timer);
  });
});

// ── Registrar manejadores WebRTC ────────────────────────────────────
console.log('📹 [WebRTC] Vinculando manejadores de señalización...');
registerWebRTCHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`🚀 [Realtime Server] Servidor en tiempo real arriba en el puerto: ${PORT}`);
  console.log(`🔗 [Realtime Server] Origen permitido (CORS): ${CLIENT_ORIGIN}`);
});
