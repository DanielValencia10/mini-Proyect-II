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

    // Sincroniza el módulo socket con la referencia interna
    useEffect(() => {
        socketRef.current = socket;
    }, []);

    // ── 1. Creación/recreación del socket cuando cambia el token ──────────────────
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
            }
        }

        if (!socketRef.current) {
            const backendUrl = import.meta.env.VITE_BACKEND_URL;
            console.log('🌐 [useSocket] Intentando instanciar io() hacia la URL:', backendUrl);

            const newSocket = io(backendUrl, {
                auth: { token },
                transports: ['websocket'],
                upgrade: false,
                withCredentials: true
            });

            // Asignamos tanto a la referencia del hook como a la variable global del módulo
            socketRef.current = newSocket;
            socket = newSocket;

            newSocket.on('connect', () => {
                console.log(`✅ [useSocket] ¡Socket conectado exitosamente! ID único: ${newSocket.id}`);
            });

            newSocket.on('connect_error', (err) => {
                console.error('❌ [useSocket] Error crítico en el canal de comunicación (Handshake):', err.message);
                console.error('📋 Detalles del error:', err);
            });

            newSocket.on('disconnect', (reason) => {
                console.warn('🔌 [useSocket] El socket se ha desconectado. Razón:', reason);
            });
        } else {
            console.log('ℹ️ [useSocket] Reutilizando instancia de socket existente y activa.');
        }

    }, [token, uid]);

    // ── 2. Manejo de la sala y escucha de participantes ─────────────────────────────
    useEffect(() => {
        const currentSocket = socketRef.current;
        console.log('🚪 [useSocket] Ejecutando efecto de suscripción a la sala...', {
            roomId,
            uid,
            socketExiste: !!currentSocket,
            socketConectado: currentSocket?.connected
        });

        if (!uid || !currentSocket) {
            console.warn('⚠️ [useSocket] No se puede unir a la sala: Faltan credenciales del usuario o la instancia de conexión.');
            return;
        }

        // Emitimos la entrada
        console.log(`📤 [useSocket] Emitiendo 'join-room' a la sala [${roomId}] para el usuario: ${displayName}`);
        currentSocket.emit('join-room', {
            roomId,
            userId: uid,
            userName: displayName,
        });

        const handleParticipants = (data: Participant[]) => {
            console.log('👥 [useSocket] Lista de participantes actualizada desde el backend:', data);
            setParticipants(data);
        };

        currentSocket.on('room-participants', handleParticipants);

        // Limpieza de eventos al desmontar la vista de la sala
        return () => {
            console.log(`🛑 [useSocket] Desmontando hook de sala [${roomId}]. Limpiando listeners...`);
            if (currentSocket.connected) {
                console.log(`📤 [useSocket] Emitiendo 'leave-room' para la sala: ${roomId}`);
                currentSocket.emit('leave-room', { roomId, userId: uid });
            } else {
                console.warn('ℹ️ [useSocket] Saltando emision de leave-room: El socket ya estaba desconectado.');
            }
            currentSocket.off('room-participants', handleParticipants);
        };
    }, [roomId, uid, displayName, token]); // Añadimos token para re-suscripción si cambia el socket

    // ── 3. Método manual de desconexión completa ────────────────────────────────────
    const disconnectSocket = useCallback(() => {
        console.log('🔌 [useSocket] Solicitud manual de desconexión total invocada.');
        if (socket) {
            socket.disconnect();
            socket = null;
            socketRef.current = null;
            setParticipants([]);
            console.log('✨ [useSocket] Conexión destruida y estados reiniciados.');
        } else {
            console.log('ℹ️ [useSocket] No hay ninguna conexión activa para destruir.');
        }
    }, []);

    return { participants, socket: socketRef.current, disconnectSocket };
}