import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface RemoteStream {
  userId: string;
  stream: MediaStream;
}

const ICE_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export function useWebRTC(
  roomId: string,
  localStream: MediaStream | null,
  socket: Socket | null,
  currentUserId: string
) {
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);

  // Refs para limpieza final al desmontar
  const roomIdRef = useRef(roomId);
  const socketRef = useRef(socket);

  useEffect(() => {
    roomIdRef.current = roomId;
    socketRef.current = socket;
  });

  // ── Creación / recuperación de PeerConnection ─────────────────────
  const createPeerConnection = useCallback(
    (remoteUserId: string) => {
      const existing = peerConnections.current.get(remoteUserId);
      if (existing) return existing;

      console.log(`📡 [WebRTC] Creando RTCPeerConnection para: ${remoteUserId}`);
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnections.current.set(remoteUserId, pc);

      // Buscamos e inyectamos las pistas de forma manual y ordenada
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        const videoTrack = localStream.getVideoTracks()[0];

        // Primera m-line: Audio (Si existe, si no, creamos un transceptor vacío)
        if (audioTrack) {
          pc.addTrack(audioTrack, localStream);
        } else {
          pc.addTransceiver('audio', { direction: 'sendrecv' });
        }

        // Segunda m-line: Video (Si existe, si no, creamos un transceptor vacío)
        if (videoTrack) {
          pc.addTrack(videoTrack, localStream);
        } else {
          pc.addTransceiver('video', { direction: 'sendrecv' });
        }
      } else {
        // Si aún no hay stream local, forzamos el orden estándar por defecto
        pc.addTransceiver('audio', { direction: 'sendrecv' });
        pc.addTransceiver('video', { direction: 'sendrecv' });
      }

      // Cuando se recibe un track remoto
      pc.ontrack = (event) => {
        console.log(`🎵 [WebRTC] Track remoto recibido de ${remoteUserId}: ${event.track.kind}`);
        const stream = event.streams[0];
        setRemoteStreams((prev) => {
          if (prev.some((s) => s.userId === remoteUserId)) return prev;
          return [...prev, { userId: remoteUserId, stream }];
        });
      };

      // Enviar candidatos ICE al otro participante
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          console.log(`📶 [WebRTC] Enviando ICE Candidate hacia: ${remoteUserId}`);
          socket.emit('webrtc-ice-candidate', {
            roomId,
            candidate: event.candidate,
            to: remoteUserId,
          });
        }
      };

      return pc;
    },
    [roomId, socket, localStream]
  );

  // ── Iniciar llamada (oferta) ──────────────────────────────────────
  const callUser = useCallback(
    async (remoteUserId: string) => {
      console.log(`📞 [WebRTC] Iniciando oferta de llamada hacia: ${remoteUserId}`);
      const pc = createPeerConnection(remoteUserId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket?.emit('webrtc-offer', { roomId, offer, to: remoteUserId });
      } catch (err) {
        console.error('❌ [WebRTC] Error creando oferta:', err);
      }
    },
    [createPeerConnection, roomId, socket]
  );

  // ── Manejadores de señalización ───────────────────────────────────
  const handleOffer = useCallback(
    async (data: { from: string; offer: RTCSessionDescriptionInit }) => {
      console.log(`📩 [WebRTC] Oferta recibida desde: ${data.from}`);
      const pc = createPeerConnection(data.from);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket?.emit('webrtc-answer', { roomId, answer, to: data.from });
      } catch (err) {
        console.error('❌ [WebRTC] Error respondiendo a la oferta:', err);
      }
    },
    [createPeerConnection, roomId, socket]
  );

  const handleAnswer = useCallback(
    async (data: { from: string; answer: RTCSessionDescriptionInit }) => {
      console.log(`📨 [WebRTC] Respuesta (Answer) recibida desde: ${data.from}`);
      const pc = peerConnections.current.get(data.from);
      if (!pc) {
        console.warn(`⚠️ [WebRTC] No se encontró PeerConnection para procesar Answer de: ${data.from}`);
        return;
      }
      try {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log(`🤝 [WebRTC] Handshake SDP completo con: ${data.from}`);
        } else {
          console.log(`ℹ️ [WebRTC] Ignorando Answer de ${data.from} debido al estado: ${pc.signalingState}`);
        }
      } catch (err) {
        console.error('❌ [WebRTC] Error aplicando respuesta remota:', err);
      }
    },
    []
  );

  const handleIceCandidate = useCallback(
    async (data: { from: string; candidate: RTCIceCandidateInit }) => {
      const pc = peerConnections.current.get(data.from);
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log(`❄️ [WebRTC] Candidato ICE agregado con éxito desde: ${data.from}`);
      } catch (err) {
        console.error('❌ [WebRTC] Error agregando candidato ICE:', err);
      }
    },
    []
  );

  // ── Suscripción a eventos del socket ─────────────────────────────
  useEffect(() => {
    if (!socket) {
      console.warn("⚠️ [useWebRTC] useEffect de suscripción omitido: El socket está en null.");
      return;
    }

    console.log("🔌 [useWebRTC] Configurando listeners de Socket.IO para WebRTC.");

    socket.on('webrtc-offer', handleOffer);
    socket.on('webrtc-answer', handleAnswer);
    socket.on('webrtc-ice-candidate', handleIceCandidate);

    socket.on('user-joined-call', (data: { userId: string }) => {
      console.log(`👤 [Socket] El usuario ${data.userId} se unió a la llamada.`);
      if (data.userId !== currentUserId) {
        createPeerConnection(data.userId);
      }
    });

    socket.on('existing-call-participants', (data: { userIds: string[] }) => {
      console.log("👥 [Socket] Participantes existentes recibidos del backend:", data.userIds);
      data.userIds.forEach((userId) => {
        if (userId !== currentUserId) {
          callUser(userId);
        }
      });
    });

    socket.on('user-left-call', (data: { userId: string }) => {
      console.log(`🚪 [Socket] El usuario ${data.userId} abandonó la llamada.`);
      const pc = peerConnections.current.get(data.userId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(data.userId);
      }
      setRemoteStreams((prev) => prev.filter((s) => s.userId !== data.userId));
    });

    return () => {
      console.log("🗑️ [useWebRTC] Removiendo listeners de Socket.IO.");
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('webrtc-ice-candidate', handleIceCandidate);
      socket.off('user-joined-call');
      socket.off('existing-call-participants');
      socket.off('user-left-call');
    };
  }, [socket, currentUserId, handleOffer, handleAnswer, handleIceCandidate, callUser, createPeerConnection]);

  // ── Sincronización de pistas locales con los peers ────────────────
  // ── Modifica ESTE useEffect en tu useWebRTC.ts ─────────────────────────────
  useEffect(() => {
    // 🔥 CORRECCIÓN: Si el socket no existe, o existe pero aún no se ha conectado físicamente, esperamos.
    if (!socket || !socket.connected) {
      console.log("⏳ [useWebRTC] Esperando que el socket cambie a estado conectado para activar listeners...");

      // Si el socket existe pero está conectando, escuchamos el evento 'connect' para forzar un re-render
      if (socket) {
        const forceUpdate = () => {
          console.log("⚡ [useWebRTC] Socket conectado tardíamente. Reactivando listeners de WebRTC.");
          // Esto disparará el efecto de nuevo al cambiar propiedades internas si se desea, 
          // pero mapear 'socket.connected' en las dependencias suele bastar.
        };
        socket.on('connect', forceUpdate);
        return () => {
          socket.off('connect', forceUpdate);
        };
      }
      return;
    }

    console.log("🔌 [useWebRTC] ¡Socket LISTO y CONECTADO! Configurando listeners de Socket.IO para WebRTC.");

    socket.on('webrtc-offer', handleOffer);
    socket.on('webrtc-answer', handleAnswer);
    socket.on('webrtc-ice-candidate', handleIceCandidate);

    socket.on('user-joined-call', (data: { userId: string }) => {
      console.log(`👤 [Socket] El usuario ${data.userId} se unió a la llamada.`);
      if (data.userId !== currentUserId) {
        createPeerConnection(data.userId);
      }
    });

    socket.on('existing-call-participants', (data: { userIds: string[] }) => {
      console.log("👥 [Socket] Participantes existentes recibidos del backend:", data.userIds);
      data.userIds.forEach((userId) => {
        if (userId !== currentUserId) {
          callUser(userId);
        }
      });
    });

    socket.on('user-left-call', (data: { userId: string }) => {
      console.log(`🚪 [Socket] El usuario ${data.userId} abandonó la llamada.`);
      const pc = peerConnections.current.get(data.userId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(data.userId);
      }
      setRemoteStreams((prev) => prev.filter((s) => s.userId !== data.userId));
    });

    return () => {
      console.log("🗑️ [useWebRTC] Removiendo listeners de Socket.IO.");
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('webrtc-ice-candidate', handleIceCandidate);
      socket.off('user-joined-call');
      socket.off('existing-call-participants');
      socket.off('user-left-call');
    };

    // 🔥 AGREGAMOS socket?.connected AQUÍ ABAJO para que se vuelva a disparar al conectarse
  }, [socket, socket?.connected, currentUserId, handleOffer, handleAnswer, handleIceCandidate, callUser, createPeerConnection]);

  // ── Limpieza total al desmontar el hook ───────────────────────────
  useEffect(() => {
    console.log("🚀 [useWebRTC] Hook montado en la vista.");

    return () => {
      const currentSocket = socketRef.current;
      const currentRoomId = roomIdRef.current;
      const currentConnections = peerConnections.current;

      console.log("🛑 [useWebRTC] Intentando ejecutar desmontaje final...");

      // 🔥 VALIDACIÓN: Si no hay sockets activos ni conexiones, ignoramos el desmonte fantasma de React 18
      if (currentConnections.size === 0 && (!currentSocket || !currentSocket.connected)) {
        console.log("⏭️ [useWebRTC] Desmontaje ignorado (Render doble o hook vacío inicial).");
        return;
      }

      console.log("🧹 [useWebRTC] Limpiando y cerrando todas las conexiones reales...");

      if (currentSocket && currentRoomId) {
        console.log(`📤 Emitiendo 'leave-call' para la sala: ${currentRoomId}`);
        currentSocket.emit('leave-call', { roomId: currentRoomId });
      }

      currentConnections.forEach((pc, id) => {
        console.log(`🔌 Cerrando PeerConnection de: ${id}`);
        pc.close();
      });

      // Limpiar el mapa real y el estado de la UI
      currentConnections.clear();
      setRemoteStreams([]);
      console.log("✨ [useWebRTC] Hook completamente limpio.");
    };
  }, []);

  // ── Acciones públicas ─────────────────────────────────────────────
  const joinCall = useCallback(() => {
    console.log(`📣 [Acción] Solicitando unirse a llamada en sala: ${roomId}`);
    socket?.emit('join-call', { roomId });
  }, [socket, roomId]);

  const leaveCall = useCallback(() => {
    console.log("📣 [Acción] Abandonando llamada manualmente por interacción de UI.");
    socket?.emit('leave-call', { roomId });
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    setRemoteStreams([]);
  }, [socket, roomId]);

  return { remoteStreams, joinCall, leaveCall };
}