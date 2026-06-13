import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface RemoteStream {
  userId: string;
  stream: MediaStream;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

export function useWebRTC(
  roomId: string,
  localStream: MediaStream | null,
  socket: Socket | null,
  currentUserId: string
) {
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);

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

      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        const videoTrack = localStream.getVideoTracks()[0];
        if (audioTrack) {
          pc.addTrack(audioTrack, localStream);
        } else {
          pc.addTransceiver('audio', { direction: 'sendrecv' });
        }
        if (videoTrack) {
          pc.addTrack(videoTrack, localStream);
        } else {
          pc.addTransceiver('video', { direction: 'sendrecv' });
        }
      } else {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
        pc.addTransceiver('video', { direction: 'sendrecv' });
      }

      pc.ontrack = (event) => {
        console.log(`🎵 [WebRTC] Track remoto recibido de ${remoteUserId}: ${event.track.kind}`);
        const stream = event.streams[0];
        setRemoteStreams((prev) => {
          if (prev.some((s) => s.userId === remoteUserId)) return prev;
          return [...prev, { userId: remoteUserId, stream }];
        });
      };

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

      pc.onconnectionstatechange = () => {
        console.log(`🔗 [WebRTC] Estado de conexión con ${remoteUserId}: ${pc.connectionState}`);
        if (pc.connectionState === 'failed') {
          pc.restartIce();
        }
      };

      return pc;
    },
    [roomId, socket, localStream]
  );

  // ── Iniciar llamada (oferta) ──────────────────────────────────────
  const callUser = useCallback(
    async (remoteUserId: string) => {

      console.log("🚀 LLAMANDO A:", remoteUserId);

      console.log(
        `📞 [WebRTC] Iniciando oferta de llamada hacia: ${remoteUserId}`
      );

      const pc = createPeerConnection(remoteUserId);

      try {
        const offer = await pc.createOffer();

        await pc.setLocalDescription(offer);

        socket?.emit('webrtc-offer', {
          roomId,
          offer,
          to: remoteUserId,
        });

      } catch (err) {
        console.error(
          '❌ [WebRTC] Error creando oferta:',
          err
        );
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
        console.warn(`⚠️ [WebRTC] No se encontró PeerConnection para Answer de: ${data.from}`);
        return;
      }
      try {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log(`🤝 [WebRTC] Handshake SDP completo con: ${data.from}`);
        } else {
          console.log(`ℹ️ [WebRTC] Ignorando Answer de ${data.from}, estado: ${pc.signalingState}`);
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
        console.log(`❄️ [WebRTC] Candidato ICE agregado desde: ${data.from}`);
      } catch (err) {
        console.error('❌ [WebRTC] Error agregando candidato ICE:', err);
      }
    },
    []
  );

  // ── Suscripción a eventos del socket (ÚNICO useEffect de listeners) ─
  useEffect(() => {
    if (!socket) return;

    console.log('🔌 [useWebRTC] Registrando listeners de WebRTC.');

    socket.on('webrtc-offer', handleOffer);
    socket.on('webrtc-answer', handleAnswer);
    socket.on('webrtc-ice-candidate', handleIceCandidate);

    socket.on('user-joined-call', (data) => {
      console.log(
        '👤 user-joined-call',
        data.userId,
        'yo:',
        currentUserId
      );

      if (data.userId !== currentUserId) {
        console.log('🚀 LLAMANDO A:', data.userId);

        callUser(data.userId);
      }
    });

    socket.on('existing-call-participants', (data: { userIds: string[] }) => {
      console.log('👥 [Socket] Participantes existentes en llamada:', data.userIds);
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
      console.log('🗑️ [useWebRTC] Removiendo listeners de Socket.IO.');
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('webrtc-ice-candidate', handleIceCandidate);
      socket.off('user-joined-call');
      socket.off('existing-call-participants');
      socket.off('user-left-call');
    };
  }, [socket, currentUserId, handleOffer, handleAnswer, handleIceCandidate, callUser, createPeerConnection]);

  // ── Limpieza total al desmontar ───────────────────────────────────
  useEffect(() => {
    console.log('🚀 [useWebRTC] Hook montado.');

    return () => {
      console.log('🔴 useWebRTC DESMONTADO');

      // NO emitir leave-call aquí.
      // Sólo cerrar conexiones locales.

      peerConnections.current.forEach((pc) => {
        try {
          pc.close();
        } catch (error) {
          console.error('Error cerrando PeerConnection:', error);
        }
      });

      peerConnections.current.clear();
    };
  }, []);

  // ── Acciones públicas ─────────────────────────────────────────────
  const joinCall = useCallback(() => {
    console.log(`📣 [Acción] Solicitando unirse a llamada en sala: ${roomId}`);
    socket?.emit('join-call', { roomId });
  }, [socket, roomId]);

  const leaveCall = useCallback(() => {
    console.log('📣 [Acción] Abandonando llamada.');

    socket?.emit('leave-call', { roomId });

    peerConnections.current.forEach((pc) => {
      try {
        pc.close();
      } catch (error) {
        console.error(error);
      }
    });

    peerConnections.current.clear();
    setRemoteStreams([]);
  }, [socket, roomId]);

  return { remoteStreams, joinCall, leaveCall };
}
