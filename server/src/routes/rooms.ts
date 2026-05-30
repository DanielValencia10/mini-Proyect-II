import { IncomingMessage, ServerResponse } from 'http'
import RoomDao, { RoomData } from '../dao/RoomDao'

const dao = new RoomDao()

const parseBody = (req: IncomingMessage): Promise<unknown> =>
    new Promise((resolve, reject) => {
        let body = ''
        req.on('data', (chunk) => { body += chunk.toString() })
        req.on('end', () => {
            try { resolve(body ? JSON.parse(body) : {}) }
            catch { reject(new Error('Invalid JSON')) }
        })
    })

const send = (res: ServerResponse, status: number, data: unknown): void => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
}

export const handleRooms = async (
    req: IncomingMessage,
    res: ServerResponse,
    id?: string,
): Promise<void> => {
    const url = req.url ?? '/'

    // GET /rooms?ownerId=xxx
    if (req.method === 'GET' && !id) {
        const ownerId = new URL(url, 'http://x').searchParams.get('ownerId')
        if (ownerId) {
            const result = await dao.getRoomsByOwner(ownerId)
            return send(res, result.success ? 200 : 500, result)
        }
        return send(res, 400, { error: 'ownerId requerido' })
    }

    // GET /rooms/:id
    if (req.method === 'GET' && id) {
        const result = await dao.getRoomById(id)
        return send(res, result.success ? 200 : 404, result)
    }

    // POST /rooms
    if (req.method === 'POST') {
        const body = await parseBody(req) as RoomData
        const result = await dao.createRoom(body)
        return send(res, result.success ? 201 : 500, result)
    }

    // PUT /rooms/:id
    if (req.method === 'PUT' && id) {
        const body = await parseBody(req) as Partial<Omit<RoomData, 'id' | 'ownerId'>>
        const result = await dao.updateRoom(id, body)
        return send(res, result.success ? 200 : 500, result)
    }

    // DELETE /rooms/:id
    if (req.method === 'DELETE' && id) {
        const result = await dao.deleteRoom(id)
        return send(res, result.success ? 200 : 500, result)
    }

    send(res, 405, { error: 'Method not allowed' })
}