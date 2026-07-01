import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Hash, Users, Video, Copy, Check, Monitor, Layout } from "lucide-react";
import useAuthStore from "../stores/useAuthStore";
import { getRoomMessages } from "../services/roomService";
import { useRoom } from "../hooks/useRoom";
import { useSocket } from "../hooks/useSocket";
import { useWebRTC } from "../hooks/useWebRTC";
import { ParticipantCard } from "../features/room/ParticipantCard";
import { ChatPanel } from "../features/room/ChatPanel";
import { RoomControls } from "../features/room/RoomControls";
import { useGridLayout } from "../hooks/useGridLayout";

interface Message {
  id: number;
  author: string;
  text: string;
}

// ─── Gap entre tiles del grid dinámico ───────────────────────────────────────
const GAP = 8;

// ─── Subcomponente para las diferentes distribuciones de video ─────────────

interface VideoGridProps {
  remotePeers: ReturnType<typeof useSocket>["participants"];
  remoteStreams: ReturnType<typeof useWebRTC>["remoteStreams"];
  remoteScreenStreams: ReturnType<typeof useWebRTC>["remoteScreenStreams"];
  localStream: MediaStream | null;
  camOn: boolean;
  micOn: boolean;
  totalPersonas: number;
  screenStream?: MediaStream | null;
  currentUserId: string;
  localAvatar?: string;
  presentationMode: boolean;
}

type ActiveScreen = {
  ownerId: string;
  stream: MediaStream;
  isLocal: boolean;
};

type TileData =
  | { id: string; kind: "screen"; ownerId: string; isLocal: boolean; stream: MediaStream }
  | { id: string; kind: "local" }
  | { id: string; kind: "remote"; peerId: string };

// ── Subcomponente: un <video> que se auto-conecta a su MediaStream ────────
// Reutilizable tanto para la pantalla grande como para las miniaturas.
function ScreenVideo({
  stream,
  className,
  muted = true,
}: {
  stream: MediaStream;
  className?: string;
  muted?: boolean;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    el.play().catch((err) => {
      console.warn(
        "⚠️ [ScreenVideo] Fallo al reproducir, reintentando...",
        err,
      );
    });
  }, [stream]);

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={className ?? "w-full h-full object-contain"}
    />
  );
}

// ── Tile de pantalla compartida dentro del grid unificado ─────────────────
function ScreenTile({
  stream,
  ownerName,
  isLocal,
  style,
}: {
  stream: MediaStream;
  ownerName: string;
  isLocal?: boolean;
  style?: { width: number; height: number };
}) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden ring-2 ring-cyan-500/60 bg-black flex items-center justify-center"
      style={style}
    >
      <ScreenVideo stream={stream} muted={isLocal} />
      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded-md p-1">
        <Monitor className="w-3 h-3 text-cyan-400" />
      </div>
      <div className="absolute bottom-2 left-2 right-2 bg-gray-950/40 backdrop-blur-sm px-2 py-1 rounded-lg">
        <span className="text-white text-[10px] sm:text-xs font-medium truncate block">
          {isLocal ? "Tu pantalla" : `Pantalla de ${ownerName}`}
        </span>
      </div>
    </div>
  );
}

function VideoGrid({
  remotePeers = [],
  remoteStreams = [],
  remoteScreenStreams = new Map(),
  localStream,
  camOn,
  micOn,
  screenStream,
  currentUserId,
  localAvatar,
  presentationMode,
}: VideoGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Medir el contenedor para calcular layout óptimo
  useEffect(() => {
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContainerSize({ width, height });
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (remoteStreams) {
      console.log("🔍 [DEBUG WebRTC] remoteStreams actuales:", remoteStreams);
    }
    if (screenStream) {
      console.log("🖥️ [DEBUG WebRTC] screenStream actual:", screenStream);
    }
  }, [screenStream, remoteStreams]);

  // ── 1. Recolectar TODAS las pantallas activas (la propia + las remotas) ──
  const activeScreens: ActiveScreen[] = useMemo(() => {
    const screens: ActiveScreen[] = [];

    if (screenStream) {
      screens.push({
        ownerId: currentUserId || "local-screen",
        stream: screenStream,
        isLocal: true,
      });
    }

    for (const [ownerId, stream] of remoteScreenStreams.entries()) {
      // 'local-screen' es un identificador interno que algunos flujos usan para
      // marcar el stream propio dentro del mismo Map; si aparece, lo tratamos
      // como local también, evitando duplicarlo con la entrada de screenStream.
      if (ownerId === "local-screen") {
        if (!screenStream) {
          screens.push({
            ownerId: currentUserId || "local-screen",
            stream,
            isLocal: true,
          });
        }
        continue;
      }
      screens.push({ ownerId, stream, isLocal: false });
    }

    return screens;
  }, [screenStream, Array.from(remoteScreenStreams.entries()) , currentUserId]);

  // ── 2. Pantalla seleccionada para modo presentación ──────────────────────
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);

  useEffect(() => {
    const stillExists = activeScreens.some(
      (s) => s.ownerId === selectedOwnerId,
    );
    if (!stillExists) {
      setSelectedOwnerId(activeScreens[0]?.ownerId ?? null);
    }
  }, [activeScreens, selectedOwnerId]);

  const mainScreen =
    activeScreens.find((s) => s.ownerId === selectedOwnerId) ??
    activeScreens[0] ??
    null;
  const otherScreens = activeScreens.filter(
    (s) => s.ownerId !== mainScreen?.ownerId,
  );

  const getOwnerName = (ownerId: string, isLocal: boolean) => {
    if (isLocal) return "Tú";
    return remotePeers.find((p) => p.id === ownerId)?.name || "Participante";
  };

  // Render helpers
  const renderLocalCard = (className?: string) => {
    const streamParaMiCard = camOn ? localStream : null;
    return (
      <ParticipantCard
        name="Tú"
        speaking={false}
        stream={streamParaMiCard}
        isLocal={true}
        className={className}
        micOn={micOn}
        avatar={localAvatar}
      />
    );
  };

  const renderRemoteCard = (peer: (typeof remotePeers)[number]) => {
    const cameraStream =
      remoteStreams.find((s) => s.userId === peer.id)?.stream ?? null;
    return (
      <ParticipantCard
        key={peer.id}
        name={peer.name}
        speaking={peer.speaking}
        stream={cameraStream}
        camOn={peer.camOn}
        isLocal={false}
        micOn={peer.micOn}
        avatar={peer.avatar}
      />
    );
  };

  // ── 3. Array unificado de tiles: pantallas → local → remotos ─────────────
  const tiles = useMemo<TileData[]>(() => {
    const result: TileData[] = [];
    for (const screen of activeScreens) {
      result.push({
        id: `screen-${screen.ownerId}`,
        kind: "screen",
        ownerId: screen.ownerId,
        isLocal: screen.isLocal,
        stream: screen.stream,
      });
    }
    result.push({ id: "local", kind: "local" });
    for (const peer of remotePeers) {
      result.push({ id: `remote-${peer.id}`, kind: "remote", peerId: peer.id });
    }
    return result;
  }, [activeScreens, remotePeers]);

  // ── 4. Layout calculado por el hook de maximización de área ───────────────
  const { columns, tileWidth, tileHeight } = useGridLayout(
    containerSize.width,
    containerSize.height,
    tiles.length,
    { gap: GAP },
  );

  // ── Variable para el branch 1-on-1 (necesaria antes del return único) ──────
  const pipPeer =
    activeScreens.length === 0 && remotePeers.length === 1
      ? remotePeers[0]
      : null;

  // ── Un solo return: containerRef siempre montado → ResizeObserver siempre activo
  return (
    <div ref={containerRef} className="w-full h-full relative flex items-center justify-center">

      {/* MODO PRESENTACIÓN */}
      {presentationMode && mainScreen ? (
        <div className="flex flex-col lg:flex-row gap-4 w-full h-full items-stretch">
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <div className="flex-1 min-h-[180px] sm:min-h-[300px] bg-black rounded-lg sm:rounded-xl overflow-hidden flex items-center justify-center relative">
              <ScreenVideo stream={mainScreen.stream} />
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-md text-sm">
                Pantalla de {getOwnerName(mainScreen.ownerId, mainScreen.isLocal)}
              </div>
              {activeScreens.length > 1 && (
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-md text-xs">
                  {activeScreens.length} pantallas compartidas
                </div>
              )}
            </div>
            {otherScreens.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {otherScreens.map((screen) => (
                  <button
                    key={screen.ownerId}
                    onClick={() => setSelectedOwnerId(screen.ownerId)}
                    className="relative w-40 aspect-video flex-shrink-0 rounded-lg overflow-hidden border-2 border-gray-700 hover:border-cyan-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none"
                    title={`Ver pantalla de ${getOwnerName(screen.ownerId, screen.isLocal)} en grande`}
                  >
                    <ScreenVideo
                      stream={screen.stream}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[11px] px-1.5 py-0.5 rounded">
                      {getOwnerName(screen.ownerId, screen.isLocal)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="w-full lg:w-72 flex lg:flex-col gap-2 sm:gap-3 overflow-x-auto lg:overflow-y-auto p-1 flex-shrink-0">
            <div className="w-32 sm:w-40 lg:w-full aspect-video flex-shrink-0 rounded-xl overflow-hidden shadow-md">
              {renderLocalCard("w-full h-full object-cover")}
            </div>
            {remotePeers.map((peer) => (
              <div
                key={peer.id}
                className="w-32 sm:w-40 lg:w-full aspect-video flex-shrink-0 rounded-xl overflow-hidden shadow-md"
              >
                {renderRemoteCard(peer)}
              </div>
            ))}
          </div>
        </div>

      /* CARGANDO */
      ) : !localStream && remotePeers.length === 0 ? (
        <p className="text-gray-500 animate-pulse">
          Iniciando medios y buscando peers...
        </p>

      /* 1-ON-1 con PiP */
      ) : pipPeer ? (
        <>
          <div className="w-full h-full max-w-5xl aspect-video">
            {renderRemoteCard(pipPeer)}
          </div>
          <div className="absolute bottom-20 sm:bottom-4 right-2 sm:right-4 w-24 h-16 sm:w-48 sm:h-32 shadow-2xl rounded-xl sm:rounded-2xl overflow-hidden border border-gray-700/60 z-10 transition-all hover:scale-105">
            {renderLocalCard("w-full h-full")}
          </div>
        </>

      /* GRID DINÁMICO (solo yo, ≥2 personas, o con pantallas) */
      ) : containerSize.width > 0 ? (
        <div className="w-full h-full flex items-center justify-center">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${columns}, ${tileWidth}px)`,
              gap: `${GAP}px`,
            }}
          >
            {tiles.map((tile) => {
              const tileStyle = { width: tileWidth, height: tileHeight };
              if (tile.kind === "screen") {
                return (
                  <ScreenTile
                    key={tile.id}
                    stream={tile.stream}
                    ownerName={getOwnerName(tile.ownerId, tile.isLocal)}
                    isLocal={tile.isLocal}
                    style={tileStyle}
                  />
                );
              }
              if (tile.kind === "local") {
                return (
                  <div key={tile.id} style={tileStyle} className="rounded-2xl overflow-hidden">
                    {renderLocalCard("w-full h-full")}
                  </div>
                );
              }
              const peer = remotePeers.find((p) => p.id === tile.peerId);
              if (!peer) return null;
              return (
                <div key={tile.id} style={tileStyle} className="rounded-2xl overflow-hidden">
                  {renderRemoteCard(peer)}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Componente principal ───────────────────────────────────────────────────
function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userLogged } = useAuthStore();
  const room = useRoom();

  const { participants: socketParticipants, socket } = useSocket(id ?? "");
  const currentUserId = userLogged?.uid ?? "";

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [devicesReady, setDevicesReady] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);

  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [copied, setCopied] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);

  // Detectar soporte real de compartir pantalla (no disponible en Android ni en algunos móviles)
  const canShareScreen =
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function";

  // ── Estados de Permisos ─────────────────────────────────────────────────
  const [cameraPermission, setCameraPermission] = useState<
    "granted" | "denied" | "unavailable" | "prompt"
  >("prompt");
  const [micPermission, setMicPermission] = useState<
    "granted" | "denied" | "unavailable" | "prompt"
  >("prompt");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [modalPermissionType, setModalPermissionType] = useState<
    "camera" | "mic" | "both"
  >("camera");

  const chatToggleFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (room.chatOpen) {
      chatToggleFocusRef.current = document.activeElement as HTMLElement;
    } else {
      if (chatToggleFocusRef.current) {
        chatToggleFocusRef.current.focus();
        chatToggleFocusRef.current = null;
      }
    }
  }, [room.chatOpen]);
  
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pendingScreenStreamRef = useRef<MediaStream | null>(null);

  // Sincronizar referencia del stream local para limpiezas futuras
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Detener de forma limpia el stream anterior
  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => {
        track.stop();
        console.log(`🛑 Track local detenido: ${track.kind}`);
      });
      localStreamRef.current = null;
    }
    setLocalStream(null);
  }, []);

  const {
    setMicOn,
    setCamOn,
    setScreenSharing: setRoomScreenSharing,
    screenSharing,
  } = room;

  // ── Captura e inicialización de dispositivos ──────────────────────────
  const initDevices = useCallback(async () => {
    stopLocalStream();
    setDevicesReady(false);

    let streamInstance: MediaStream | null = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setLocalStream(stream);
      localStreamRef.current = stream;
      streamInstance = stream;
      setCameraPermission("granted");
      setMicPermission("granted");
      setMicOn(true);
      setCamOn(true);
      setShowPermissionModal(false);
    } catch (err) {
      console.error("Error accediendo a periféricos (video+audio):", err);
      const errorName = err instanceof Error ? err.name : "";
      const isCamDenied =
        errorName === "NotAllowedError" ||
        errorName === "PermissionDeniedError";
      setCameraPermission(isCamDenied ? "denied" : "unavailable");
      setCamOn(false);

      // Fallback: intentar solo con audio
      try {
        const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });

        setLocalStream(audioOnlyStream);
        localStreamRef.current = audioOnlyStream;
        streamInstance = audioOnlyStream;
        setMicPermission("granted");
        setMicOn(true);
        setShowPermissionModal(false);
        console.warn("⚠️ Continuando sin video: solo se obtuvo audio.");
      } catch (audioErr) {
        console.error("Error accediendo a periféricos (solo audio):", audioErr);
        const errorName = audioErr instanceof Error ? audioErr.name : "";
        const isMicDenied =
          errorName === "NotAllowedError" ||
          errorName === "PermissionDeniedError";
        setMicPermission(isMicDenied ? "denied" : "unavailable");
        setMicOn(false);
      }
    } finally {
      setDevicesReady(true);
    }
    return streamInstance;
  }, [setMicOn, setCamOn, stopLocalStream]);

  // Inicializar dispositivos al cargar
  useEffect(() => {
    initDevices();

    return () => {
      stopLocalStream();
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [initDevices, stopLocalStream]);

  const {
    remoteStreams,
    remoteScreenStreams,
    joinCall,
    leaveCall,
    startScreenShare,
    stopScreenShare,
  } = useWebRTC(id ?? "", localStream, socket, currentUserId);


  // ── Memoización de derivados ───────────────────────────────────────────
  const remotePeers = useMemo(
    () => socketParticipants.filter((p) => p.id !== currentUserId),
    [socketParticipants, currentUserId],
  );

  const totalPersonas = useMemo(
    () => remotePeers.length + (localStream ? 1 : 0),
    [remotePeers, localStream],
  );

  const hasScreenShare = !!screenStream || remoteScreenStreams.size > 0;

  // ── Sincronización de pista de audio ───────────────────────────────────
  useEffect(() => {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = room.micOn));
  }, [room.micOn, localStream]);

  // ── Sincronización de pista de video y notificación al socket ────────
  useEffect(() => {
    if (!localStream) return;
    localStream
      .getVideoTracks()
      .forEach((track) => (track.enabled = room.camOn));

    if (socket && id) {
      socket.emit("update-media-state", {
        roomId: id,
        userId: currentUserId,
        camOn: room.camOn,
        micOn: room.micOn,
      });
    }
  }, [room.camOn, room.micOn, localStream, socket, id, currentUserId]);

  // ── Unirse a la llamada WebRTC ────────────────────────────────────────
  // Espera a que getUserMedia termine (devicesReady) antes de emitir join-call.
  // Sin esto, el peer remoto crearía la PC antes de que haya tracks locales.
  useEffect(() => {
    if (socket && devicesReady) {
      joinCall();
    }
  }, [socket, devicesReady, joinCall]);

  // ── Historial de chat al entrar ───────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    getRoomMessages(id).then((result) => {
      if (result.success) {
        setChatMessages(
          result.data.map((m) => ({
            id: typeof m.id === "string" ? parseInt(m.id, 36) : Number(m.id),
            author: m.author,
            text: m.text,
          })),
        );
      }
    });
  }, [id]);

  // ── Sala eliminada: navegar al dashboard ─────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      leaveCall();
      navigate("/dashboard");
    };
    socket.on("room-deleted", handler);
    return () => {
      socket.off("room-deleted", handler);
    };
  }, [socket, leaveCall, navigate]);

  // ── Manejo del chat vía socket ────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handler = (msg: Message) => setChatMessages((prev) => [...prev, msg]);
    socket.on("receive_message", handler);

    return () => {
      socket.off("receive_message", handler);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || !id) return;

    const handleGranted = async () => {
      console.log(
        "🖥️  [Socket] Backend autorizó compartir pantalla. Delegando a useWebRTC...",
      );

      try {
        const stream = pendingScreenStreamRef.current;
        if (!stream) {
            console.warn("⚠️ [Screen Share] Se otorgó permiso pero no hay stream pendiente.");
            return;
        }

        console.log("📺 Stream de pantalla obtenido con éxito:", stream.id);
        setScreenStream(stream);
        screenStreamRef.current = stream;
        setRoomScreenSharing(true);

        await startScreenShare(stream);

        // Escuchamos el botón nativo de "Dejar de compartir" de la barra de Chrome
        stream.getVideoTracks()[0].onended = () => {
          console.log(
            "🖥️  [Browser] Pantalla finalizada desde el control nativo.",
          );
          setScreenStream(null);
          screenStreamRef.current = null;
          setRoomScreenSharing(false);
          stopScreenShare();
        };
      } catch (error) {
        console.error(
          "❌ Error en el flujo coordinado de pantalla compartida:",
          error,
        );
      } finally {
        pendingScreenStreamRef.current = null;
      }
    };

    const handleDenied = (data: { reason: string }) => {
        console.warn(`🚫 [Screen Share] Permiso denegado: ${data.reason}`);
        if (pendingScreenStreamRef.current) {
            pendingScreenStreamRef.current.getTracks().forEach((t) => t.stop());
            pendingScreenStreamRef.current = null;
        }
        alert(`No se pudo compartir pantalla: ${data.reason}`);
    };

    socket.on("screen-share-granted", handleGranted);
    socket.on("screen-share-denied", handleDenied);

    return () => {
      socket.off("screen-share-granted", handleGranted);
      socket.off("screen-share-denied", handleDenied);
    };
  }, [socket, id, startScreenShare, setRoomScreenSharing, stopScreenShare]);

  // ── Handlers memorizados ──────────────────────────────────────────────
  const handleSendMessage = useCallback(() => {
    const text = room.message.trim();
    if (!text || !socket) return;
    socket.emit("send_message", { roomId: id, message: text });
    room.setMessage("");
  }, [room, socket, id]);

  const handleLeaveRoom = useCallback(() => {
    leaveCall();
    localStream?.getTracks().forEach((track) => track.stop());
    screenStream?.getTracks().forEach((track) => track.stop());
    setScreenStream(null);
    navigate("/dashboard");
  }, [leaveCall, localStream, screenStream, navigate]);

  // ── Handlers de Permisos ─────────────────────────────────────────────
  const handleToggleMic = useCallback(() => {
    if (micPermission === "denied" || micPermission === "unavailable") {
      setModalPermissionType(
        cameraPermission === "denied" || cameraPermission === "unavailable"
          ? "both"
          : "mic",
      );
      setShowPermissionModal(true);
      return;
    }
    room.setMicOn((v) => !v);
  }, [micPermission, cameraPermission, room]);

  const handleToggleCam = useCallback(async () => {
    if (cameraPermission === "denied" || cameraPermission === "unavailable") {
      setModalPermissionType(
        micPermission === "denied" || micPermission === "unavailable"
          ? "both"
          : "camera",
      );
      setShowPermissionModal(true);
      return;
    }
    
    if (room.camOn) {
      room.setCamOn(false);
    } else {
      const currentVideoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (currentVideoTrack) {
        room.setCamOn(true);
      } else {
        try {
          const newVideoStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          if (localStreamRef.current) {
            const audioTracks = localStreamRef.current.getAudioTracks();
            const newStream = new MediaStream([
              ...audioTracks,
              ...newVideoStream.getVideoTracks(),
            ]);
            setLocalStream(newStream);
          } else {
            setLocalStream(newVideoStream);
          }
          room.setCamOn(true);
        } catch (error) {
          console.error("Error al encender la cámara:", error);
        }
      }
    }
  }, [cameraPermission, micPermission, room]);

  const handleToggleScreenShare = async () => {
    if (!socket || !id) return;

    if (!screenSharing) {
      console.log("➡️ [UI] Solicitando permiso al backend...");
      try {
        // 🚀 CAPTURA DIRECTA EN LA ROOM PAGE
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

        console.log("🖥️ [RoomPage] Pantalla capturada en espera de aprobación:", stream.id);

        // Guardamos en estado pendiente. Si conceden permiso, lo publicaremos.
        pendingScreenStreamRef.current = stream;

        // Escuchar si el usuario cancela desde el navegador antes de que aprueben
        stream.getVideoTracks()[0].onended = () => {
          pendingScreenStreamRef.current = null;
          // Opcionalmente notificar al servidor que se canceló la petición
        };

        // Solicitar permiso al servidor (turnos)
        socket.emit("request-screen-share", { 
            roomId: id, 
            userName: userLogged?.displayName 
        });

      } catch (err) {
        console.error("❌ Error al capturar pantalla en la UI:", err);
      }
    } else {
      // Apagado manual desde el botón de la app
      console.log("🛑 Deteniendo pantalla compartida manualmente...");
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      stopScreenShare();
      setScreenStream(null);
      screenStreamRef.current = null;
      setRoomScreenSharing(false);
    }
  };



  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden select-none" style={{ height: "100dvh" }}>
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 bg-gray-900 border-b border-gray-800 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-500 text-gray-950 rounded p-1.5">
            <Video className="h-4 w-4" />
          </div>
          <span className="font-bold text-xs sm:text-base">StudyRoom</span>
          <span className="text-gray-500 text-xs sm:text-base hidden xs:inline">|</span>
          <button
            onClick={() => {
              if (id) {
                navigator.clipboard.writeText(id);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }
            }}
            aria-label={copied ? "Código copiado" : `Copiar código de sala: ${id}`}
            className="flex items-center gap-1.5 text-cyan-400 text-sm hover:text-cyan-300 hover:bg-gray-800 px-2 py-1 rounded transition-all active:scale-95 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none"
            title="Copiar código de sala"
          >
            <Hash className="h-4 w-4" />
            <span className="font-mono font-bold">{id}</span>
            {copied ? (
              <span className="flex items-center gap-1 text-green-400 ml-1">
                <Check className="h-4 w-4" />
                <span className="text-xs font-semibold">¡Copiado!</span>
              </span>
            ) : (
              <Copy className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-3">
          {hasScreenShare && (
            <button
              onClick={() => setPresentationMode((v) => !v)}
              aria-label={presentationMode ? "Volver a cuadrícula" : "Modo presentación"}
              aria-pressed={presentationMode}
              className={`p-1.5 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none ${
                presentationMode
                  ? "bg-cyan-500 text-gray-950"
                  : "bg-gray-800/80 hover:bg-gray-700 text-white"
              }`}
              title={presentationMode ? "Volver a cuadrícula" : "Modo presentación"}
            >
              <Layout className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Users className="h-4 w-4" />
            <span>{totalPersonas} participantes</span>
          </div>
        </div>
      </header>

      {/* Banner de alerta de permisos si están bloqueados */}
      {(cameraPermission === "denied" || micPermission === "denied") && (
        <div className="bg-red-950/80 border-b border-red-900/40 px-4 py-2 sm:px-6 flex items-center justify-between text-xs sm:text-sm text-red-200 z-30 transition-all">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-red-900/50 rounded-full">🛡️</span>
            <span>
              {cameraPermission === "denied" && micPermission === "denied"
                ? "El acceso a la cámara y al micrófono está bloqueado por tu navegador."
                : cameraPermission === "denied"
                  ? "El acceso a la cámara está bloqueado por tu navegador."
                  : "El acceso al micrófono está bloqueado por tu navegador."}{" "}
              Para que los demás puedan verte y escucharte, habilita los
              permisos.
            </span>
          </div>
          <button
            onClick={() => {
              setModalPermissionType(
                cameraPermission === "denied" && micPermission === "denied"
                  ? "both"
                  : cameraPermission === "denied"
                    ? "camera"
                    : "mic",
              );
              setShowPermissionModal(true);
            }}
            aria-label="Configurar permisos de cámara y micrófono"
            className="ml-4 shrink-0 px-3 py-1 bg-red-800 hover:bg-red-700 active:bg-red-900 text-white font-medium rounded-lg transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus:outline-none"
          >
            Configurar
          </button>
        </div>
      )}

      {/* Área principal: video + chat */}
      <div className="flex flex-1 min-w-0 overflow-hidden min-h-0 relative">
        <main className="flex-1 min-w-0 p-2 sm:p-4 overflow-y-auto sm:overflow-hidden min-h-0 relative flex items-center justify-center">
          <div className="w-full h-full min-w-0 relative flex items-center justify-center">
            <VideoGrid
              remotePeers={remotePeers}
              remoteStreams={remoteStreams}
              remoteScreenStreams={remoteScreenStreams}
              localStream={localStream}
              camOn={room.camOn}
              micOn={room.micOn}
              totalPersonas={totalPersonas}
              screenStream={screenStream}
              currentUserId={currentUserId}
              localAvatar={userLogged?.photoURL ?? undefined}
              presentationMode={presentationMode}
            />
          </div>
        </main>

        {room.chatOpen && (
          <ChatPanel
            messages={chatMessages}
            message={room.message}
            onClose={() => room.setChatOpen(false)}
            onChange={room.setMessage}
            onSend={handleSendMessage}
            currentUserName={userLogged?.displayName ?? "Anónimo"}
          />
        )}
      </div>

      {/* Controles inferiores */}
      <RoomControls
        micOn={room.micOn}
        camOn={room.camOn}
        chatOpen={room.chatOpen}
        screenSharing={screenSharing}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleMic={handleToggleMic}
        onToggleCam={handleToggleCam}
        onToggleChat={() => room.setChatOpen((v) => !v)}
        onLeave={handleLeaveRoom}
        micPermission={micPermission}
        camPermission={cameraPermission}
        canShareScreen={canShareScreen}
      />

      <PermissionModal
        isOpen={showPermissionModal}
        type={modalPermissionType}
        onClose={() => setShowPermissionModal(false)}
        onRetry={() => {
          setShowPermissionModal(false);
          initDevices();
        }}
      />
    </div>
  );
}

// ─── Componente Modal de Permisos ──────────────────────────────────────────
interface PermissionModalProps {
  isOpen: boolean;
  type: "camera" | "mic" | "both";
  onClose: () => void;
  onRetry: () => void;
}
// eslint-disable-next-line no-unused-vars
function PermissionModal({
  isOpen,
  type,
  onClose,
  onRetry,
}: PermissionModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      closeRef.current?.focus();
    } else {
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        if (!closeRef.current || !retryRef.current) return;
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === closeRef.current) {
            retryRef.current.focus();
            e.preventDefault();
          }
        } else {
          if (active === retryRef.current) {
            closeRef.current.focus();
            e.preventDefault();
          }
        }
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKey);
    }
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const title =
    type === "camera"
      ? "Acceso a la cámara bloqueado"
      : type === "mic"
        ? "Acceso al micrófono bloqueado"
        : "Acceso a cámara y micrófono bloqueado";

  const description =
    type === "camera"
      ? "StudyRoom necesita acceder a tu cámara para que los demás participantes puedan verte."
      : type === "mic"
        ? "StudyRoom necesita acceder a tu micrófono para que los demás participantes puedan escucharte."
        : "StudyRoom necesita acceder a tu cámara y micrófono para que los demás participantes puedan verte y escucharte.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop con desenfoque de fondo */}
      <button
        className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity w-full h-full border-0 cursor-default"
        onClick={onClose}
        aria-label="Cerrar modal"
        type="button"
        tabIndex={-1}
      />

      {/* Contenedor del Modal */}
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full mx-auto shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 text-left">
        {/* Icono de advertencia */}
        <div className="flex justify-center">
          <div className="bg-red-500/10 text-red-500 p-3.5 rounded-full border border-red-500/20">
            <svg
              className="w-8 h-8 animate-pulse"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* Cabecera */}
        <div className="space-y-2 text-center">
          <h3 className="text-xl font-bold text-white tracking-wide">
            {title}
          </h3>
          <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
        </div>

        {/* Instrucciones de solución */}
        <div className="bg-gray-950/60 rounded-xl p-4 border border-gray-800/80 text-xs sm:text-sm text-gray-300 space-y-3">
          <p className="font-semibold text-cyan-400">
            ¿Cómo habilitar los permisos?
          </p>
          <p className="text-xs text-gray-400">
            Por seguridad, el navegador no permite que el sitio web fuerce la
            solicitud si ya la has denegado. Debes habilitarla manualmente:
          </p>
          <ol className="list-decimal pl-4 space-y-2 text-gray-400">
            <li>
              Busca en la barra de direcciones (donde dice la URL de la página):
              <ul className="list-disc pl-4 mt-1 space-y-1 text-gray-300">
                <li>
                  <strong>A la izquierda:</strong> Haz clic en el ícono de
                  configuración/ajustes{" "}
                  <span className="text-white font-mono bg-gray-800 px-1 py-0.5 rounded">
                    🎛️
                  </span>
                  , información{" "}
                  <span className="text-white font-mono bg-gray-800 px-1.5 py-0.5 rounded">
                    ⓘ
                  </span>{" "}
                  o candado{" "}
                  <span className="text-white font-mono bg-gray-800 px-1 py-0.5 rounded">
                    🔒
                  </span>{" "}
                  y activa los permisos de cámara/micrófono.
                </li>
                <li>
                  <strong>A la derecha (dentro de la barra):</strong> Si ves un
                  ícono de cámara o micrófono con una cruz roja{" "}
                  <span className="text-red-400 font-bold">📹❌</span>, haz clic
                  en él y selecciona "Permitir siempre".
                </li>
              </ul>
            </li>
            <li>
              Una vez que los cambies a{" "}
              <span className="text-green-400 font-semibold">Permitir</span>,
              haz clic en{" "}
              <span className="font-semibold text-white">
                Volver a intentar
              </span>{" "}
              abajo.
            </li>
          </ol>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            ref={closeRef}
            onClick={onClose}
            className="w-full sm:order-1 py-2.5 px-4 bg-gray-800 hover:bg-gray-700 active:bg-gray-950 text-gray-300 font-semibold rounded-xl transition-all border border-gray-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none"
          >
            Cerrar
          </button>
          <button
            ref={retryRef}
            onClick={onRetry}
            className="w-full sm:order-2 py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-gray-950 font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.25)] flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18v3z"
              />
            </svg>
            Volver a intentar
          </button>
        </div>
      </div>
    </div>
  );
}

export default RoomPage;
