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

  // 💡 Interceptor de Socket.IO (No tocar, permite el paso de WSS)
  if (url.startsWith('/socket.io')) {
    return;
  }

  console.log(`📡 [HTTP Request] ${req.method} -> ${url}`);

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
    if (!await verifyToken(req, res)) {
      console.warn(`🔒 [HTTP Auth] Token rechazado o ausente en ruta: ${url}`);
      return;
    }
    await handleUsers(req, res, url.slice('/users'.length) || '');
    return;
  }

  const roomsMatch = url.match(/^\/rooms\/?([^/?]*)/);
  if (roomsMatch) {
    if (!await verifyToken(req, res)) {
      console.warn(`🔒 [HTTP Auth] Token rechazado o ausente en ruta de salas: ${url}`);
      return;
    }
    await handleRooms(req, res, roomsMatch[1] || undefined);
    return;
  }

  if (url.startsWith('/api-docs')) {
    handleApiDocs(req, res);
    return;
  }

  console.warn(`⚠️ [HTTP 404] No se encontró la ruta para: ${url}`);
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ── Socket.IO Server ────────────────────────────────────────────────
console.log('⚡ [Socket.IO] Inicializando servidor en modo WebSockets puros...');
const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket']
});

// Middleware de autenticación de Sockets
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  console.log(`🔒 [Socket Auth] Verificando handshake inicial para el socket: ${socket.id}`);
  
  if (!token) {
    console.error(`❌ [Socket Auth] Conexión denegada: No se proporcionó Token en el socket ${socket.id}`);
    return next(new Error('Token no proporcionado'));
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    socket.data.userId = decoded.uid;
    socket.data.email = decoded.email ?? '';
    console.log(`✅ [Socket Auth] Token verificado con éxito. UID Firebase: ${decoded.uid} (${decoded.email ?? 'Sin Email'})`);
    next();
  } catch (err: any) {
    console.error(`❌ [Socket Auth] Token inválido o expirado en socket ${socket.id}. Error:`, err.message);
    next(new Error('Token inválido'));
  }
});

// ── Eventos de salas y chat ─────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🟢 [Socket Event] Cliente conectado al servidor. Socket ID: ${socket.id}, UID: ${socket.data.userId}`);

  // ─── Unirse a sala ────────────────────────────────────────────────
  socket.on('join-room', ({ roomId, userName }: { roomId: string; userName: string }) => {
    const userId = socket.data.userId;
    if (!userId) {
      console.warn(`⚠️ [Room] Intento de join-room sin userId válido en socket: ${socket.id}`);
      return;
    }

    socket.data.name = userName;
    console.log(`🚪 [Room] Usuario '${userName}' (${userId}) solicita unirse a la sala de chat: ${roomId}`);

    socket.join(roomId);
    socket.join(userId); // Sala personal vital para señalización WebRTC individual
    console.log(`🔗 [Room] Socket ${socket.id} mapeado a sala '${roomId}' y a su canal privado '${userId}'`);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }

    rooms.get(roomId)!.set(userId, {
      id: userId,
      name: userName,
      speaking: false,
      camOn: false,
      micOn: false,
    });

    const participantList = Array.from(rooms.get(roomId)!.values());
    io.to(roomId).emit('room-participants', participantList);
    console.log(`👥 [Room] Lista actualizada de participantes enviada a sala [${roomId}]. Total: ${participantList.length}`);
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
      console.log(`📸 [Media] Estado actualizado para [${participant.name}]: Cam: ${camOn}, Mic: ${micOn}`);
      io.to(roomId).emit('room-participants', Array.from(room.values()));
    }
  });

  // ─── Abandonar sala ───────────────────────────────────────────────
  socket.on('leave-room', ({ roomId }: { roomId: string }) => {
    const userId = socket.data.userId;
    if (!userId) return;

    console.log(`🚪 [Room] El usuario (${userId}) está abandonando la sala: ${roomId}`);
    socket.leave(roomId);
    socket.leave(userId);

    const room = rooms.get(roomId);
    if (room) {
      room.delete(userId);
      if (room.size === 0) {
        console.log(`🗑️ [Room] Sala [${roomId}] vacía. Eliminando mapa de memoria.`);
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
    const author = participant?.name ?? socket.data.name ?? userId ?? 'Anónimo';

    console.log(`💬 [Chat] Mensaje recibido de [${author}] en sala [${roomId}]: "${message}"`);

    io.to(roomId).emit('receive_message', {
      id: Date.now(),
      author,
      text: message,
    });
  });

  // ─── Desconexión Física del Socket ──────────────────────────────────
  socket.on('disconnect', () => {
    const userId = socket.data.userId;
    console.log(`🔴 [Socket Event] Socket desconectado físicamente: ${socket.id}, userId vinculado: ${userId}`);
    if (!userId) return;
    console.log(`Socket desconectado: ${socket.id}, userId: ${userId}`);

    rooms.forEach((participants, roomId) => {
      if (participants.has(userId)) {
        console.log(`🧹 [CleanUp] Removiendo rastro del usuario [${userId}] de la sala [${roomId}] por desconexión.`);
        participants.delete(userId);

        // Forzar el aviso de WebRTC desde aquí
        io.to(roomId).emit('user-left-call', { userId });

        if (participants.size === 0) {
          console.log(`🗑️ [CleanUp] Sala [${roomId}] vacía tras desconexión abrupta. Eliminando mapa.`);
          rooms.delete(roomId);
        } else {
          // 3. Notificamos la lista actualizada de participantes
          io.to(roomId).emit('room-participants', Array.from(participants.values()));
        }
      }
    });
  });
});

// ── Registrar manejadores WebRTC ────────────────────────────────────
console.log('📹 [WebRTC] Vinculando manejadores externos de señalización...');
registerWebRTCHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`🚀 [Server] Backend arriba y escuchando solicitudes en el puerto: ${PORT}`);
  console.log(`🔗 [Server] Origen permitido (CORS Cliente): ${CLIENT_ORIGIN}`);
});