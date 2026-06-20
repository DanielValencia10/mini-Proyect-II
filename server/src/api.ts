import { createServer, IncomingMessage, ServerResponse } from 'http';
import { handleUsers } from './routes/users';
import { handleRooms } from './routes/rooms';
import { handleApiDocs } from './swagger';
import { verifyToken } from './middleware/auth';

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const PORT = process.env.API_PORT ?? process.env.PORT ?? 3000;

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

  console.log(`📡 [HTTP Request] ${req.method} -> ${url}`);

  if (req.method === 'GET' && url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', server: 'api', timestamp: new Date().toISOString() }));
    return;
  }

  if (req.method === 'GET' && url.startsWith('/users/check-username/')) {
    await handleUsers(req, res, url.slice('/users'.length) || '');
    return;
  }

  if (url.startsWith('/users')) {
    const uid = await verifyToken(req, res);
    if (!uid) {
      console.warn(`🔒 [HTTP Auth] Token rechazado o ausente en ruta: ${url}`);
      return;
    }
    await handleUsers(req, res, url.slice('/users'.length) || '');
    return;
  }

  // GET /rooms/:id/messages — historial de chat desde Firestore
  const messagesMatch = url.match(/^\/rooms\/([^/?]+)\/messages$/);
  if (messagesMatch) {
    const uid = await verifyToken(req, res);
    if (!uid) return;
    try {
      const { db } = await import('./firebase');
      const snap = await db.collection('rooms').doc(messagesMatch[1])
        .collection('messages').orderBy('createdAt', 'asc').limit(100).get();
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: msgs }));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, data: [] }));
    }
    return;
  }

  const roomsMatch = url.match(/^\/rooms\/?([^/?]*)/);
  if (roomsMatch) {
    const uid = await verifyToken(req, res);
    if (!uid) {
      console.warn(`🔒 [HTTP Auth] Token rechazado o ausente en ruta de salas: ${url}`);
      return;
    }
    await handleRooms(req, res, roomsMatch[1] || undefined, uid);
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

httpServer.listen(PORT, () => {
  console.log(`🚀 [API Server] Servidor REST arriba en el puerto: ${PORT}`);
  console.log(`🔗 [API Server] Origen permitido (CORS): ${CLIENT_ORIGIN}`);
});
