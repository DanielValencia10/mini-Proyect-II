import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';

export interface RemoteStream {
  userId: string;
  stream: MediaStream;
  type: 'camera' | 'screen';
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
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);

  const roomIdRef = useRef(roomId);
  const socketRef = useRef(socket);
  const localStreamRef = useRef(localStream);

  useEffect(() => {
    roomIdRef.current = roomId;
    socketRef.current = socket;
    localStreamRef.current = localStream;
  });

  // ── Re-unirse a la llamada tras reconexión del socket ─────────────
  useEffect(() => {
    if (!socket) return;

    const handleReconnect = () => {
      if (!localStreamRef.current) return;
      console.log('🔄 [useWebRTC] Socket reconectado. Cerrando PCs antiguos y re-uniéndose a la llamada.');
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      pendingCandidates.current.clear();
      setRemoteStreams([]);
      socket.emit('join-call', { roomId: roomIdRef.current });
    };

    socket.io.on('reconnect', handleReconnect);
    return () => {
      socket.io.off('reconnect', handleReconnect);
    };
  }, [socket]);

  // ── Helper: obtener transceivers de video ordenados ────────────────
  const getVideoTransceivers = useCallback((pc: RTCPeerConnection) => {
    return pc.getTransceivers().filter(t =>
      t.receiver.track?.kind === 'video'
    );
  }, []);

  // ── Creación / recuperación de PeerConnection ─────────────────────
  const createPeerConnection = useCallback(
    (remoteUserId: string) => {
      const existing = peerConnections.current.get(remoteUserId);
      if (existing) {
        if (existing.connectionState !== 'failed' && existing.connectionState !== 'closed') {
          return existing;
        }
        existing.close();
        peerConnections.current.delete(remoteUserId);
        pendingCandidates.current.delete(remoteUserId);
        setRemoteStreams((prev) => prev.filter((s) => s.userId !== remoteUserId));
      }

      console.log(`📡 [WebRTC] Creando RTCPeerConnection para: ${remoteUserId}`);
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnections.current.set(remoteUserId, pc);

      // ── Transceiver 1: Audio ──────────────────────────────────────
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
          pc.addTrack(audioTrack, localStream);
        } else {
          pc.addTransceiver('audio', { direction: 'sendrecv' });
        }
      } else {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
      }

      // ── Transceiver 2: Video CÁMARA ───────────────────────────────
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          pc.addTrack(videoTrack, localStream);
        } else {
          pc.addTransceiver('video', { direction: 'sendrecv' });
        }
      } else {
        pc.addTransceiver('video', { direction: 'sendrecv' });
      }

      // ── Transceiver 3: Video SCREEN SHARE (vacío inicialmente) ────
      pc.addTransceiver('video', { direction: 'sendrecv' });
      console.log(`🖥️ [WebRTC] Transceiver de screen share pre-creado para: ${remoteUserId}`);

      // ── ontrack: categorizar por índice de transceiver de video ────
      pc.ontrack = (event) => {
        const track = event.track;
        const transceiver = event.transceiver;

        console.log(`🎵 [WebRTC] Track remoto recibido de ${remoteUserId}: kind=${track.kind}, readyState=${track.readyState}, enabled=${track.enabled}`);

        // Solo procesar tracks de video
        if (track.kind !== 'video') return;

        // Determinar tipo por índice: 1er video = cámara, 2do video = screen
        const videoTransceivers = getVideoTransceivers(pc);
        const videoIndex = videoTransceivers.indexOf(transceiver);
        const type: 'camera' | 'screen' = videoIndex <= 0 ? 'camera' : 'screen';

        console.log(`🎬 [WebRTC] Track de video #${videoIndex} de ${remoteUserId} → tipo: ${type}`);

        // Obtener o crear stream
        let stream = event.streams[0];
        if (!stream) {
          stream = new MediaStream([track]);
          console.log(`📦 [WebRTC] Stream creado manualmente para ${type} de ${remoteUserId}`);
        }

        setRemoteStreams((prev) => {
          const existing = prev.find((s) => s.userId === remoteUserId && s.type === type);
          if (existing) {
            if (existing.stream !== stream) {
              console.log(`🔄 [WebRTC] Actualizando stream ${type} de ${remoteUserId}`);
              return prev.map((s) =>
                (s.userId === remoteUserId && s.type === type) ? { ...s, stream } : s
              );
            }
            return prev;
          }
          return [...prev, { userId: remoteUserId, stream, type }];
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
    [roomId, socket, localStream, getVideoTransceivers]
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
  // ── Aplica candidatos ICE en cola tras recibir remote description ───
  const flushPendingCandidates = useCallback(async (userId: string, pc: RTCPeerConnection) => {
    const queued = pendingCandidates.current.get(userId);
    if (!queued?.length) return;
    pendingCandidates.current.delete(userId);
    for (const c of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
        console.log(`❄️ [WebRTC] ICE candidato en cola aplicado desde: ${userId}`);
      } catch (err) {
        console.error('❌ [WebRTC] Error aplicando ICE candidato en cola:', err);
      }
    }
  }, []);

  const handleOffer = useCallback(
    async (data: { from: string; offer: RTCSessionDescriptionInit }) => {
      console.log(`📩 [WebRTC] Oferta recibida desde: ${data.from}`);
      const pc = createPeerConnection(data.from);

      try {
        // Si ya tenemos una oferta local, el de menor ID cede
        if (pc.signalingState === 'have-local-offer') {
          const shouldYield = currentUserId < data.from;
          if (!shouldYield) {
            console.log(`⚠️ Colisión de ofertas, ignorando oferta de ${data.from}`);
            return;
          }
          // Rollback y aceptar la oferta del otro
          await pc.setLocalDescription({ type: 'rollback' });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        await flushPendingCandidates(data.from, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket?.emit('webrtc-answer', { roomId, answer, to: data.from });
      } catch (err) {
        console.error('❌ [WebRTC] Error respondiendo a la oferta:', err);
      }
    },
    [createPeerConnection, currentUserId, flushPendingCandidates, roomId, socket]
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
          await flushPendingCandidates(data.from, pc);
          console.log(`🤝 [WebRTC] Handshake SDP completo con: ${data.from}`);
        } else {
          console.log(`ℹ️ [WebRTC] Ignorando Answer de ${data.from}, estado: ${pc.signalingState}`);
        }
      } catch (err) {
        console.error('❌ [WebRTC] Error aplicando respuesta remota:', err);
      }
    },
    [flushPendingCandidates]
  );

  const handleIceCandidate = useCallback(
    async (data: { from: string; candidate: RTCIceCandidateInit }) => {
      const pc = peerConnections.current.get(data.from);
      if (!pc || !pc.remoteDescription) {
        // Encolar: el PC aún no tiene remote description
        const q = pendingCandidates.current.get(data.from) ?? [];
        q.push(data.candidate);
        pendingCandidates.current.set(data.from, q);
        console.log(`⏳ [WebRTC] ICE candidato encolado desde ${data.from} (sin remote description aún)`);
        return;
      }
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
      pendingCandidates.current.delete(data.userId);
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
    const pcs = peerConnections.current;

    return () => {
      console.log('🔴 useWebRTC DESMONTADO');

      pcs.forEach((pc) => {
        try {
          pc.close();
        } catch (error) {
          console.error('Error cerrando PeerConnection:', error);
        }
      });

      pcs.clear();
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

  // ── Reemplazar track de CÁMARA en todos los peers ─────────────────
  const replaceVideoTrack = useCallback(async (newTrack: MediaStreamTrack | null) => {
    const promises: Promise<void>[] = [];

    peerConnections.current.forEach((pc, peerId) => {
      const videoTransceivers = getVideoTransceivers(pc);
      // El transceiver de cámara es el primero (índice 0)
      const cameraTransceiver = videoTransceivers[0];

      if (cameraTransceiver) {
        const p = cameraTransceiver.sender.replaceTrack(newTrack)
          .then(() => {
            console.log(`🔄 [WebRTC] Track de CÁMARA reemplazado para peer: ${peerId}`);
          })
          .catch(err => {
            console.error(`❌ [WebRTC] Error reemplazando track de cámara para peer ${peerId}:`, err);
          });
        promises.push(p);
      } else {
        console.warn(`⚠️ [WebRTC] No se encontró transceiver de cámara para peer: ${peerId}`);
      }
    });

    await Promise.all(promises);

    // Renegociar para adaptar el codificador a los posibles cambios del track
    peerConnections.current.forEach((_, peerId) => callUser(peerId));
  }, [getVideoTransceivers, callUser]);

  // ── Iniciar SCREEN SHARE en todos los peers ───────────────────────
  const startScreenShare = useCallback(async (screenTrack: MediaStreamTrack) => {
    const promises: Promise<void>[] = [];

    peerConnections.current.forEach((pc, peerId) => {
      const videoTransceivers = getVideoTransceivers(pc);
      // El transceiver de screen share es el segundo (índice 1)
      const screenTransceiver = videoTransceivers[1];

      if (screenTransceiver) {
        const p = screenTransceiver.sender.replaceTrack(screenTrack)
          .then(() => {
            console.log(`🖥️ [WebRTC] Screen share track enviado a peer: ${peerId}`);
          })
          .catch(err => {
            console.error(`❌ [WebRTC] Error enviando screen share a peer ${peerId}:`, err);
          });
        promises.push(p);
      } else {
        console.warn(`⚠️ [WebRTC] No se encontró transceiver de screen para peer: ${peerId}. Transceivers de video: ${videoTransceivers.length}`);
      }
    });

    await Promise.all(promises);

    // Renegociar para adaptar el codificador a la pantalla compartida (crucial para pestañas de Chrome)
    peerConnections.current.forEach((_, peerId) => callUser(peerId));
  }, [getVideoTransceivers, callUser]);

  // ── Detener SCREEN SHARE en todos los peers ───────────────────────
  const stopScreenShare = useCallback(async () => {
    const promises: Promise<void>[] = [];

    peerConnections.current.forEach((pc, peerId) => {
      const videoTransceivers = getVideoTransceivers(pc);
      const screenTransceiver = videoTransceivers[1];

      if (screenTransceiver) {
        const p = screenTransceiver.sender.replaceTrack(null)
          .then(() => {
            console.log(`🖥️ [WebRTC] Screen share detenido para peer: ${peerId}`);
          })
          .catch(err => {
            console.error(`❌ [WebRTC] Error deteniendo screen share para peer ${peerId}:`, err);
          });
        promises.push(p);
      }
    });

    await Promise.all(promises);

    // Renegociar para actualizar el SDP
    peerConnections.current.forEach((_, peerId) => callUser(peerId));
  }, [getVideoTransceivers, callUser]);

  return { remoteStreams, joinCall, leaveCall, replaceVideoTrack, startScreenShare, stopScreenShare };
}
