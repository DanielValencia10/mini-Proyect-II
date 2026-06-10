import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import useAuthStore from '../stores/useAuthStore';

interface Participant {
    id: string;
    name: string;
    speaking: boolean;
    camOn: boolean;
    micOn: boolean;
}

let socket: Socket | null = null;

export function useSocket(roomId: string) {
    const { userLogged, token } = useAuthStore();
    const uid = userLogged?.uid;
    const displayName = userLogged?.displayName ?? 'Anónimo';
    const [participants, setParticipants] = useState<Participant[]>([]);
    const socketRef = useRef(socket);

    // Sincroniza el módulo socket con la referencia
    useEffect(() => {
        socketRef.current = socket;
    }, [socket]);

    // Creación/recreación del socket cuando cambia el token
    useEffect(() => {
        if (!uid || !token) return;

        // Obtenemos el socket actual desde la referencia para evitar mutar variables externas
        const currentSocket = socketRef.current;

        if (currentSocket) {
            const socketAuth = (currentSocket as unknown as { auth?: { token?: string } }).auth;

            if (socketAuth?.token !== token) {
                currentSocket.disconnect();
                socketRef.current = null;
            }
        }

        if (!socketRef.current) {
            const backendUrl = import.meta.env.VITE_BACKEND_URL;

            socketRef.current = io(backendUrl, {
                auth: { token },
                transports: ['websocket'],
                upgrade: false,
                withCredentials: true
            });


            socketRef.current.on('connect', () => {
                console.log('[Socket] ¡Conectado exitosamente a Render!');
            });

            socketRef.current.on('connect_error', (err) => {
                console.error(' [Socket] Error de conexión:', err.message);
            });
        }

    }, [token, uid]);

    // Manejo de la sala y escucha de participantes
    useEffect(() => {
        const currentSocket = socketRef.current;
        if (!uid || !currentSocket) return;

        currentSocket.emit('join-room', {
            roomId,
            userId: uid,
            userName: displayName,
        });

        const handleParticipants = (data: Participant[]) => setParticipants(data);
        currentSocket.on('room-participants', handleParticipants);

        return () => {
            if (currentSocket.connected) {
                currentSocket.emit('leave-room', { roomId, userId: uid });
            }
            currentSocket.off('room-participants', handleParticipants);
        };
    }, [roomId, uid, displayName]);

    const disconnectSocket = useCallback(() => {
        if (socket) {
            socket.disconnect();
            socket = null;
            socketRef.current = null;
            setParticipants([]);
        }
    }, []);

    return { participants, socket: socketRef.current, disconnectSocket };
}