import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server } from 'socket.io'
import { handleUsers } from './routes/users'
import { handleRooms } from './routes/rooms'

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'
const PORT = process.env.PORT ?? 3000

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  res.setHeader('Access-Control-Allow-Origin', CLIENT_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = req.url ?? '/'

  if (req.method === 'GET' && url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }))
    return
  }

  const usersMatch = url.match(/^\/users\/?([^/]*)$/)
  if (usersMatch) {
    const uid = usersMatch[1] || undefined
    await handleUsers(req, res, uid)
    return
  }

  const roomsMatch = url.match(/^\/rooms\/?([^/?]*)/)
  if (roomsMatch) {
    const id = roomsMatch[1] || undefined
    await handleRooms(req, res, id)
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
  },
})

// Mapa de salas: roomId -> participantes
const rooms = new Map<string, Map<string, { id: string; name: string; speaking: boolean }>>()

io.on('connection', (socket) => {
  console.log(`Socket conectado: ${socket.id}`)

  socket.on('join-room', ({ roomId, userId, userName }: { roomId: string; userId: string; userName: string }) => {
    socket.join(roomId)

    if (!rooms.has(roomId)) rooms.set(roomId, new Map())
    rooms.get(roomId)!.set(userId, { id: userId, name: userName, speaking: false })

    io.to(roomId).emit('room-participants', Array.from(rooms.get(roomId)!.values()))
    console.log(`${userName} entró a la sala ${roomId}`)
  })

  socket.on('leave-room', ({ roomId, userId }: { roomId: string; userId: string }) => {
    socket.leave(roomId)
    rooms.get(roomId)?.delete(userId)

    if (rooms.get(roomId)?.size === 0) {
      rooms.delete(roomId)
    } else {
      io.to(roomId).emit('room-participants', Array.from(rooms.get(roomId)!.values()))
    }
  })

  socket.on('disconnect', () => {
    console.log(`Socket desconectado: ${socket.id}`)
    // Limpiar al usuario de todas las salas si se desconecta abruptamente
    rooms.forEach((participants, roomId) => {
      participants.forEach((_, userId) => {
        if (userId === socket.id) {
          participants.delete(userId)
          io.to(roomId).emit('room-participants', Array.from(participants.values()))
        }
      })
    })
  })
})

httpServer.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`)
})