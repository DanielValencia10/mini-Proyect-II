import { IncomingMessage, ServerResponse } from 'http'
import UserDao, { UserData } from '../dao/UserDao'

const dao = new UserDao()

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

export const handleUsers = async (
  req: IncomingMessage,
  res: ServerResponse,
  uid?: string,
): Promise<void> => {
  // GET /users/:uid
  if (req.method === 'GET' && uid) {
    const result = await dao.getUserById(uid)
    return send(res, result.success ? 200 : 404, result)
  }

  // POST /users
  if (req.method === 'POST') {
    const body = await parseBody(req) as UserData
    const result = await dao.createUser(body)
    return send(res, result.success ? 201 : 500, result)
  }

  // PUT /users/:uid
  if (req.method === 'PUT' && uid) {
    const body = await parseBody(req) as Partial<Omit<UserData, 'uid' | 'email'>>
    const result = await dao.updateUser(uid, body)
    return send(res, result.success ? 200 : 500, result)
  }

  // DELETE /users/:uid
  if (req.method === 'DELETE' && uid) {
    const result = await dao.deleteUser(uid)
    return send(res, result.success ? 200 : 500, result)
  }

  send(res, 405, { error: 'Method not allowed' })
}
