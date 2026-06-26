# 📚 StudyRoom - Plataforma de Salas de Estudio

Una aplicación web fullstack que permite a estudiantes crear y unirse a salas de estudio virtuales con chat en tiempo real, gestión de perfiles y salas colaborativas.

![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)
![Node Version](https://img.shields.io/badge/node-%3E%3D16-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## ✨ Características Principales

### 🔐 Autenticación & Usuarios
- **Registro e inicio de sesión** con email/contraseña
- **Autenticación con Google** (OAuth 2.0)
- **Gestión de perfil** completa:
  - Editar nombre, apellido, username
  - Cargar avatar mediante URL
  - Cambiar email con validación de disponibilidad
  - Validación en tiempo real de username duplicado
- **Contraseña segura**: Mínimo 8 caracteres, mayúscula, número y símbolo
- **Recuperación de contraseña** por email

### 🎓 Salas de Estudio
- **Crear salas** personalizadas
- **Unirse a salas** mediante ID único
- **Chat en tiempo real** con Socket.IO
- **Listado de participantes** activos
- **Eliminar salas** propias
- **IDs únicos** generados automáticamente

### 💬 Comunicación
- **Chat en tiempo real** dentro de cada sala
- **Notificación de participantes** entrando/saliendo
- **Historial de mensajes** (sesión actual)
- **Indicador de usuarios activos**

## 🏗️ Stack Tecnológico

### Frontend
- **React 18** - UI Library
- **TypeScript** - Type safety
- **Vite** - Build tool (fast development)
- **Tailwind CSS** - Styling
- **React Router v7** - Client-side routing
- **Zustand** - State management
- **Firebase SDK** - Authentication
- **Socket.IO Client** - Real-time communication
- **Lucide React** - Icons

### Backend
- **Node.js** - JavaScript runtime
- **TypeScript** - Type safety
- **Express-like HTTP Server** - Native Node.js
- **Firebase Admin SDK** - Database & Auth
- **Socket.IO** - WebSocket communication
- **Swagger/OpenAPI** - API Documentation
- **Nodemon** - Development auto-reload

### Base de Datos
- **Firestore** - NoSQL Cloud Database
- **Firebase Authentication** - Identity & Access

## 📋 Requisitos Previos

- **Node.js** v16 o superior
- **npm** o **yarn**
- **Firebase Project** (con Firestore y Authentication habilitados)
- **Google OAuth Credentials** (opcional, para login con Google)

## 🚀 Instalación y Setup

### 1. Clonar el repositorio

```bash
git clone https://github.com/DanielValencia10/mini-Proyect-II.git
cd mini-Proyect-II
```

### 2. Configurar Variables de Entorno

#### Root `.env`:
```bash
# Frontend (Vite)
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:000000000000000000
VITE_BACKEND_URL=http://localhost:3000
VITE_STUN_SERVER=stun:stun.l.google.com:19302

# Backend
FIREBASE_ADMIN_SDK_JSON={"type":"service_account",...}
PORT=3000
CLIENT_ORIGIN=http://localhost:5173
```

#### `client/.env`:
Copia las variables de Firebase del root:
```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
# ... (resto de variables Firebase)
VITE_BACKEND_URL=http://localhost:3000
VITE_STUN_SERVER=stun:stun.l.google.com:19302
```

### 3. Instalar Dependencias

```bash
# Frontend
cd client
npm install

# Backend
cd ../server
npm install
```

### 4. Configurar Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita **Firestore Database** en modo producción
4. Habilita **Authentication** con proveedores:
   - Email/Contraseña
   - Google
5. En **Configuración del proyecto → Cuentas de servicio**:
   - Genera nueva clave privada JSON
   - Copia el contenido como `FIREBASE_ADMIN_SDK_JSON`

## 🎯 Ejecutar la Aplicación

### Modo Desarrollo

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
# Escucha en http://localhost:3000
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
# Escucha en http://localhost:5173
```

La aplicación estará disponible en: **http://localhost:5173**

### Modo Producción

**Backend:**
```bash
cd server
npm run build
npm start
```

**Frontend:**
```bash
cd client
npm run build
# Genera carpeta `dist/` para servir en producción
```

## 📁 Estructura del Proyecto

```
mini-Proyect-II/
├── client/                          # Frontend React + Vite
│   ├── src/
│   │   ├── components/              # Componentes reutilizables
│   │   │   ├── AuthHeader.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── Toast.tsx
│   │   ├── features/                # Características específicas
│   │   │   ├── dashboard/
│   │   │   └── room/
│   │   ├── pages/                   # Páginas principales
│   │   │   ├── LandingPage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── UsernameSetupPage.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ProfilePage.tsx
│   │   │   └── RoomPage.tsx
│   │   ├── services/                # API calls
│   │   │   ├── userService.ts
│   │   │   └── roomService.ts
│   │   ├── stores/                  # Zustand stores
│   │   │   └── useAuthStore.ts
│   │   ├── hooks/                   # Custom React hooks
│   │   │   ├── useRoom.ts
│   │   │   ├── useRooms.ts
│   │   │   └── useSocket.ts
│   │   ├── lib/                     # Utilities
│   │   │   ├── authFetch.ts
│   │   │   └── firebase.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
│
├── server/                          # Backend Node.js + TypeScript
│   ├── src/
│   │   ├── dao/                     # Data Access Objects
│   │   │   ├── UserDao.ts
│   │   │   └── RoomDao.ts
│   │   ├── routes/                  # API Routes
│   │   │   ├── users.ts
│   │   │   └── rooms.ts
│   │   ├── middleware/              # Middlewares
│   │   │   └── auth.ts
│   │   ├── firebase.ts              # Firebase Admin setup
│   │   ├── swagger.ts               # API Documentation
│   │   └── index.ts                 # Server entry point
│   └── package.json
│
├── .env.example                     # Template de variables de entorno
└── README.md                        # Este archivo
```

## 🔌 Endpoints API

### Usuarios

#### GET `/users/check-username/:username`
Verificar disponibilidad de username (sin autenticación)
```bash
GET http://localhost:3000/users/check-username/juanperez
```
**Respuesta:**
```json
{ "available": true }
```

#### GET `/users/check-email/:email`
Verificar disponibilidad de email (sin autenticación, excluye uid actual)
```bash
GET http://localhost:3000/users/check-email/juan@correo.com?excludeUid=user123
```

#### GET `/users/:uid`
Obtener perfil de usuario (autenticado)
```bash
GET http://localhost:3000/users/user123
Authorization: Bearer <token>
```
**Respuesta:**
```json
{
  "success": true,
  "data": {
    "uid": "user123",
    "email": "juan@correo.com",
    "username": "juanperez",
    "nombres": "Juan",
    "apellidos": "Pérez",
    "avatar": "https://..."
  }
}
```

#### POST `/users`
Crear nuevo usuario (autenticado)
```bash
POST http://localhost:3000/users
Content-Type: application/json
Authorization: Bearer <token>

{
  "uid": "user123",
  "email": "juan@correo.com",
  "username": "juanperez",
  "nombres": "Juan",
  "apellidos": "Pérez",
  "avatar": "https://..."
}
```

#### PUT `/users/:uid`
Actualizar perfil de usuario (autenticado)
```bash
PUT http://localhost:3000/users/user123
Content-Type: application/json
Authorization: Bearer <token>

{
  "nombres": "Juan",
  "apellidos": "Pérez",
  "username": "juanperez",
  "avatar": "https://...",
  "email": "newemail@correo.com"
}
```

#### DELETE `/users/:uid`
Eliminar usuario (autenticado)
```bash
DELETE http://localhost:3000/users/user123
Authorization: Bearer <token>
```

### Salas

#### GET `/rooms`
Obtener todas las salas del usuario (autenticado)
```bash
GET http://localhost:3000/rooms
Authorization: Bearer <token>
```

#### POST `/rooms`
Crear nueva sala (autenticado)
```bash
POST http://localhost:3000/rooms
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Cálculo Diferencial"
}
```

#### DELETE `/rooms/:id`
Eliminar sala (autenticado)
```bash
DELETE http://localhost:3000/rooms/ROOM123
Authorization: Bearer <token>
```

### 🔌 Arquitectura en Tiempo Real: WebSocket y WebRTC P2P

La plataforma cuenta con un sistema de comunicación en tiempo real que soporta mensajería de chat (Firestore + WebSockets) y videoconferencia multiusuario P2P (WebRTC) con compartición de pantalla.

#### 1. Arquitectura de Señalización y Flujo P2P (WebRTC)

Para establecer las conexiones directas punto a punto (P2P), se utiliza Socket.IO como servidor de señalización. El flujo sigue el estándar de **Negociación Perfecta (Perfect Negotiation)**:
- **Roles Polite / Impolite**: En llamadas multiusuario, las colisiones de ofertas (glare) se resuelven asignando un rol `polite` al usuario con el `userId` lexicográficamente menor (`currentUserId < remoteUserId`). El usuario `polite` cancela su oferta y acepta la oferta del peer `impolite` en caso de colisión, evitando que la llamada falle.
- **Intercambio de Candidatos ICE**: Los candidatos ICE recolectados por el navegador son enviados mediante el canal de comunicación en tiempo real y aplicados de manera diferida si la descripción remota SDP aún no ha sido establecida.
- **Infraestructura NAT Traversal**: Se configuran servidores **STUN** públicos (Google) y **TURN** con autenticación (Metered) para garantizar la conectividad de red incluso detrás de firewalls y NAT simétricos.

#### 2. Eventos de WebSocket (Socket.IO)

##### 💬 Chat y Presencia
- `join-room` (Cliente ➔ Servidor): Emite el ID de la sala (`roomId`) y el nombre del usuario para unirse. Registra al usuario en la base de datos en memoria del servidor.
- `leave-room` (Cliente ➔ Servidor): Sale de la sala e informa a los demás participantes.
- `send_message` (Cliente ➔ Servidor): Envía un mensaje en la sala, guardándolo de forma persistente en Firestore y retransmitiéndolo en tiempo real.
- `receive_message` (Servidor ➔ Cliente): Transmite un nuevo mensaje de chat a los miembros de la sala.
- `room-participants` (Servidor ➔ Cliente): Envía la lista actualizada de participantes activos en la sala, incluyendo sus estados en tiempo real (`camOn`, `micOn`, `speaking`).
- `update-media-state` (Cliente ➔ Servidor): Notifica un cambio de estado en la cámara (`camOn`) o micrófono (`micOn`) del usuario local. El servidor actualiza el registro en memoria y emite `room-participants`.

##### 📹 Videollamadas (WebRTC)
- `join-call` (Cliente ➔ Servidor): Solicita unirse a la sala de llamada física `call:${roomId}`.
- `user-joined-call` (Servidor ➔ Cliente): Avisa a los usuarios en la llamada que un nuevo participante ha ingresado, indicándole que inicie la negociación (envío de SDP Offer).
- `existing-call-participants` (Servidor ➔ Cliente): Retorna al usuario que se acaba de conectar la lista de `userId` que ya están en la llamada para iniciar la conexión P2P con cada uno de ellos.
- `webrtc-offer` (Cliente ➔ Servidor ➔ Cliente): Retransmite la oferta SDP (`offer`) al usuario de destino (`to`).
- `webrtc-answer` (Cliente ➔ Servidor ➔ Cliente): Retransmite la respuesta SDP (`answer`) al creador de la oferta (`to`).
- `webrtc-ice-candidate` (Cliente ➔ Servidor ➔ Cliente/Sala): Retransmite un candidato ICE al destinatario final para establecer o restablecer la conexión P2P.
- `leave-call` (Cliente ➔ Servidor): Abandona voluntariamente la llamada activa de la sala.
- `user-left-call` (Servidor ➔ Cliente): Notifica que un participante ha salido (o se ha desconectado tras un período de gracia de 8 segundos) para cerrar su `RTCPeerConnection` y limpiar su track de video en la interfaz.

##### 🖥️ Compartición de Pantalla
- `request-screen-share` (Cliente ➔ Servidor): El cliente solicita permiso para compartir pantalla.
- `screen-share-granted` (Servidor ➔ Cliente): Confirma la autorización de compartir pantalla para que el cliente capture su desktop usando `getDisplayMedia`.
- `screen-share-conflict` (Servidor ➔ Cliente): Si otro usuario ya está compartiendo pantalla, envía los sharers activos y determina si el solicitante es el Host (Creador de la sala) para permitirle forzar detener la transmisión de los demás.
- `resolve-screen-share-conflict` (Cliente ➔ Servidor): Envía la acción elegida para resolver el conflicto (`proceed` para compartir en paralelo, `cancel` para desistir, o `stop-other` si es Host y desea detener la transmisión de los demás).
- `screen-share-started` (Servidor ➔ Cliente): Avisa a los demás participantes que un usuario ha comenzado a compartir pantalla.
- `stop-screen-share` (Cliente ➔ Servidor): Notifica que el usuario ha dejado de compartir pantalla voluntariamente.
- `screen-share-stopped` (Servidor ➔ Cliente): Informa a los clientes remotos que se ha detenido una compartición de pantalla para que eliminen el stream secundario.
- `force-stop-screen-share` (Servidor ➔ Cliente): Ordena a un participante detener su compartición de pantalla de forma mandatoria (invocado por el Host mediante `stop-other`).

## 🔐 Características de Seguridad

- ✅ **Autenticación Firebase** - Tokens JWT seguros
- ✅ **CORS configurado** - Solo origen autorizado
- ✅ **Validación de emails** - No permite duplicados
- ✅ **Validación de usernames** - Únicos por usuario
- ✅ **Contraseñas encriptadas** - Firebase Auth
- ✅ **Autorización por token** - Endpoints protegidos
- ✅ **HTTPS recomendado** - En producción

## 📋 Historias de Usuario Implementadas

### US-01: Autenticación
- [x] Registro con email/contraseña
- [x] Validaciones de contraseña fuerte
- [x] Login con Google
- [x] Recuperación de contraseña

### US-02: Gestión de Salas
- [x] Crear salas de estudio
- [x] Unirse a salas por ID
- [x] Listar salas personales
- [x] Eliminar salas

### US-03: Chat en Tiempo Real
- [x] Enviar mensajes en sala
- [x] Ver participantes activos
- [x] Notificaciones de entrada/salida

### US-04: Edición de Perfil
- [x] Ver datos personales
- [x] Editar nombre y apellido
- [x] Cambiar username (con validación)
- [x] Cambiar email (con validación)
- [x] Cargar avatar por URL
- [x] Validación de disponibilidad en tiempo real

## 🛠️ Desarrollo

### Scripts Disponibles

**Frontend:**
```bash
npm run dev      # Iniciar servidor de desarrollo
npm run build    # Compilar para producción
npm run preview  # Previsualizar build de producción
npm run lint     # Ejecutar ESLint
```

**Backend:**
```bash
npm run dev      # Iniciar con nodemon
npm run build    # Compilar TypeScript
npm start        # Iniciar build compilado
npm run lint     # Ejecutar ESLint
```

### Convenciones de Código

- **TypeScript** en todas partes
- **Nombres en inglés** para código, comentarios si es necesario
- **Camel case** para variables y funciones
- **PascalCase** para componentes y clases
- **SCREAMING_SNAKE_CASE** para constantes
- **Tailwind CSS** para estilos (sin CSS custom si es posible)
- **No comments** innecesarios (código auto-explicativo)

## 🚨 Troubleshooting

### "Cannot find module 'firebase'"
```bash
cd client && npm install
```

### "VITE_BACKEND_URL is undefined"
Verifica que `.env` esté en la raíz del proyecto `client/` con:
```
VITE_BACKEND_URL=http://localhost:3000
```

### "Firebase Admin SDK JSON is invalid"
Asegúrate que `FIREBASE_ADMIN_SDK_JSON` esté en una sola línea sin saltos.

### "Port 3000 is already in use"
```bash
# Cambiar puerto en .env
PORT=3001
```

### Socket.IO no conecta
- Verifica que el backend esté corriendo: `http://localhost:3000`
- Revisa CORS en `server/src/index.ts`
- Limpia caché del navegador

## 📱 Características Futuras

- [ ] Video conferencia integrada
- [ ] Almacenamiento de historial de chat
- [ ] Sistema de notificaciones
- [ ] Roles (Profesor/Estudiante)
- [ ] Calendarios de sesiones
- [ ] Integración con Google Calendar
- [ ] Reacciones en mensajes
- [ ] Buscar salas públicas
- [ ] Invitaciones por email

## 📝 Commits y Rama

Este proyecto usa branching strategy con ramas feature (`fernandez`, `develop`, `valencia`).

Para contribuir:
1. Crea rama feature: `git checkout -b feature/nueva-feature`
2. Haz commits descriptivos: `git commit -m "feat: descripción"`
3. Push a tu rama: `git push origin feature/nueva-feature`
4. Crea Pull Request a `develop`

## 📄 Licencia

MIT License - Ver archivo LICENSE para más detalles.

## 👥 Autores

- **Daniel Valencia** - Backend & Arquitectura
- **Santiago Fernández** - Frontend & Perfil de Usuario

## 📞 Soporte

Para reportar bugs o sugerir features, abre un [Issue](https://github.com/DanielValencia10/mini-Proyect-II/issues).

---

**Hecho con ❤️ para estudiantes que quieren estudiar juntos**
