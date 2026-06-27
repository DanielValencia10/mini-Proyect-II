import { Server, Socket } from 'socket.io';

interface RTCSessionDescriptionInit {
    type: 'offer' | 'answer' | 'pranswer' | 'rollback';
    sdp: string;
}

interface RTCIceCandidateInit {
    candidate: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
}

/**
 * registerWebRTCHandlers
 * ----------------------
 * Registra en la instancia de Socket.io todos los eventos necesarios para:
 *  1. Gestionar la presencia de un usuario dentro de una llamada (join-call / leave-call).
 *  2. Retransmitir la señalización WebRTC entre pares (Offer, Answer, ICE Candidates).
 *
 * Patrón de salas usado:
 *  - `socket.data.userId`        → sala privada 1:1 por usuario (se usa como "buzón" para
 *                                   mensajes dirigidos a un peer específico mediante `to`).
 *  - `call:${roomId}`            → sala de llamada anidada dentro de una sala de chat;
 *                                   agrupa a todos los participantes que tienen su
 *                                   cámara/micrófono activos en esa sala.
 *
 * @param io Instancia global de Socket.io del servidor.
 */
// ─────────────────────────────────────────────────────────────────────────
// Estado de Screen Sharing por sala
// ─────────────────────────────────────────────────────────────────────────
// Mapa: roomId → conjunto de userIds que actualmente comparten pantalla.
// Vive en memoria del proceso; si se escala a múltiples instancias del
// servidor, debe moverse a un store compartido (Redis, etc.) igual que el
// resto del estado de salas.
const activeScreenShares: Map<string, Set<string>> = new Map();

function getActiveSharers(roomId: string): Set<string> {
    if (!activeScreenShares.has(roomId)) {
        activeScreenShares.set(roomId, new Set());
    }
    return activeScreenShares.get(roomId)!;
}

function stopSharing(roomId: string, userId: string): boolean {
    const sharers = getActiveSharers(roomId);
    const removed = sharers.delete(userId);
    // limpiar la sala si quedó vacía
    if (sharers.size === 0) {
        activeScreenShares.delete(roomId);
    }

    return removed;
}


function grantScreenShare(
    io: Server,
    roomId: string,
    userId: string
) {
    const sharers = getActiveSharers(roomId);
    
    if (sharers.has(userId)) {
        console.log(`🖥️  [SCREEN SHARE] El usuario [${userId}] ya está transmitiendo pantalla en la sala [${roomId}].`);
        return;
    }
    
    sharers.add(userId);
    
    // 🔥 LOG DETALLADO PARA EL SERVIDOR:
    console.log('\n=============================================================');
    console.log(`🖥️  [SCREEN SHARE START] ¡Nueva pantalla compartida detectada!`);
    console.log(`   └─ Usuario:  ${userId}`);
    console.log(`   └─ Sala ID:  ${roomId}`);
    console.log(`   └─ Compartiendo actualmente en esta sala: [${Array.from(sharers).join(', ')}]`);
    console.log('=============================================================\n');

    // Confirma al usuario que puede iniciar getDisplayMedia()
    io.to(userId).emit('screen-share-granted', { roomId });
    
    // Avisa a los demás participantes
    io.to(`call:${roomId}`)
        .except(userId)
        .emit('screen-share-started', { userId, roomId });
}

export function registerWebRTCHandlers(io: Server) {
    io.on('connection', (socket: Socket) => {
        console.log(
            `🔌 [registerWebRTCHandlers] Socket conectado. ID: ${socket.id}, UID: ${socket.data.userId}`
        );

        // Cada socket se une automáticamente a su propia "sala privada" (su userId).
        // Esto permite enviarle mensajes dirigidos (Offer/Answer/ICE) sin necesidad
        // de mantener un mapa manual de userId -> socket.id.
        if (socket.data.userId) {
            socket.join(socket.data.userId);

            console.log(
                `👤 [WebRTC Backend] Socket ${socket.id} unido a sala privada ${socket.data.userId}`
            );
        } else {
            console.warn(
                `⚠️ [WebRTC Backend] socket.data.userId viene vacío`
            );
        }

        /**
         * Evento: join-call
         * ------------------
         * Dirección: Cliente → Servidor
         * Se dispara cuando un usuario activa su cámara/micrófono y entra a la
         * llamada de una sala específica.
         *
         * Efectos:
         *  1. Une el socket a la sala anidada `call:${roomId}`.
         *  2. Notifica a los participantes ya presentes en la llamada (evento
         *     `user-joined-call`), excluyendo al emisor.
         *  3. Responde al propio emisor con la lista de participantes que ya
         *     estaban en la llamada (evento `existing-call-participants`), para
         *     que el cliente sepa con quién debe iniciar la negociación WebRTC
         *     (normalmente, el que llega de último envía la Offer a cada uno de
         *     los participantes existentes).
         *
         * @param payload.roomId  ID de la sala de chat a la que pertenece la llamada.
         *
         * @emits user-joined-call            → a `call:${roomId}` (excepto al emisor). Payload: { userId }
         * @emits existing-call-participants  → al propio emisor. Payload: { userIds: string[] }
         */
        socket.on('join-call', ({ roomId }: { roomId: string }) => {
            const userId = socket.data.userId;
            console.log(`📞 [WebRTC Backend] Usuario [${userId}] solicitó entrar a la llamada de la sala [${roomId}].`);

            // Unirse a la "sala de llamada" anidada
            socket.join(`call:${roomId}`);
            console.log(`➡️ [WebRTC Backend] Socket ${socket.id} unido exitosamente a la sala 'call:${roomId}'`);

            // Notificar SOLO a quienes ya están en la llamada (no a todo el chat)
            console.log(`📤 [WebRTC Backend] Notificando 'user-joined-call' a la sala [call:${roomId}] omitiendo al emisor.`);
            socket.to(`call:${roomId}`).emit('user-joined-call', {
                userId,
            });

            // Enviar al nuevo participante la lista de los que ya están en la llamada
            const socketsInCall = io.sockets.adapter.rooms.get(`call:${roomId}`);
            if (socketsInCall) {
                const existingUsers: string[] = [];
                for (const sid of socketsInCall) {
                    const s = io.sockets.sockets.get(sid);
                    if (s && s.data.userId !== userId) {
                        existingUsers.push(s.data.userId);
                    }
                }
                console.log(`👥 [WebRTC Backend] Enviando lista de participantes existentes a [${userId}]. Encontrados:`, existingUsers);
                socket.emit('existing-call-participants', { userIds: existingUsers });
            } else {
                console.log(`ℹ️ [WebRTC Backend] El usuario [${userId}] es el primero en unirse a la llamada.`);
            }
            console.log(
                'ROOM CALL:',
                Array.from(
                    io.sockets.adapter.rooms.get(`call:${roomId}`) || []
                )
            );
        });

        /**
         * Evento: leave-call
         * -------------------
         * Dirección: Cliente → Servidor
         * Se dispara cuando un usuario abandona voluntariamente la llamada
         * (por ejemplo, al apagar su cámara/micrófono o salir de la sala).
         *
         * Efectos:
         *  1. Saca al socket de la sala anidada `call:${roomId}`.
         *  2. Notifica a los demás participantes de la sala (evento `user-left-call`)
         *     para que limpien la conexión P2P y el video correspondientes a este usuario.
         *
         * @param payload.roomId  ID de la sala de chat/llamada que se abandona.
         *
         * @emits user-left-call → a `roomId`. Payload: { userId }
         */
        socket.on('leave-call', ({ roomId }: { roomId: string }) => {
            const userId = socket.data.userId;
            console.log(`🚪 [WebRTC Backend] El usuario [${userId}] abandonó voluntariamente la llamada de la sala [${roomId}].`);

            socket.leave(`call:${roomId}`);
            socket.to(roomId).emit('user-left-call', {
                userId,
            });

            // Si el usuario que se va estaba compartiendo pantalla, se notifica y limpia.
            if (getActiveSharers(roomId).has(userId)) {
                stopSharing(roomId, userId);
                socket.to(`call:${roomId}`).emit('screen-share-stopped', { userId, forced: false });
                console.log(`🖥️ [Screen Share] Limpieza automática: ${userId} dejó la llamada mientras compartía pantalla.`);
            }
        });

        /**
         * Evento: webrtc-offer
         * ----------------------
         * Dirección: Cliente → Servidor → Cliente destino
         * Primer paso de la negociación WebRTC. El cliente que origina la
         * llamada genera una Oferta SDP (`RTCSessionDescriptionInit` de tipo
         * "offer") y la envía dirigida a un peer específico mediante su `userId`.
         *
         * El servidor actúa como simple repetidor (relay): no interpreta ni
         * modifica el SDP, solo lo retransmite a la sala privada del destinatario.
         *
         * @param payload.roomId  ID de la sala de chat/llamada (informativo).
         * @param payload.offer   Descripción de sesión SDP tipo "offer".
         * @param payload.to      userId del peer destinatario de la oferta.
         *
         * @emits webrtc-offer → a la sala privada `data.to`. Payload: { offer, from: userId }
         */
        socket.on('webrtc-offer', (data: {
            roomId: string;
            offer: RTCSessionDescriptionInit;
            to: string;
        }) => {

            console.log(
                `🔥 [Señalización] OFERTA ${socket.data.userId} → ${data.to}`
            );

            console.log(
                `🔥 [Señalización] ¿Existe sala privada destino?`,
                io.sockets.adapter.rooms.has(data.to)
            );

            io.to(data.to).emit('webrtc-offer', {
                offer: data.offer,
                from: socket.data.userId,
            });
        });

        /**
         * Evento: webrtc-answer
         * ------------------------
         * Dirección: Cliente → Servidor → Cliente destino
         * Segundo paso de la negociación WebRTC. El cliente que recibió la
         * Oferta responde con una Respuesta SDP (`RTCSessionDescriptionInit`
         * de tipo "answer"), dirigida de vuelta al emisor original mediante `to`.
         *
         * Igual que con la oferta, el servidor solo retransmite el mensaje
         * sin modificarlo.
         *
         * @param payload.roomId  ID de la sala de chat/llamada (informativo).
         * @param payload.answer  Descripción de sesión SDP tipo "answer".
         * @param payload.to      userId del peer que originó la oferta.
         *
         * @emits webrtc-answer → a la sala privada `data.to`. Payload: { answer, from: userId }
         */
        socket.on('webrtc-answer', (data: {
            roomId: string;
            answer: RTCSessionDescriptionInit;
            to: string;
        }) => {

            console.log(
                `🤝 [Señalización] ANSWER ${socket.data.userId} → ${data.to}`
            );

            console.log(
                `🤝 [Señalización] ¿Existe sala privada destino?`,
                io.sockets.adapter.rooms.has(data.to)
            );

            io.to(data.to).emit('webrtc-answer', {
                answer: data.answer,
                from: socket.data.userId,
            });
        });

        /**
         * Evento: webrtc-ice-candidate
         * -------------------------------
         * Dirección: Cliente → Servidor → Cliente(s) destino
         * Tercer paso (continuo) de la negociación WebRTC. Cada vez que el
         * navegador descubre una nueva ruta de red posible (candidato ICE:
         * host, srflx o relay), la envía al/los peer(s) correspondientes para
         * que intenten establecer la conexión P2P directa.
         *
         * Este evento soporta dos modos de entrega:
         *  - Dirigido (`data.to` presente): se envía únicamente a la sala
         *    privada de ese userId. Se usa en llamadas 1:1 o cuando ya se
         *    conoce el peer exacto con el que se está negociando.
         *  - Broadcast a la llamada (`data.to` ausente): se envía a todos los
         *    sockets de `call:${data.roomId}` excepto al emisor. Útil en
         *    escenarios de múltiples participantes donde aún no se ha fijado
         *    una negociación 1:1 explícita.
         *
         * @param payload.roomId     ID de la sala de chat/llamada.
         * @param payload.candidate  Candidato ICE generado por el navegador.
         * @param payload.to         (opcional) userId del peer destinatario.
         *
         * @emits webrtc-ice-candidate → a `data.to` (si existe) o a `call:${data.roomId}` (broadcast).
         *                               Payload: { candidate, from: userId }
         */
        socket.on('webrtc-ice-candidate', (data: {
            roomId: string;
            candidate: RTCIceCandidateInit;
            to?: string;
        }) => {

            if (data.to) {

                console.log(
                    `❄️ ICE ${socket.data.userId} → ${data.to}`
                );

                console.log(
                    `❄️ ¿Existe sala privada destino?`,
                    io.sockets.adapter.rooms.has(data.to)
                );

                io.to(data.to).emit('webrtc-ice-candidate', {
                    candidate: data.candidate,
                    from: socket.data.userId,
                });

            } else {

                socket.to(`call:${data.roomId}`).emit(
                    'webrtc-ice-candidate',
                    {
                        candidate: data.candidate,
                        from: socket.data.userId,
                    }
                );
            }
        });

        // ─────────────────────────────────────────────────────────────────
        // SCREEN SHARING
        // ─────────────────────────────────────────────────────────────────

        /**
         * Evento: request-screen-share
         * -------------------------------
         * Dirección: Cliente → Servidor
         * El cliente NO empieza a compartir pantalla inmediatamente; primero
         * pide permiso al servidor. Esto permite resolver conflictos cuando
         * ya hay otro participante compartiendo (track adicional, no
         * reemplaza la cámara).
         *
         * Reglas de arbitraje:
         *  - Si nadie está compartiendo en la sala → se otorga de inmediato.
         *  - Si alguien ya está compartiendo y el solicitante NO es anfitrión
         *    → se le informa quién está compartiendo y se le pregunta si,
         *      aun así, desea compartir junto con esa persona (no puede
         *      forzar a nadie a detenerse).
         *  - Si alguien ya está compartiendo y el solicitante SÍ es anfitrión
         *    → se le ofrecen dos opciones: compartir junto con el otro
         *      usuario, o forzar la detención del compartir del otro usuario.
         *
         * @param payload.roomId  ID de la sala/llamada.
         *
         * @emits screen-share-granted   → al solicitante, si no hay conflicto. Payload: {}
         * @emits screen-share-conflict  → al solicitante, si hay conflicto.
         *        Payload: { activeSharers: string[], isHost: boolean }
         */
        socket.on('request-screen-share', async ({ roomId }: { roomId: string }) => {
            const userId = socket.data.userId;
            console.log(`🖥️ [Screen Share] ${userId} solicita compartir pantalla en [${roomId}]. Otorgando permiso inmediatamente.`);
            grantScreenShare(io, roomId, userId);
        });

        /**
         * Evento: stop-screen-share
         * ----------------------------
         * Dirección: Cliente → Servidor
         * El usuario deja de compartir pantalla voluntariamente.
         *
         * @param payload.roomId  ID de la sala/llamada.
         *
         * @emits screen-share-stopped → a `call:${roomId}`. Payload: { userId, forced: false }
         */
        socket.on('stop-screen-share', ({ roomId }: { roomId: string }) => {
            const userId = socket.data.userId;
            console.log(`🖥️ [Screen Share] ${userId} dejó de compartir pantalla en [${roomId}].`);

            stopSharing(roomId, userId);
            socket.to(`call:${roomId}`).emit('screen-share-stopped', { userId, forced: false });
        });

        /**
         * Evento: disconnect
         * --------------------
         * Dirección: Cliente → Servidor (automático)
         * Disparado automáticamente por Socket.io cuando el socket se
         * desconecta (cierre de pestaña, pérdida de red, etc.).
         *
         * NOTA: este handler solo registra el log de desconexión. La limpieza
         * de la sala de llamada (`call:${roomId}`) y la notificación
         * `user-left-call` a los demás participantes NO se realiza aquí
         * automáticamente; si se requiere ese comportamiento ante una
         * desconexión abrupta (no solo `leave-call` voluntario), debe
         * agregarse explícitamente en este handler.
         */
        socket.on('disconnect', () => {
            console.log(`🔌 [WebRTC Backend] Socket desconectado del handler de streaming. ID: ${socket.id}, UID: ${socket.data.userId}`);

            // Limpieza de screen sharing ante desconexión abrupta (sin leave-call previo):
            // se recorren las salas de llamada en las que estaba este socket y, si en
            // alguna figuraba como sharer activo, se notifica y se limpia el estado.
            const userId = socket.data.userId;
            for (const room of socket.rooms) {
                if (room.startsWith('call:')) {
                    const roomId = room.replace('call:', '');
                    
                    // Notificar a la sala que el usuario abandonó para que limpien su cámara/audio
                    socket.to(roomId).emit('user-left-call', { userId });
                    
                    if (getActiveSharers(roomId).has(userId)) {
                        stopSharing(roomId, userId);
                        socket.to(room).emit('screen-share-stopped', { userId, forced: false });
                        console.log(`🖥️ [Screen Share] Limpieza por desconexión abrupta: ${userId} compartía pantalla en [${roomId}].`);
                    }
                }
            }
        });
    });
}