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
    const [isConnected, setIsConnected] = useState(false); // ← CLAVE: estado real de React
    const socketRef = useRef(socket);

    // Sincroniza el módulo socket con la referencia interna
    useEffect(() => {
        socketRef.current = socket;
    }, []);

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
            const backendUrl = import.meta.env.VITE_BACKEND_URL;
            console.log('🌐 [useSocket] Intentando instanciar io() hacia la URL:', backendUrl);

            const newSocket = io(backendUrl, {
                auth: { token },
                transports: ['polling', 'websocket'], // polling primero para Render
                withCredentials: true,
            });

            socketRef.current = newSocket;
            socket = newSocket;

            newSocket.on('connect', () => {
                console.log(`✅ [useSocket] ¡Socket conectado exitosamente! ID único: ${newSocket.id}`);
                setIsConnected(true); // ← dispara re-render en RoomPage
            });
            console.log(
                "🌐 NUEVO SOCKET CREADO:",
                newSocket.id,
                "room:",
                roomId
            );

            newSocket.on('connect_error', (err) => {
                console.error('❌ [useSocket] Error crítico en el canal de comunicación (Handshake):', err.message);
                setIsConnected(false);
            });

            newSocket.on("disconnect", (reason) => {
                console.log("❌ SOCKET DESCONECTADO:", reason);
            });

            newSocket.io.on("reconnect_attempt", () => {
                console.log("🔄 INTENTANDO RECONECTAR");
            });

            newSocket.io.on("reconnect", () => {
                console.log("✅ SOCKET RECONECTADO");
            });
        } else {
            console.log('ℹ️ [useSocket] Reutilizando instancia de socket existente y activa.');

            // El socket ya existe y puede estar conectado, pero el estado
            // 'isConnected' es propio de ESTA instancia del componente y
            // arranca en false. Si no lo sincronizamos aquí, el evento
            // 'connect' jamás volverá a disparar (el socket ya está
            // conectado) y el efecto de unión a la sala se queda
            // bloqueado para siempre.
            if (socketRef.current.connected) {
                console.log('✅ [useSocket] Socket reutilizado ya está conectado. Sincronizando isConnected...');
                setIsConnected(true);
            } else {
                console.log('⏳ [useSocket] Socket reutilizado aún no está conectado.');
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
        console.log('🚪 [useSocket] Ejecutando efecto de suscripción a la sala...', {
            roomId,
            uid,
            socketExiste: !!currentSocket,
            socketConectado: currentSocket?.connected,
            isConnected,
        });

        if (!uid || !currentSocket || !isConnected) {
            console.warn('⚠️ [useSocket] No se puede unir a la sala: socket no listo aún.');
            return;
        }

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
    }, [roomId, uid, displayName, isConnected]); // ← isConnected como dependencia

    // ── 3. Método manual de desconexión completa ─────────────────────────────────────
    const disconnectSocket = useCallback(() => {
        console.log('🔌 [useSocket] Solicitud manual de desconexión total invocada.');
        if (socket) {
            socket.disconnect();
            socket = null;
            socketRef.current = null;
            setParticipants([]);
            setIsConnected(false);
            console.log('✨ [useSocket] Conexión destruida y estados reiniciados.');
        } else {
            console.log('ℹ️ [useSocket] No hay ninguna conexión activa para destruir.');
        }
    }, []);

    return { participants, socket: socketRef.current, isConnected, disconnectSocket };
}