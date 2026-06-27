import { useEffect, useRef, useState, useCallback } from "react";
import { Socket } from "socket.io-client";

interface RemoteStream {
  userId: string;
  stream: MediaStream;
}

const ICE_SERVERS: RTCConfiguration = {
  iceCandidatePoolSize: 2,
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

export function useWebRTC(
  roomId: string,
  localStream: MediaStream | null,
  socket: Socket | null,
  currentUserId: string,
) {
  // Al inicio de tu hook useWebRTC
  const makingOffer = useRef<Map<string, boolean>>(new Map());
  const ignoreOffer = useRef<Map<string, boolean>>(new Map());
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map(),
  );
  const audioSenders = useRef<Map<string, RTCRtpSender>>(new Map());
  const videoSenders = useRef<Map<string, RTCRtpSender>>(new Map());
  const screenTransceivers = useRef<Map<string, RTCRtpTransceiver>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);

  // ── Screen share: estado y referencias ────────────────────────────
  // Stream de pantalla remota por usuario (independiente del stream de cámara).
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<
    Map<string, MediaStream>
  >(new Map());
  // Recuerda el streamId de la cámara de cada peer, para poder distinguir en
  // 'ontrack' si un stream nuevo es la cámara (ya conocida) o es la pantalla.
  const cameraStreamId = useRef<Map<string, string>>(new Map());
  // Stream local de pantalla que ESTE usuario está compartiendo (si aplica).
  const localScreenStreamRef = useRef<MediaStream | null>(null);
  // Set de userIds que el servidor nos dice que están compartiendo pantalla.
  // Se usa para decidir si activar el screen stream en ontrack.
  const activeSharerIds = useRef<Set<string>>(new Set());

  const roomIdRef = useRef(roomId);
  const socketRef = useRef(socket);
  const localStreamRef = useRef(localStream);

  useEffect(() => {
    roomIdRef.current = roomId;
    socketRef.current = socket;
    localStreamRef.current = localStream;
  }, [roomId, socket, localStream]);

  // ── Actualizar tracks en PCs existentes cuando localStream cambia ──
  useEffect(() => {
    const videoTrack = localStream?.getVideoTracks()[0] || null;
    const audioTrack = localStream?.getAudioTracks()[0] || null;

    videoSenders.current.forEach((sender) => {
      if (sender.track !== videoTrack) {
        sender.replaceTrack(videoTrack).catch((err) =>
          console.error("Error replacing video track", err)
        );
      }
    });

    audioSenders.current.forEach((sender) => {
      if (sender.track !== audioTrack) {
        sender.replaceTrack(audioTrack).catch((err) =>
          console.error("Error replacing audio track", err)
        );
      }
    });
  }, [localStream]);

  // ── Re-unirse a la llamada tras reconexión del socket ─────────────
  useEffect(() => {
    if (!socket) return;

    const handleReconnect = () => {
      if (!localStreamRef.current) return;
      console.log(
        "🔄 [useWebRTC] Socket reconectado. Cerrando PCs antiguos y re-uniéndose a la llamada.",
      );
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      pendingCandidates.current.clear();
      cameraStreamId.current.clear();
      screenTransceivers.current.clear();
      setRemoteStreams([]);
      setRemoteScreenStreams(new Map());
      socket.emit("join-call", { roomId: roomIdRef.current });
    };

    socket.io.on("reconnect", handleReconnect);
    return () => {
      socket.io.off("reconnect", handleReconnect);
    };
  }, [socket]);

  // ── Creación / recuperación de PeerConnection ─────────────────────
  const createPeerConnection = useCallback(
    (remoteUserId: string) => {
      const existing = peerConnections.current.get(remoteUserId);
      if (existing) {
        if (
          existing.connectionState !== "failed" &&
          existing.connectionState !== "closed"
        ) {
          return existing;
        }
        existing.close();
        peerConnections.current.delete(remoteUserId);
        pendingCandidates.current.delete(remoteUserId);
        cameraStreamId.current.delete(remoteUserId);
        audioSenders.current.delete(remoteUserId);
        videoSenders.current.delete(remoteUserId);
        screenTransceivers.current.delete(remoteUserId);
        setRemoteStreams((prev) =>
          prev.filter((s) => s.userId !== remoteUserId),
        );
        setRemoteScreenStreams((prev) => {
          const next = new Map(prev);
          next.delete(remoteUserId);
          return next;
        });
      }

      console.log(
        `📡 [WebRTC] Creando RTCPeerConnection para: ${remoteUserId}`,
      );
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnections.current.set(remoteUserId, pc);

      // Queremos agrupar audio y video en un mismo MediaStream lógico
      const currentLocalStream = localStreamRef.current;
      const streamToGroup = currentLocalStream || new MediaStream();

      let audioSender: RTCRtpSender | undefined;
      let videoSender: RTCRtpSender | undefined;

      if (currentLocalStream && currentLocalStream.getAudioTracks().length > 0) {
        audioSender = pc.addTrack(currentLocalStream.getAudioTracks()[0], streamToGroup);
      } else {
        audioSender = pc.addTransceiver("audio", { direction: "sendrecv", streams: [streamToGroup] }).sender;
      }

      if (currentLocalStream && currentLocalStream.getVideoTracks().length > 0) {
        videoSender = pc.addTrack(currentLocalStream.getVideoTracks()[0], streamToGroup);
      } else {
        videoSender = pc.addTransceiver("video", { direction: "sendrecv", streams: [streamToGroup] }).sender;
      }

      if (audioSender) audioSenders.current.set(remoteUserId, audioSender);
      if (videoSender) videoSenders.current.set(remoteUserId, videoSender);

      // Pre-crear transceiver de pantalla (siempre, inactive por defecto).
      // Esto garantiza que todos los PCs tienen SIEMPRE 3 m-lines en el mismo
      // orden [audio, video-cámara, video-pantalla], eliminando el error de
      // "m-lines order mismatch" que ocurría al agregar un transceiver nuevo
      // después de la negociación inicial.
      const screenTcvr = pc.addTransceiver("video", { direction: "recvonly" });
      screenTransceivers.current.set(remoteUserId, screenTcvr);

      if (localScreenStreamRef.current) {
        const screenTrack = localScreenStreamRef.current.getVideoTracks()[0];
        if (screenTrack) {
          screenTcvr.sender.replaceTrack(screenTrack);
          screenTcvr.direction = "sendrecv";
        }
      }

      pc.ontrack = (event) => {
        // Identificar pantalla compartida por REFERENCIA al transceiver que
        // pre-creamos en createPeerConnection, NO por índice numérico.
        const stream = event.streams[0];
        const storedScreenTcvr = screenTransceivers.current.get(remoteUserId);
        const knownCameraStreamId = cameraStreamId.current.get(remoteUserId);
        const matchesScreenTransceiver =
          storedScreenTcvr != null && event.transceiver === storedScreenTcvr;
        const isScreen =
          event.track.kind === "video" &&
          (matchesScreenTransceiver ||
            (activeSharerIds.current.has(remoteUserId) &&
              knownCameraStreamId != null &&
              stream?.id !== knownCameraStreamId));

        console.log(`🔍 [ontrack] remoteUserId: ${remoteUserId}, kind: ${event.track.kind}, isScreen: ${isScreen}, matchesStoredTcvr: ${matchesScreenTransceiver}, streamId: ${stream?.id ?? "sin-stream"}, cameraStreamId: ${knownCameraStreamId ?? "sin-camara"}`);

        if (isScreen) {
          // Solo activar el stream de pantalla si el track tiene datos
          // activos (muted=false y readyState=live) o si sabemos que el
          // usuario remoto realmente está compartiendo.
          console.log(`🖥️ [WebRTC] Track de pantalla recibida en ontrack de ${remoteUserId} (muted: ${event.track.muted}, readyState: ${event.track.readyState})`);
          const track = event.track;
          const screenStream = stream ?? new MediaStream([track]);

          // Solo mostrar la pantalla si el track está activo (no muted)
          // O si el servidor nos dice que este usuario está compartiendo
          const shouldActivate =
            track.readyState === "live" &&
            !track.muted &&
            activeSharerIds.current.has(remoteUserId);
          if (shouldActivate) {
            setRemoteScreenStreams((prev) => {
              const next = new Map(prev);
              next.set(remoteUserId, screenStream);
              return next;
            });
          }

          track.onunmute = () => {
            console.log(`🖥️ [WebRTC] Track de pantalla UNMUTED de ${remoteUserId}`);
            const activeStream = new MediaStream([track]);
            setRemoteScreenStreams((prev) => {
              const next = new Map(prev);
              next.set(remoteUserId, activeStream);
              return next;
            });
          };

          track.onmute = () => {
            console.log(`🖥️ [WebRTC] Track de pantalla MUTED de ${remoteUserId}`);
            setRemoteScreenStreams((prev) => {
              if (!prev.has(remoteUserId)) return prev;
              const next = new Map(prev);
              next.delete(remoteUserId);
              return next;
            });
          };

          track.onended = () => {
            console.log(`🖥️ [WebRTC] Pantalla compartida finalizada (onended) de ${remoteUserId}`);
            setRemoteScreenStreams((prev) => {
              if (!prev.has(remoteUserId)) return prev;
              const next = new Map(prev);
              next.delete(remoteUserId);
              return next;
            });
          };

          return;
        }

        console.log(`🎵 [WebRTC] Track recibido: ${event.track.kind} de ${remoteUserId}`);
        if (!stream) return;

        setRemoteStreams((currentRemoteStreams) => {
          if (!knownCameraStreamId) {
            cameraStreamId.current.set(remoteUserId, stream.id);
            if (currentRemoteStreams.some((s) => s.userId === remoteUserId))
              return currentRemoteStreams;
            return [...currentRemoteStreams, { userId: remoteUserId, stream }];
          }
          return currentRemoteStreams;
        });
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          console.log(
            `📶 [WebRTC] Enviando ICE Candidate hacia: ${remoteUserId}`,
          );
          socket.emit("webrtc-ice-candidate", {
            roomId,
            candidate: event.candidate,
            to: remoteUserId,
          });
        }
      };

      pc.onnegotiationneeded = async () => {
        try {
          if (pc.signalingState === "closed") return;
          if (makingOffer.current.get(remoteUserId)) return;
          makingOffer.current.set(remoteUserId, true);
          await pc.setLocalDescription(); // 👈 sin argumentos: crea Y aplica la oferta de forma atómica

          socketRef.current?.emit("webrtc-offer", {
            roomId: roomIdRef.current,
            offer: pc.localDescription,
            to: remoteUserId,
          });
          console.log(
            `🔁 [WebRTC] onnegotiationneeded → oferta enviada a ${remoteUserId}`,
          );
        } catch (err) {
          console.error(
            `❌ [WebRTC] Error en onnegotiationneeded con ${remoteUserId}:`,
            err,
          );
        } finally {
          makingOffer.current.set(remoteUserId, false);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(
          `🔗 [WebRTC] Estado de conexión con ${remoteUserId}: ${pc.connectionState}`,
        );
        if (pc.connectionState === "failed") {
          pc.restartIce();
        }
      };

      return pc;
    },
    [roomId, socket], // Mantener estas dependencias estables
  );

  // ── Iniciar llamada (oferta) ──────────────────────────────────────
  const callUser = useCallback(
    (remoteUserId: string) => {
      console.log("🚀 LLAMANDO A:", remoteUserId);
      console.log(
        `📞 [WebRTC] Inicializando conexión para: ${remoteUserId}`,
      );

      // Solo creamos la PC. Los transceivers añadidos dispararán onnegotiationneeded
      createPeerConnection(remoteUserId);
    },
    [createPeerConnection],
  );

  // ── Manejadores de señalización ───────────────────────────────────
  // ── Aplica candidatos ICE en cola tras recibir remote description ───
  const flushPendingCandidates = useCallback(
    async (userId: string, pc: RTCPeerConnection) => {
      const queued = pendingCandidates.current.get(userId);
      if (!queued?.length) return;
      pendingCandidates.current.delete(userId);
      for (const c of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c));
          console.log(
            `❄️ [WebRTC] ICE candidato en cola aplicado desde: ${userId}`,
          );
        } catch (err) {
          console.error(
            "❌ [WebRTC] Error aplicando ICE candidato en cola:",
            err,
          );
        }
      }
    },
    [],
  );

  const handleOffer = useCallback(
    async (data: { from: string; offer: RTCSessionDescriptionInit }) => {
      const remoteUserId = data.from;
      const pc =
        peerConnections.current.get(remoteUserId) ??
        createPeerConnection(remoteUserId);
      if (!pc) return;

      const isPolite = currentUserId < remoteUserId;
      const offerCollision =
        data.offer.type === "offer" &&
        (makingOffer.current.get(remoteUserId) ||
          pc.signalingState !== "stable");

      const shouldIgnore = !isPolite && offerCollision;
      ignoreOffer.current.set(remoteUserId, shouldIgnore);

      if (shouldIgnore) {
        console.log(
          `[WebRTC] Colisión. Ignorando oferta de ${remoteUserId} (Impolite)`,
        );
        return;
      }

      try {
        // setRemoteDescription hace rollback automático si hace falta (lado "polite" en colisión).
        await pc.setRemoteDescription(data.offer);
        await flushPendingCandidates(remoteUserId, pc);

        if (data.offer.type === "offer") {
          await pc.setLocalDescription(); // 👈 igual de atómico para generar el Answer
          socket?.emit("webrtc-answer", {
            roomId,
            answer: pc.localDescription,
            to: remoteUserId,
          });
          console.log(`📡 [WebRTC] Answer enviado a ${remoteUserId}`);
        }
      } catch (err) {
        console.error(
          `❌ [WebRTC] Error procesando oferta de ${remoteUserId}:`,
          err,
        );
      }
    },
    [currentUserId, roomId, socket, flushPendingCandidates, createPeerConnection],
  );

  const handleAnswer = useCallback(
    async (data: { from: string; answer: RTCSessionDescriptionInit }) => {
      console.log(
        `📨 [WebRTC] Respuesta (Answer) recibida desde: ${data.from}`,
      );
      const pc = peerConnections.current.get(data.from);
      if (!pc) {
        console.warn(
          `⚠️ [WebRTC] No se encontró PeerConnection para Answer de: ${data.from}`,
        );
        return;
      }
      try {
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          await flushPendingCandidates(data.from, pc);
          console.log(`🤝 [WebRTC] Handshake SDP completo con: ${data.from}`);
        } else {
          console.log(
            `ℹ️ [WebRTC] Ignorando Answer de ${data.from}, estado: ${pc.signalingState}`,
          );
        }
      } catch (err) {
        console.error("❌ [WebRTC] Error aplicando respuesta remota:", err);
      }
    },
    [flushPendingCandidates],
  );

  const handleIceCandidate = useCallback(
    async (data: { from: string; candidate: RTCIceCandidateInit }) => {
      const remoteUserId = data.from;
      const pc = peerConnections.current.get(remoteUserId);

      try {
        // 1. REGLA DE NEGOCIACIÓN PERFECTA:
        // Si decidimos ignorar la oferta asociada a este candidato, descartamos el candidato de forma segura.
        if (ignoreOffer.current.get(remoteUserId)) {
          // Si el candidato es null o el pc volvió a estar estable, podemos restaurar la bandera
          if (!data.candidate || pc?.signalingState === "stable") {
            ignoreOffer.current.set(remoteUserId, false);
          }
          return;
        }

        // 2. Tu lógica original de encolamiento si no hay remoteDescription aún
        if (!pc || !pc.remoteDescription) {
          const q = pendingCandidates.current.get(remoteUserId) ?? [];
          q.push(data.candidate);
          pendingCandidates.current.set(remoteUserId, q);
          console.log(
            `⏳ [WebRTC] ICE candidato encolado desde ${remoteUserId} (sin remote description aún)`,
          );
          return;
        }

        // 3. Añadir el candidato normalmente si todo está en orden
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log(
          `❄️ [WebRTC] Candidato ICE agregado desde: ${remoteUserId}`,
        );
      } catch (err) {
        console.error("❌ [WebRTC] Error agregando candidato ICE:", err);
      }
    },
    [],
  );

  // ── Screen share: limpieza al recibir 'screen-share-stopped' del backend ──
  // Respaldo del listener 'removetrack' de arriba: si por lo que sea el evento
  // de track no llega o se procesa distinto en algún navegador, esto asegura
  // que el estado se limpie igual en cuanto el backend confirma el stop.
  const handleScreenShareStarted = useCallback((data: { userId: string }) => {
    console.log(`🖥️ [Socket] El usuario ${data.userId} comenzó a compartir pantalla.`);
    activeSharerIds.current.add(data.userId);
    const pc = peerConnections.current.get(data.userId);
    if (!pc) return;
    
    // Usar la referencia exacta del transceiver de pantalla que pre-creamos
    const screenTcvr = screenTransceivers.current.get(data.userId);
    const track = screenTcvr?.receiver?.track;
    if (track && track.readyState === 'live' && !track.muted) {
      console.log(`🖥️ [Socket] Track de pantalla encontrado para ${data.userId}, activando stream. muted: ${track.muted}`);
      const screenStream = new MediaStream([track]);
      setRemoteScreenStreams((prev) => {
        const next = new Map(prev);
        next.set(data.userId, screenStream);
        return next;
      });
    } else {
      console.log(`🖥️ [Socket] No se encontró track de pantalla activo para ${data.userId}. Se activará cuando llegue el track por ontrack.`);
    }
  }, []);

  const handleScreenShareStopped = useCallback((data: { userId: string }) => {
    activeSharerIds.current.delete(data.userId);
    setRemoteScreenStreams((prev) => {
      if (!prev.has(data.userId)) return prev;
      const next = new Map(prev);
      next.delete(data.userId);
      return next;
    });
  }, []);

  // ── Suscripción a eventos del socket (ÚNICO useEffect de listeners) ─
  useEffect(() => {
    if (!socket) return;
    const pcs = peerConnections.current;
    console.log("🔌 [useWebRTC] Registrando listeners de WebRTC.");

    socket.on("webrtc-offer", handleOffer);
    socket.on("webrtc-answer", handleAnswer);
    socket.on("webrtc-ice-candidate", handleIceCandidate);
    socket.on("screen-share-started", handleScreenShareStarted);
    socket.on("screen-share-stopped", handleScreenShareStopped);

    socket.on("user-joined-call", (data) => {
      console.log("👤 user-joined-call", data.userId, "yo:", currentUserId);

      if (data.userId !== currentUserId) {
        const existingPc = peerConnections.current.get(data.userId);
        if (existingPc) {
          console.log(`📡 [WebRTC] Cerrando conexión vieja existente para ${data.userId} debido a user-joined-call.`);
          existingPc.close();
          peerConnections.current.delete(data.userId);
          screenTransceivers.current.delete(data.userId);
          pendingCandidates.current.delete(data.userId);
          cameraStreamId.current.delete(data.userId);
          audioSenders.current.delete(data.userId);
          videoSenders.current.delete(data.userId);
        }

        console.log("🚀 LLAMANDO A:", data.userId);
        callUser(data.userId);
      }
    });

    socket.on("existing-call-participants", (data: { userIds: string[] }) => {
      console.log(
        "👥 [Socket] Participantes existentes en llamada:",
        data.userIds,
      );

      data.userIds.forEach((userId) => {
        if (userId !== currentUserId) {
          const existingPc = peerConnections.current.get(userId);
          if (existingPc) {
            console.log(`📡 [WebRTC] Cerrando conexión vieja existente para ${userId} debido a existing-call-participants.`);
            existingPc.close();
            peerConnections.current.delete(userId);
            screenTransceivers.current.delete(userId);
            pendingCandidates.current.delete(userId);
            cameraStreamId.current.delete(userId);
            audioSenders.current.delete(userId);
            videoSenders.current.delete(userId);
          }

          callUser(userId);
        }
      });
    });

    socket.on("user-left-call", (data: { userId: string }) => {
      console.log(`🚪 [Socket] El usuario ${data.userId} abandonó la llamada.`);
      const pc = peerConnections.current.get(data.userId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(data.userId);
      }
      pendingCandidates.current.delete(data.userId);
      cameraStreamId.current.delete(data.userId);
      audioSenders.current.delete(data.userId);
      videoSenders.current.delete(data.userId);
      screenTransceivers.current.delete(data.userId);
      setRemoteStreams((prev) => prev.filter((s) => s.userId !== data.userId));
      setRemoteScreenStreams((prev) => {
        const next = new Map(prev);
        next.delete(data.userId);
        return next;
      });
    });

    socket.on("force-stop-screen-share", () => {
      console.log("🛑 El servidor pidió detener pantalla");
      unpublishScreenTrack();
    });

    // Cuando nos unimos, el servidor nos dice quién ya comparte pantalla
    socket.on("screen-share-peer-joined", async (data: { userId: string }) => {
      const screenTrack = localScreenStreamRef.current?.getVideoTracks()[0];
      if (!screenTrack || screenTrack.readyState !== "live") return;
      if (data.userId === currentUserId) return;

      const pc = createPeerConnection(data.userId);
      const screenTcvr =
        screenTransceivers.current.get(data.userId) ?? pc.getTransceivers()[2];
      if (!screenTcvr || pc.signalingState === "closed") return;

      try {
        await screenTcvr.sender.replaceTrack(screenTrack);
        if (screenTcvr.direction !== "sendrecv") {
          screenTcvr.direction = "sendrecv";
        }
        if (pc.signalingState !== "stable") return;

        makingOffer.current.set(data.userId, true);
        await pc.setLocalDescription(await pc.createOffer());
        socketRef.current?.emit("webrtc-offer", {
          roomId: roomIdRef.current,
          offer: pc.localDescription,
          to: data.userId,
        });
      } catch (err) {
        console.error(`Error republicando pantalla para ${data.userId}:`, err);
      } finally {
        makingOffer.current.set(data.userId, false);
      }
    });

    socket.on("active-screen-shares", (data: { userIds: string[] }) => {
      console.log(`🖥️ [Socket] Pantallas activas recibidas del servidor:`, data.userIds);
      data.userIds.forEach((uid) => {
        activeSharerIds.current.add(uid);
        // Intentar activar el stream si ya tenemos la PC y el transceiver
        handleScreenShareStarted({ userId: uid });
      });
    });

    return () => {
      console.log(
        "🗑️ [useWebRTC] Removiendo listeners y LIMPIANDO conexiones fantasma (Strict Mode Shield).",
      );
      socket.off("webrtc-offer", handleOffer);
      socket.off("webrtc-answer", handleAnswer);
      socket.off("webrtc-ice-candidate", handleIceCandidate);
      socket.off("screen-share-started", handleScreenShareStarted);
      socket.off("screen-share-stopped", handleScreenShareStopped);
      socket.off("user-joined-call");
      socket.off("existing-call-participants");
      socket.off("user-left-call");
      socket.off("force-stop-screen-share");
      socket.off("screen-share-peer-joined");
      socket.off("active-screen-shares");
      activeSharerIds.current.clear();

      pcs.forEach((pc) => {
        if (pc.signalingState !== "closed") {
          pc.close();
        }
      });

      pcs.clear();
      screenTransceivers.current.clear();
    };
  }, [
    socket,
    currentUserId,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    handleScreenShareStarted,
    handleScreenShareStopped,
    createPeerConnection,
    callUser,
  ]);

  // ── Limpieza total al desmontar ───────────────────────────────────
  useEffect(() => {
    console.log("🚀 [useWebRTC] Hook montado.");
    const pcs = peerConnections.current;

    return () => {
      console.log("🔴 useWebRTC DESMONTADO");

      pcs.forEach((pc) => {
        try {
          pc.close();
        } catch (error) {
          console.error("Error cerrando PeerConnection:", error);
        }
      });

      pcs.clear();
      audioSenders.current.clear();
      videoSenders.current.clear();
      screenTransceivers.current.clear();
    };
  }, []);

  // ── Acciones públicas ─────────────────────────────────────────────
  const joinCall = useCallback(() => {
    console.log(`📣 [Acción] Solicitando unirse a llamada en sala: ${roomId}`);
    socket?.emit("join-call", { roomId });
  }, [socket, roomId]);

  const renegotiatePeer = useCallback(
    async (remoteUserId: string, pc: RTCPeerConnection) => {
      if (pc.signalingState !== "stable") return;

      try {
        makingOffer.current.set(remoteUserId, true);
        await pc.setLocalDescription(await pc.createOffer());
        socketRef.current?.emit("webrtc-offer", {
          roomId: roomIdRef.current,
          offer: pc.localDescription,
          to: remoteUserId,
        });
      } catch (err) {
        console.error(`Error renegociando pantalla con ${remoteUserId}:`, err);
      } finally {
        makingOffer.current.set(remoteUserId, false);
      }
    },
    [],
  );

  const leaveCall = useCallback(() => {
    console.log("📣 [Acción] Abandonando llamada.");

    socket?.emit("leave-call", { roomId });

    peerConnections.current.forEach((pc) => {
      try {
        pc.close();
      } catch (error) {
        console.error(error);
      }
    });

    peerConnections.current.clear();
    cameraStreamId.current.clear();
    audioSenders.current.clear();
    videoSenders.current.clear();
    screenTransceivers.current.clear();
    localScreenStreamRef.current = null;
    setRemoteStreams([]);
    setRemoteScreenStreams(new Map());
  }, [socket, roomId]);

  // ── Screen share: publicar/despublicar el track local en todos los peers ──
  /**
   * publishScreenTrack
   * -------------------
   * Agrega el track de video de `stream` (obtenido vía getDisplayMedia) a
   * TODAS las PeerConnection activas, como un track adicional (no reemplaza
   * la cámara), y renegocia con cada peer para que el cambio se propague.
   */
  const publishScreenTrack = useCallback(async (stream: MediaStream) => {
    localScreenStreamRef.current = stream;
    const track = stream.getVideoTracks()[0];
    if (!track) return;

    for (const [remoteUserId, pc] of peerConnections.current.entries()) {
      if (!pc || pc.signalingState === "closed") continue;
      const screenTcvr = screenTransceivers.current.get(remoteUserId) || pc.getTransceivers()[2];
      if (!screenTcvr) continue;
      await screenTcvr.sender.replaceTrack(track);
      if (screenTcvr.direction !== "sendrecv") {
        screenTcvr.direction = "sendrecv";
      }
      await renegotiatePeer(remoteUserId, pc);
    }
  }, [renegotiatePeer]);

  const unpublishScreenTrack = useCallback(async () => {
    if (!localScreenStreamRef.current) return;

    for (const [remoteUserId, pc] of peerConnections.current.entries()) {
      if (!pc || pc.signalingState === "closed") continue;
      const screenTcvr = screenTransceivers.current.get(remoteUserId) || pc.getTransceivers()[2];
      if (!screenTcvr) continue;
      await screenTcvr.sender.replaceTrack(null);
      if (screenTcvr.direction !== "recvonly") {
        screenTcvr.direction = "recvonly";
      }
      await renegotiatePeer(remoteUserId, pc);
    }
    localScreenStreamRef.current = null;
  }, [renegotiatePeer]);
  // En tu archivo useWebRTC.ts
  const startScreenShare = useCallback(
    async (existingStream?: MediaStream) => {
      try {
        // Si la RoomPage ya nos mandó el stream, usamos ese. Si no, hace el fallback.
        const stream =
          existingStream ||
          (await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false,
          }));

        // Tu lógica interna para añadir el track a los peers (RTCPeerConnection)
        await publishScreenTrack(stream);

        return stream;
      } catch (error) {
        console.error("Error en startScreenShare del hook:", error);
        throw error;
      }
    },
    [publishScreenTrack, roomId, socket],
  );

  const stopScreenShare = useCallback(async () => {
    await unpublishScreenTrack();

    socket?.emit("stop-screen-share", {
      roomId,
    });
  }, [unpublishScreenTrack, socket, roomId]);

  return {
    remoteStreams,
    remoteScreenStreams,
    joinCall,
    leaveCall,
    publishScreenTrack,
    unpublishScreenTrack,
    startScreenShare,
    stopScreenShare,
  };
}
