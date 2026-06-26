import { useEffect, useRef, useState, useCallback } from "react";
import { Socket } from "socket.io-client";

interface RemoteStream {
  userId: string;
  stream: MediaStream;
}

const ICE_SERVERS: RTCConfiguration = {
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
    if (!localStream) return;
    const newAudioTrack = localStream.getAudioTracks()[0] || null;
    const newVideoTrack = localStream.getVideoTracks()[0] || null;

    peerConnections.current.forEach((pc) => {
      // Update Audio Track
      const audioTransceivers = pc.getTransceivers().filter(t => t.receiver.track.kind === "audio");
      const audioTransceiver = audioTransceivers[0];
      if (audioTransceiver && audioTransceiver.sender.track !== newAudioTrack) {
        audioTransceiver.sender.replaceTrack(newAudioTrack).catch(e => console.error("Error replacing audio track:", e));
      }

      // Update Video Track (Camera)
      // La cámara siempre es el PRIMER transceiver de video creado.
      const videoTransceivers = pc.getTransceivers().filter(t => t.receiver.track.kind === "video");
      const cameraTransceiver = videoTransceivers[0];

      if (cameraTransceiver && cameraTransceiver.sender.track !== newVideoTrack) {
        cameraTransceiver.sender.replaceTrack(newVideoTrack).catch(e => console.error("Error replacing camera track:", e));
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

      if (currentLocalStream && currentLocalStream.getAudioTracks().length > 0) {
        pc.addTrack(currentLocalStream.getAudioTracks()[0], streamToGroup);
      } else {
        pc.addTransceiver("audio", { direction: "sendrecv", streams: [streamToGroup] });
      }

      if (currentLocalStream && currentLocalStream.getVideoTracks().length > 0) {
        pc.addTrack(currentLocalStream.getVideoTracks()[0], streamToGroup);
      } else {
        pc.addTransceiver("video", { direction: "sendrecv", streams: [streamToGroup] });
      }

      if (localScreenStreamRef.current) {
        const screenTrack = localScreenStreamRef.current.getVideoTracks()[0];
        if (screenTrack) {
          pc.addTrack(screenTrack, localScreenStreamRef.current);
        }
      }

      pc.ontrack = (event) => {
        console.log("🚨 [DEBUG ONTRACK] ¡Llegó un track físico al navegador!", {
          kind: event.track.kind,
          streamId: event.streams[0]?.id,
          trackLabel: event.track.label,
        });

        const stream = event?.streams?.[0];
        if (!stream) return;

        console.log(
          `🎵 [WebRTC] Track recibido: ${event.track.kind} de ${remoteUserId}`,
        );

        // 🔥 SOLUCIÓN AL CLOSURE: Usamos un set-state funcional para leer el valor REAL
        // y más actualizado de los streams en el momento exacto en que llega el track.
        setRemoteStreams((currentRemoteStreams) => {
          const knownCameraStreamId = cameraStreamId.current.get(remoteUserId);

          // Si ya conocemos el stream principal de la cámara y este track llega
          // en un stream diferente, se trata de una pantalla compartida.
          if (knownCameraStreamId && stream.id !== knownCameraStreamId) {
            if (event.track.kind === "video") {
              console.log(
                `🖥️ [WebRTC] ¡Detectada pantalla compartida de ${remoteUserId}!`,
              );
              setRemoteScreenStreams((prev) => {
                const next = new Map(prev);
                next.set(remoteUserId, stream);
                return next;
              });

              stream.addEventListener("removetrack", () => {
                if (stream.getVideoTracks().length === 0) {
                  setRemoteScreenStreams((prev) => {
                    const next = new Map(prev);
                    next.delete(remoteUserId);
                    return next;
                  });
                }
              });
            }
            return currentRemoteStreams;
          }

          // Es el primer stream o es el mismo stream de la cámara principal
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
      const pc = peerConnections.current.get(remoteUserId);
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
    [currentUserId, roomId, socket],
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
  const handleScreenShareStopped = useCallback((data: { userId: string }) => {
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
    socket.on("screen-share-stopped", handleScreenShareStopped);

    socket.on("user-joined-call", (data) => {
      console.log("👤 user-joined-call", data.userId, "yo:", currentUserId);

      if (data.userId !== currentUserId) {
        // 🛑 CANDADO 1: Si ya existe una conexión viva, no la vuelvas a duplicar
        const existingPc = peerConnections.current.get(data.userId);
        if (existingPc && existingPc.signalingState !== "closed") {
          console.log(
            `⚠️ [WebRTC] Ignorando 'user-joined-call' para ${data.userId} porque ya hay una conexión activa.`,
          );
          return;
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
          // 🛑 CANDADO 2: Si ya existe una conexión viva en el mapa, no la dupliques
          const existingPc = peerConnections.current.get(userId);
          if (existingPc && existingPc.signalingState !== "closed") {
            console.log(
              `⚠️ [WebRTC] Ignorando participante existente ${userId} porque ya está conectado.`,
            );
            return;
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

    return () => {
      console.log(
        "🗑️ [useWebRTC] Removiendo listeners y LIMPIANDO conexiones fantasma (Strict Mode Shield).",
      );
      socket.off("webrtc-offer", handleOffer);
      socket.off("webrtc-answer", handleAnswer);
      socket.off("webrtc-ice-candidate", handleIceCandidate);
      socket.off("screen-share-stopped", handleScreenShareStopped);
      socket.off("user-joined-call");
      socket.off("existing-call-participants");
      socket.off("user-left-call");
      socket.off("force-stop-screen-share");

      pcs.forEach((pc) => {
        if (pc.signalingState !== "closed") {
          pc.close();
        }
      });

      pcs.clear();
    };
  }, [
    socket,
    currentUserId,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    handleScreenShareStopped,
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
    };
  }, []);

  // ── Acciones públicas ─────────────────────────────────────────────
  const joinCall = useCallback(() => {
    console.log(`📣 [Acción] Solicitando unirse a llamada en sala: ${roomId}`);
    socket?.emit("join-call", { roomId });
  }, [socket, roomId]);

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

    for (const [, pc] of peerConnections.current.entries()) {
      // Se debe usar addTransceiver explícito para evitar que WebRTC reutilice
      // el transceiver vacío de video de la cámara (si estaba apagada).
      pc.addTransceiver(track, { direction: "sendonly", streams: [stream] });
    }
  }, []);

  /**
   * unpublishScreenTrack
   * ---------------------
   * Quita el track de pantalla de todas las PeerConnection activas y
   * renegocia. No detiene el MediaStream en sí (eso lo hace quien llamó a
   * getDisplayMedia, típicamente el hook de arbitraje de screen share).
   */
  const unpublishScreenTrack = useCallback(async () => {
    const stream = localScreenStreamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];

    const peers = Array.from(peerConnections.current.entries());
    for (const [, pc] of peers) {
      const sender = pc.getSenders().find((s) => s.track === track);
      if (sender) {
        pc.removeTrack(sender);
      }
    }
    localScreenStreamRef.current = null;
  }, []);

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
