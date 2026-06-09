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

        // Cuando un usuario activa su cámara/micrófono
        socket.on('join-call', ({ roomId }: { roomId: string }) => {
            const userId = socket.data.userId;
            // Unirse a la "sala de llamada" anidada
            socket.join(`call:${roomId}`);

            // Notificar a los demás en la sala de chat que alguien se unió a la llamada
            socket.to(roomId).emit('user-joined-call', {
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
                socket.emit('existing-call-participants', { userIds: existingUsers });
            }
        });

        socket.on('leave-call', ({ roomId }: { roomId: string }) => {
            socket.leave(`call:${roomId}`);
            socket.to(roomId).emit('user-left-call', {
                userId: socket.data.userId,
            });
        });

        // Señalización WebRTC
        socket.on('webrtc-offer', (data: {
            roomId: string;
            offer: RTCSessionDescriptionInit;
            to: string; // Recibe el userId del destinatario
        }) => {
            console.log(`Reenviando Oferta de: ${socket.data.userId} hacia: ${data.to}`);
            // Enviamos a la sala individual del destinatario objetivo
            io.to(data.to).emit('webrtc-offer', {
                offer: data.offer,
                from: socket.data.userId, // Modificado: Mandamos el UID de Firebase 
            });
        });

        // Señalización WebRTC - RESPUESTA
        socket.on('webrtc-answer', (data: {
            roomId: string;
            answer: RTCSessionDescriptionInit;
            to: string; // Recibe el userId del destinatario
        }) => {
            console.log(`Reenviando Respuesta de: ${socket.data.userId} hacia: ${data.to}`);
            io.to(data.to).emit('webrtc-answer', {
                answer: data.answer,
                from: socket.data.userId, // Modificado: Mandamos el UID de Firebase 
            });
        });

        // Señalización WebRTC - CANDIDATOS ICE
        socket.on('webrtc-ice-candidate', (data: {
            roomId: string;
            candidate: RTCIceCandidateInit;
            to?: string; // Recibe el userId del destinatario
        }) => {
            if (data.to) {
                // Enviar solo al destinatario específico (Sala individual de Firebase UID)
                io.to(data.to).emit('webrtc-ice-candidate', {
                    candidate: data.candidate,
                    from: socket.data.userId, // Modificado: Mandamos el UID de Firebase
                });
            } else {
                // Broadcast a toda la sala de videollamada, excepto al emisor
                socket.to(`call:${data.roomId}`).emit('webrtc-ice-candidate', {
                    candidate: data.candidate,
                    from: socket.data.userId, // Modificado: Mandamos el UID de Firebase
                });
            }
        });

        // Limpieza al desconectar
        socket.on('disconnect', () => {
           
        });
    });
}