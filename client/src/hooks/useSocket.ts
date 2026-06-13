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
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef(socket);
    const roomIdRef = useRef(roomId);
    const displayNameRef = useRef(displayName);
    const uidRef = useRef(uid);

    // Mantiene los refs actualizados en cada render
    useEffect(() => {
        socketRef.current = socket;
        roomIdRef.current = roomId;
        displayNameRef.current = displayName;
        uidRef.current = uid;
    });

    // ── 1. Creación/recreación del socket cuando cambia el token ──────────────────────
    useEffect(() => {
        console.log('🔄 [useSocket] Ejecutando efecto de inicialización de conexión...', { uid: !!uid, token: !!token });
        if (!uid || !token) {
            console.warn('⚠️ [useSocket] Conexión cancelada: uid o token ausentes.');
            return;
        }

        const currentSocket = socketRef.current;

        if (currentSocket) {
            const socketAuth = (currentSocket as unknown as { auth?: { token?: string } }).auth;
            if (socketAuth?.token !== token) {
                console.log('🔄 [useSocket] Token viejo detectado. Desconectando e intercambiando...');
                currentSocket.disconnect();
                socketRef.current = null;
                socket = null;
                setIsConnected(false);
            }
        }

        if (!socketRef.current) {
            const backendUrl = import.meta.env.VITE_REALTIME_URL ?? import.meta.env.VITE_BACKEND_URL;
            console.log('🌐 [useSocket] Intentando instanciar io() hacia la URL:', backendUrl);

            const newSocket = io(backendUrl, {
                auth: { token },
                transports: ['polling', 'websocket'],
                withCredentials: true,
            });

            socketRef.current = newSocket;
            socket = newSocket;

            newSocket.on('connect', () => {
                console.log(`✅ [useSocket] ¡Socket conectado! ID: ${newSocket.id}`);
                setIsConnected(true);
            });

            newSocket.on('connect_error', (err) => {
                console.error('❌ [useSocket] Error en el canal de comunicación:', err.message);
                setIsConnected(false);
            });

            newSocket.on('disconnect', (reason) => {
                console.log('❌ SOCKET DESCONECTADO:', reason);
                setIsConnected(false);
            });

            newSocket.io.on('reconnect_attempt', () => {
                console.log('🔄 INTENTANDO RECONECTAR');
            });

            newSocket.io.on('reconnect', () => {
                console.log('✅ SOCKET RECONECTADO');
            });
        } else {
            console.log('ℹ️ [useSocket] Reutilizando instancia de socket existente.');

            if (socketRef.current.connected) {
                console.log('✅ [useSocket] Socket reutilizado ya conectado. Sincronizando isConnected...');
                setIsConnected(true);
            } else {
                console.log('⏳ [useSocket] Socket reutilizado aún no conectado.');
                setIsConnected(false);
                socketRef.current.once('connect', () => {
                    console.log(`✅ [useSocket] Socket reutilizado conectado. ID: ${socketRef.current?.id}`);
                    setIsConnected(true);
                });
            }
        }

    }, [token, uid]);

    // ── 2. Unirse a la sala — solo cuando isConnected es true ────────────────────────
    useEffect(() => {
        const currentSocket = socketRef.current;

        if (!uid || !currentSocket || !isConnected) {
            console.warn('⚠️ [useSocket] No se puede unir a la sala: socket no listo aún.');
            return;
        }

        console.log(`📤 [useSocket] Emitiendo 'join-room' a la sala [${roomId}] para: ${displayName}`);
        currentSocket.emit('join-room', {
            roomId,
            userId: uid,
            userName: displayName,
        });

        const handleParticipants = (data: Participant[]) => {
            console.log('👥 [useSocket] Participantes actualizados:', data);
            setParticipants(data);
        };

        currentSocket.on('room-participants', handleParticipants);

        return () => {
            console.log(`🛑 [useSocket] Desmontando sala [${roomId}].`);
            if (currentSocket.connected) {
                currentSocket.emit('leave-room', { roomId, userId: uid });
            }
            currentSocket.off('room-participants', handleParticipants);
        };
    }, [roomId, uid, displayName, isConnected]);

    // ── 3. Método manual de desconexión completa ─────────────────────────────────────
    const disconnectSocket = useCallback(() => {
        console.log('🔌 [useSocket] Desconexión manual invocada.');
        if (socket) {
            socket.disconnect();
            socket = null;
            socketRef.current = null;
            setParticipants([]);
            setIsConnected(false);
            console.log('✨ [useSocket] Conexión destruida y estados reiniciados.');
        }
    }, []);

    return { participants, socket: socketRef.current, isConnected, disconnectSocket };
}
