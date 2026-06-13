import { IncomingMessage, ServerResponse } from 'http'
import { auth } from '../firebase'

export async function verifyToken(req: IncomingMessage, res: ServerResponse): Promise<string | null> {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'No autorizado: token requerido' }))
    return null
  }

  try {
    const decoded = await auth.verifyIdToken(token)
    return decoded.uid
  } catch {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Token inválido o expirado' }))
    return null
  }
}