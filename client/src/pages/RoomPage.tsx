import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Hash, Users, Video } from "lucide-react";
import useAuthStore from "../stores/useAuthStore";
import { getRoomMessages } from "../services/roomService";
import { useRoom } from "../hooks/useRoom";
import { useSocket } from "../hooks/useSocket";
import { useWebRTC } from "../hooks/useWebRTC";
import { ParticipantCard } from "../features/room/ParticipantCard";
import { ChatPanel } from "../features/room/ChatPanel";
import { RoomControls } from "../features/room/RoomControls";

interface Message {
  id: number;
  author: string;
  text: string;
}

// ─── Utilidad para grid de video ─────────────────────────────────────────────
function getGridClass(count: number): string {
  if (count === 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 sm:grid-cols-2";
  return "grid-cols-2 lg:grid-cols-3";
}

// ─── Subcomponente para las diferentes distribuciones de video ─────────────
interface VideoGridProps {
  remotePeers: ReturnType<typeof useSocket>["participants"];
  remoteStreams: ReturnType<typeof useWebRTC>["remoteStreams"];
  localStream: MediaStream | null;
  camOn: boolean;
  totalPersonas: number;
}

function VideoGrid({
  remotePeers,
  remoteStreams,
  localStream,
  camOn,
  totalPersonas,
}: VideoGridProps) {
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
      />
    );
  };

  const renderRemoteCard = (peer: (typeof remotePeers)[number]) => (
    <ParticipantCard
      key={peer.id}
      name={peer.name}
      speaking={peer.speaking}
      stream={remoteStreams.find((s) => s.userId === peer.id)?.stream ?? null}
      camOn={peer.camOn}
      isLocal={false}
    />
  );

  // Caso 1: cargando
  if (remotePeers.length === 0 && !localStream) {
    return (
      <p className="text-gray-500 animate-pulse">
        Iniciando medios y buscando peers...
      </p>
    );
  }

  // Caso 2: only me
  if (remotePeers.length === 0 && localStream) {
    return (
      <div className="w-full h-full max-w-5xl aspect-video">
        {renderLocalCard()}
      </div>
    );
  }

  // Caso 3: 1 user → pantalla completa + PiP
  if (remotePeers.length === 1) {
    const peer = remotePeers[0];
    return (
      <div className="w-full h-full relative flex items-center justify-center">
        <div className="w-full h-full max-w-5xl aspect-video">
          {renderRemoteCard(peer)}
        </div>
        <div className="absolute bottom-4 right-4 w-32 h-20 sm:w-48 sm:h-32 shadow-2xl rounded-2xl overflow-hidden border border-gray-700/60 z-10 transition-all hover:scale-105">
          {renderLocalCard("w-full h-full")}
        </div>
      </div>
    );
  }

  // Caso 4: ≥ 2 users → grid
  return (
    <div
      className={`grid ${getGridClass(totalPersonas)} gap-4 w-full h-full max-w-6xl items-center justify-center`}
    >
      {renderLocalCard()}
      {remotePeers.map(renderRemoteCard)}
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
  >("both");

  const localStreamRef = useRef<MediaStream | null>(null);

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

  const { setMicOn, setCamOn } = room;

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
    };
  }, [initDevices, stopLocalStream]);

  const { remoteStreams, joinCall, leaveCall } = useWebRTC(
    id ?? "",
    localStream,
    socket,
    currentUserId,
  );

  // ── Reiniciar WebRTC si cambia el stream (ej. se recuperan permisos) ─
  useEffect(() => {
    if (devicesReady && localStream && socket) {
      console.log(
        "🔄 [RoomPage] localStream actualizado tras cambio de permisos. Reiniciando conexión WebRTC.",
      );
      leaveCall();
      joinCall();
    }
  }, [localStream, devicesReady, socket, leaveCall, joinCall]);

  // ── Memoización de derivados ───────────────────────────────────────────
  const remotePeers = useMemo(
    () => socketParticipants.filter((p) => p.id !== currentUserId),
    [socketParticipants, currentUserId],
  );

  const totalPersonas = useMemo(
    () => remotePeers.length + (localStream ? 1 : 0),
    [remotePeers, localStream],
  );

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
    navigate("/dashboard");
  }, [leaveCall, localStream, navigate]);

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

  const handleToggleCam = useCallback(() => {
    if (cameraPermission === "denied" || cameraPermission === "unavailable") {
      setModalPermissionType(
        micPermission === "denied" || micPermission === "unavailable"
          ? "both"
          : "camera",
      );
      setShowPermissionModal(true);
      return;
    }
    room.setCamOn((v) => !v);
  }, [cameraPermission, micPermission, room]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden select-none">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 bg-gray-900 border-b border-gray-800 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-500 text-gray-950 rounded p-1.5">
            <Video className="h-4 w-4" />
          </div>
          <span className="font-bold hidden sm:block">StudyRoom</span>
          <span className="text-gray-500 hidden sm:block">|</span>
          <div className="flex items-center gap-1 text-cyan-400 text-sm">
            <Hash className="h-4 w-4" />
            <span className="font-mono font-bold">{id}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Users className="h-4 w-4" />
          <span>{totalPersonas} participantes</span>
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
            className="ml-4 shrink-0 px-3 py-1 bg-red-800 hover:bg-red-700 active:bg-red-900 text-white font-medium rounded-lg transition-all shadow-sm"
          >
            Configurar
          </button>
        </div>
      )}

      {/* Área principal: video + chat */}
      <div className="flex flex-1 min-w-0 overflow-hidden min-h-0 relative">
        <main className="flex-1 min-w-0 p-4 overflow-hidden min-h-0 relative flex items-center justify-center">
          <div className="w-full h-full min-w-0 relative flex items-center justify-center">
            <VideoGrid
              remotePeers={remotePeers}
              remoteStreams={remoteStreams}
              localStream={localStream}
              camOn={room.camOn}
              totalPersonas={totalPersonas}
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
        onToggleMic={handleToggleMic}
        onToggleCam={handleToggleCam}
        onToggleChat={() => room.setChatOpen((v) => !v)}
        onLeave={handleLeaveRoom}
        micPermission={micPermission}
        camPermission={cameraPermission}
      />

      {/* Modal de Permisos */}
      <PermissionModal
        isOpen={showPermissionModal}
        type={modalPermissionType}
        onClose={() => setShowPermissionModal(false)}
        onRetry={initDevices}
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

function PermissionModal({
  isOpen,
  type,
  onClose,
  onRetry,
}: PermissionModalProps) {
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
            onClick={onClose}
            className="w-full sm:order-1 py-2.5 px-4 bg-gray-800 hover:bg-gray-700 active:bg-gray-950 text-gray-300 font-semibold rounded-xl transition-all border border-gray-700/50"
          >
            Cerrar
          </button>
          <button
            onClick={onRetry}
            className="w-full sm:order-2 py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-gray-950 font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.25)] flex items-center justify-center gap-2"
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
