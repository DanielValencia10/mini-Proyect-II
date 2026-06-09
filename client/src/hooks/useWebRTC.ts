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

      console.log(`Creando RTCPeerConnection para: ${remoteUserId}`);
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnections.current.set(remoteUserId, pc);

      //  Buscamos e inyectamos las pistas de forma manual y ordenada
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
          console.log(`📡 [WebRTC] Enviando ICE Candidate hacia: ${remoteUserId}`);
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
      const pc = createPeerConnection(remoteUserId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket?.emit('webrtc-offer', { roomId, offer, to: remoteUserId });
      } catch (err) {
        console.error('Error creando oferta:', err);
      }
    },
    [createPeerConnection, roomId, socket]
  );

  // ── Manejadores de señalización ───────────────────────────────────
  const handleOffer = useCallback(
    async (data: { from: string; offer: RTCSessionDescriptionInit }) => {
      const pc = createPeerConnection(data.from);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket?.emit('webrtc-answer', { roomId, answer, to: data.from });
      } catch (err) {
        console.error('Error respondiendo a la oferta:', err);
      }
    },
    [createPeerConnection, roomId, socket]
  );

  const handleAnswer = useCallback(
    async (data: { from: string; answer: RTCSessionDescriptionInit }) => {
      const pc = peerConnections.current.get(data.from);
      if (!pc) return;
      try {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log(`Handshake completo con: ${data.from}`);
        }
      } catch (err) {
        console.error('Error aplicando respuesta remota:', err);
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
      } catch (err) {
        console.error('Error agregando candidato ICE:', err);
      }
    },
    []
  );

  // ── Suscripción a eventos del socket ─────────────────────────────
  useEffect(() => {
    if (!socket) return;

    socket.on('webrtc-offer', handleOffer);
    socket.on('webrtc-answer', handleAnswer);
    socket.on('webrtc-ice-candidate', handleIceCandidate);

    socket.on('user-joined-call', (data: { userId: string }) => {
      if (data.userId !== currentUserId) {
        // El nuevo iniciará la oferta, solo preparamos el peer
        createPeerConnection(data.userId);
      }
    });

    socket.on('existing-call-participants', (data: { userIds: string[] }) => {
      data.userIds.forEach((userId) => {
        if (userId !== currentUserId) {
          callUser(userId); // El nuevo crea la oferta hacia cada existente
        }
      });
    });

    socket.on('user-left-call', (data: { userId: string }) => {
      const pc = peerConnections.current.get(data.userId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(data.userId);
      }
      setRemoteStreams((prev) => prev.filter((s) => s.userId !== data.userId));
    });

    return () => {
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('webrtc-ice-candidate', handleIceCandidate);
      socket.off('user-joined-call');
      socket.off('existing-call-participants');
      socket.off('user-left-call');
    };
  }, [socket, currentUserId, handleOffer, handleAnswer, handleIceCandidate, callUser, createPeerConnection]);

  // ── Sincronización de pistas locales con los peers ────────────────
  useEffect(() => {
    if (!localStream) return;

    const audioTrack = localStream.getAudioTracks()[0];
    const videoTrack = localStream.getVideoTracks()[0];

    peerConnections.current.forEach((pc) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track?.kind === 'audio' && audioTrack) {
          sender.replaceTrack(audioTrack).catch((err) =>
            console.error('Error reemplazando track de audio:', err)
          );
        }
        if (sender.track?.kind === 'video' && videoTrack) {
          sender.replaceTrack(videoTrack).catch((err) =>
            console.error('Error reemplazando track de video:', err)
          );
        }
      });
    });
  }, [localStream]);

  // ── Limpieza total al desmontar el hook ───────────────────────────
  useEffect(() => {
    const currentSocket = socketRef.current;
    const currentRoomId = roomIdRef.current;
    const currentConnections = peerConnections.current;

    return () => {
      console.log("Limpiando y cerrando todas las conexiones...");

      // Notificar la salida usando la copia local del socket
      if (currentSocket && currentRoomId) {
        currentSocket.emit('leave-call', { roomId: currentRoomId });
      }

      // Cerrar cada RTCPeerConnection usando la copia local del mapa
      currentConnections.forEach((pc) => {
        pc.close();
      });

      // Limpiar el mapa real y el estado de la UI
      currentConnections.clear();
      setRemoteStreams([]);
    };
  }, []);

  // ── Acciones públicas ─────────────────────────────────────────────
  const joinCall = useCallback(() => {
    socket?.emit('join-call', { roomId });
  }, [socket, roomId]);

  const leaveCall = useCallback(() => {
    socket?.emit('leave-call', { roomId });
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    setRemoteStreams([]);
  }, [socket, roomId]);

  return { remoteStreams, joinCall, leaveCall };
}