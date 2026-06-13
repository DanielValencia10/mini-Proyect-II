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

export function registerWebRTCHandlers(io: Server) {
    io.on('connection', (socket: Socket) => {
        console.log(
            `🔌 [registerWebRTCHandlers] Socket conectado. ID: ${socket.id}, UID: ${socket.data.userId}`
        );

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
        // ── 1. Cuando un usuario activa su cámara/micrófono ─────────────────────────────
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

        // ── 2. Abandonar llamada voluntariamente ──────────────────────────────────────────
        socket.on('leave-call', ({ roomId }: { roomId: string }) => {
            const userId = socket.data.userId;
            console.log(`🚪 [WebRTC Backend] El usuario [${userId}] abandonó voluntariamente la llamada de la sala [${roomId}].`);

            socket.leave(`call:${roomId}`);
            socket.to(roomId).emit('user-left-call', {
                userId,
            });
        });

        // ── 3. Señalización WebRTC - OFERTA ───────────────────────────────────────────────
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
        // ── 4. Señalización WebRTC - RESPUESTA ────────────────────────────────────────────
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

        // ── 5. Señalización WebRTC - CANDIDATOS ICE ───────────────────────────────────────
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
        // ── 6. Limpieza al desconectar ────────────────────────────────────────────────────
        socket.on('disconnect', () => {
            console.log(`🔌 [WebRTC Backend] Socket desconectado del handler de streaming. ID: ${socket.id}, UID: ${socket.data.userId}`);
        });
    });
}