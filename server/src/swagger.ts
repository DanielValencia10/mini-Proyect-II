import { IncomingMessage, ServerResponse } from 'http'
import { createReadStream } from 'fs'
import { join } from 'path'

const uiPath = join(__dirname, '../node_modules/swagger-ui-dist')

const spec = {
  swagger: '2.0',
  info: {
    title: 'StudyRoom API',
    description: 'API REST — plataforma de videoconferencia educativa universitaria',
    version: '1.0.0',
    contact: { name: 'Equipo StudyRoom' },
  },
  host: process.env.NODE_ENV === 'production'
    ? 'studyroom-server.onrender.com'
    : `localhost:${process.env.PORT ?? 3000}`,
  basePath: '/',
  schemes: process.env.NODE_ENV === 'production' ? ['https'] : ['http'],
  consumes: ['application/json'],
  produces: ['application/json'],

  tags: [
    { name: 'Health', description: 'Estado del servidor' },
    { name: 'Users',  description: 'Gestión de perfiles de usuario' },
    { name: 'Rooms',  description: 'Salas de estudio colaborativo' },
    { name: 'WebSocket - Salas', description: 'Eventos Socket.IO para gestión de salas en tiempo real (NO son endpoints HTTP)' },
    { name: 'WebSocket - Chat', description: 'Eventos Socket.IO para mensajería en tiempo real' },
    { name: 'WebSocket - Media', description: 'Eventos Socket.IO para estados AV y señalización WebRTC' },
  ],

  securityDefinitions: {
    BearerAuth: {
      type: 'apiKey',
      in: 'header',
      name: 'Authorization',
      description: 'Firebase ID Token. Formato: Bearer &lt;token&gt;',
    },
  },

  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Verifica que el servidor está activo',
        responses: {
          200: {
            description: 'Servidor activo',
            schema: {
              type: 'object',
              properties: {
                status:    { type: 'string', example: 'ok' },
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
    },

    '/users': {
      get: {
        tags: ['Users'],
        summary: 'Obtener todos los usuarios registrados',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Lista de usuarios',
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data:    { type: 'array', items: { $ref: '#/definitions/User' } },
              },
            },
          },
          401: { description: 'No autorizado' },
          500: { description: 'Error interno del servidor' },
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Crear un nuevo perfil de usuario',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: 'body',
            name: 'body',
            required: true,
            schema: { $ref: '#/definitions/UserInput' },
          },
        ],
        responses: {
          201: { description: 'Usuario creado exitosamente' },
          401: { description: 'No autorizado' },
          500: { description: 'Error al crear el usuario' },
        },
      },
    },

    '/users/check-username/{username}': {
      get: {
        tags: ['Users'],
        summary: 'Verificar disponibilidad de nombre de usuario',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'username',
            required: true,
            type: 'string',
            description: 'Nombre de usuario a verificar',
          },
        ],
        responses: {
          200: {
            description: 'Resultado de disponibilidad',
            schema: {
              type: 'object',
              properties: {
                available: { type: 'boolean', example: true },
              },
            },
          },
          401: { description: 'No autorizado' },
        },
      },
    },

    '/users/{uid}': {
      get: {
        tags: ['Users'],
        summary: 'Obtener usuario por UID de Firebase',
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'uid', required: true, type: 'string', description: 'UID de Firebase Auth' },
        ],
        responses: {
          200: {
            description: 'Usuario encontrado',
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data:    { $ref: '#/definitions/User' },
              },
            },
          },
          401: { description: 'No autorizado' },
          404: { description: 'Usuario no encontrado' },
        },
      },
      put: {
        tags: ['Users'],
        summary: 'Actualizar datos del usuario',
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'uid', required: true, type: 'string' },
          { in: 'body', name: 'body', required: true, schema: { $ref: '#/definitions/UserUpdate' } },
        ],
        responses: {
          200: { description: 'Usuario actualizado exitosamente' },
          401: { description: 'No autorizado' },
          500: { description: 'Error al actualizar' },
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Eliminar usuario por UID',
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'uid', required: true, type: 'string' },
        ],
        responses: {
          200: { description: 'Usuario eliminado exitosamente' },
          401: { description: 'No autorizado' },
          500: { description: 'Error al eliminar' },
        },
      },
    },

    '/rooms': {
      get: {
        tags: ['Rooms'],
        summary: 'Obtener todas las salas',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Lista de salas de estudio',
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data:    { type: 'array', items: { $ref: '#/definitions/Room' } },
              },
            },
          },
          401: { description: 'No autorizado' },
        },
      },
      post: {
        tags: ['Rooms'],
        summary: 'Crear una nueva sala de estudio',
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'body', name: 'body', required: true, schema: { $ref: '#/definitions/RoomInput' } },
        ],
        responses: {
          201: { description: 'Sala creada exitosamente' },
          401: { description: 'No autorizado' },
          500: { description: 'Error al crear la sala' },
        },
      },
    },

    '/rooms/{id}': {
      get: {
        tags: ['Rooms'],
        summary: 'Obtener sala por ID',
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, type: 'string', description: 'ID único de la sala' },
        ],
        responses: {
          200: { description: 'Sala encontrada' },
          401: { description: 'No autorizado' },
          404: { description: 'Sala no encontrada' },
        },
      },
      delete: {
        tags: ['Rooms'],
        summary: 'Eliminar sala',
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, type: 'string' },
        ],
        responses: {
          200: { description: 'Sala eliminada exitosamente' },
          401: { description: 'No autorizado' },
          500: { description: 'Error al eliminar la sala' },
        },
      },
    },

    // ── Documentación de eventos WebSocket (Socket.IO) ──────────────────
    // Nota: Estos NO son endpoints HTTP reales. Son eventos Socket.IO
    // documentados aquí como referencia para el equipo.

    '/socket.io/emit/join-room': {
      get: {
        tags: ['WebSocket - Salas'],
        summary: '[EMIT] join-room — Unirse a una sala',
        description: 'El cliente emite este evento al servidor para unirse a una sala.\n\n**Payload:** `{ roomId: string, userName: string }`\n\n**Respuesta del servidor:**\n- Evento `room-participants` con la lista actualizada de participantes.\n- Evento `chat-history` con los últimos 50 mensajes de la sala.',
        responses: { 200: { description: 'Evento documentado (no es un endpoint HTTP)' } },
      },
    },
    '/socket.io/emit/leave-room': {
      get: {
        tags: ['WebSocket - Salas'],
        summary: '[EMIT] leave-room — Abandonar una sala',
        description: 'El cliente emite este evento cuando sale de la sala.\n\n**Payload:** `{ roomId: string }`\n\n**Efecto:** El servidor elimina al usuario de la sala y emite `room-participants` actualizado.',
        responses: { 200: { description: 'Evento documentado' } },
      },
    },
    '/socket.io/on/room-participants': {
      get: {
        tags: ['WebSocket - Salas'],
        summary: '[ON] room-participants — Lista de participantes actualizada',
        description: 'El servidor emite este evento cada vez que un usuario entra o sale de la sala.\n\n**Payload:** `Participant[]` donde cada participante tiene: `{ id, name, speaking, camOn, micOn }`.',
        responses: { 200: { description: 'Evento documentado' } },
      },
    },
    '/socket.io/emit/send_message': {
      get: {
        tags: ['WebSocket - Chat'],
        summary: '[EMIT] send_message — Enviar mensaje de chat',
        description: 'El cliente envía un mensaje de texto a la sala.\n\n**Payload:** `{ roomId: string, message: string }`\n\n**Efecto:** El servidor guarda el mensaje en Firestore y emite `receive_message` a todos los participantes.',
        responses: { 200: { description: 'Evento documentado' } },
      },
    },
    '/socket.io/on/receive_message': {
      get: {
        tags: ['WebSocket - Chat'],
        summary: '[ON] receive_message — Recibir mensaje de chat',
        description: 'El servidor emite este evento a todos los participantes de la sala cuando alguien envía un mensaje.\n\n**Payload:** `{ id: number, author: string, text: string }`.',
        responses: { 200: { description: 'Evento documentado' } },
      },
    },
    '/socket.io/on/chat-history': {
      get: {
        tags: ['WebSocket - Chat'],
        summary: '[ON] chat-history — Historial de mensajes al unirse',
        description: 'El servidor emite este evento al usuario que se une a la sala, enviando los últimos 50 mensajes almacenados en Firestore.\n\n**Payload:** `MessageData[]` con `{ author, text, timestamp }`.',
        responses: { 200: { description: 'Evento documentado' } },
      },
    },
    '/socket.io/emit/update-media-state': {
      get: {
        tags: ['WebSocket - Media'],
        summary: '[EMIT] update-media-state — Cambiar estado de cámara/micrófono',
        description: 'El cliente notifica al servidor cuando cambia el estado de su cámara o micrófono.\n\n**Payload:** `{ roomId: string, camOn: boolean, micOn: boolean }`.',
        responses: { 200: { description: 'Evento documentado' } },
      },
    },
    '/socket.io/webrtc/offer-answer-ice': {
      get: {
        tags: ['WebSocket - Media'],
        summary: '[EMIT/ON] Señalización WebRTC (offer, answer, ice-candidate)',
        description: 'Eventos de señalización WebRTC para establecer conexiones P2P entre los participantes.\n\n**Eventos:**\n- `webrtc-offer`: Envía oferta SDP a un peer.\n- `webrtc-answer`: Envía respuesta SDP.\n- `webrtc-ice-candidate`: Envía candidato ICE.\n- `user-left-call`: Notifica que un usuario abandonó la llamada.',
        responses: { 200: { description: 'Evento documentado' } },
      },
    },
  },

  definitions: {
    User: {
      type: 'object',
      properties: {
        uid:       { type: 'string', example: 'firebase-uid-abc123' },
        email:     { type: 'string', format: 'email', example: 'juan@ejemplo.com' },
        username:  { type: 'string', example: 'juanperez' },
        nombres:   { type: 'string', example: 'Juan' },
        apellidos: { type: 'string', example: 'Pérez' },
        avatar:    { type: 'string', example: 'https://foto.com/avatar.jpg' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
    UserInput: {
      type: 'object',
      required: ['uid', 'email', 'username', 'nombres', 'apellidos'],
      properties: {
        uid:       { type: 'string' },
        email:     { type: 'string', format: 'email' },
        username:  { type: 'string' },
        nombres:   { type: 'string' },
        apellidos: { type: 'string' },
        avatar:    { type: 'string' },
      },
    },
    UserUpdate: {
      type: 'object',
      properties: {
        username:  { type: 'string' },
        nombres:   { type: 'string' },
        apellidos: { type: 'string' },
        avatar:    { type: 'string' },
      },
    },
    Room: {
      type: 'object',
      properties: {
        id:        { type: 'string', example: 'ABC123' },
        name:      { type: 'string', example: 'Sala de Cálculo' },
        ownerId:   { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
    RoomInput: {
      type: 'object',
      required: ['name', 'ownerId'],
      properties: {
        name:    { type: 'string', example: 'Sala de Álgebra' },
        ownerId: { type: 'string', example: 'firebase-uid-abc123' },
      },
    },
  },
}

const swaggerHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StudyRoom API Docs</title>
  <link rel="stylesheet" href="/api-docs/swagger-ui.css">
  <style>body { margin: 0; } .topbar { display: none; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/api-docs/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api-docs/swagger.json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis],
      layout: 'BaseLayout',
      deepLinking: true,
    })
  </script>
</body>
</html>`

const MIME: Record<string, string> = {
  '.css': 'text/css',
  '.js':  'application/javascript',
}

export function handleApiDocs(req: IncomingMessage, res: ServerResponse): void {
  const url = req.url ?? ''

  if (url === '/api-docs' || url === '/api-docs/') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(swaggerHtml)
    return
  }

  if (url === '/api-docs/swagger.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(spec, null, 2))
    return
  }

  const asset = url.replace('/api-docs/', '')
  const allowed = ['swagger-ui.css', 'swagger-ui-bundle.js', 'swagger-ui-standalone-preset.js']

  if (allowed.includes(asset)) {
    const ext = asset.endsWith('.css') ? '.css' : '.js'
    res.writeHead(200, { 'Content-Type': MIME[ext] })
    createReadStream(join(uiPath, asset)).pipe(res)
    return
  }

  res.writeHead(404)
  res.end()
}
