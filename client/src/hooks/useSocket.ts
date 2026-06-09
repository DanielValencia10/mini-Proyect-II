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

        // Si el socket existe pero el token ha cambiado, lo cerramos
        if (socket && (socket as any).auth?.token !== token) {
            socket.disconnect();
            socket = null;
        }

        if (!socket) {
            socket = io(import.meta.env.VITE_BACKEND_URL, {
                auth: { token },
            });
            socketRef.current = socket;
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