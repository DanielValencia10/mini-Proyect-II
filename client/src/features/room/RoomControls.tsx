import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MessageSquare,
  PhoneOff,
} from "lucide-react";

interface Props {
  micOn: boolean;
  camOn: boolean;
  chatOpen: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleChat: () => void;
  onLeave: () => void;
  micPermission?: "granted" | "denied" | "unavailable" | "prompt";
  camPermission?: "granted" | "denied" | "unavailable" | "prompt";
  screenSharing?: boolean;
  onToggleScreenShare: () => void;
  canShareScreen?: boolean;
}

export function RoomControls({
  micOn,
  camOn,
  chatOpen,
  onToggleMic,
  onToggleCam,
  onToggleChat,
  onLeave,
  micPermission = "prompt",
  camPermission = "prompt",
  screenSharing = false,
  onToggleScreenShare,
  canShareScreen = true,
}: Props) {
  const base = "relative p-2 sm:p-2.5 md:p-3 rounded-full transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus:outline-none";

  const isMicBlocked =
    micPermission === "denied" || micPermission === "unavailable";
  const isCamBlocked =
    camPermission === "denied" || camPermission === "unavailable";

  return (
    <footer className="shrink-0 bg-gray-900 border-t border-gray-800 px-2 sm:px-6 py-2 sm:py-4 flex items-center justify-center gap-1.5 sm:gap-4">
      <button
        onClick={onToggleMic}
        aria-label={
          isMicBlocked
            ? "Micrófono bloqueado - Haz clic para ver cómo habilitarlo"
            : micOn
              ? "Desactivar micrófono"
              : "Activar micrófono"
        }
        aria-pressed={!isMicBlocked ? micOn : undefined}
        className={`${base} focus-visible:ring-cyan-400 ${
          isMicBlocked
            ? "bg-red-950/40 border border-red-500/40 text-red-400 hover:bg-red-900/40"
            : micOn
              ? "bg-gray-700 hover:bg-gray-600 text-white"
              : "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]"
        }`}
        title={
          isMicBlocked
            ? "Micrófono bloqueado - Haz clic para ver cómo habilitarlo"
            : micOn
              ? "Desactivar micrófono"
              : "Activar micrófono"
        }
      >
        {micOn ? <Mic className="h-4 w-4 sm:h-5 sm:w-5" /> : <MicOff className="h-4 w-4 sm:h-5 sm:w-5" />}
        {isMicBlocked && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 border border-gray-900 shadow-md">
            <svg
              className="w-2 h-2 sm:w-2.5 sm:h-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </span>
        )}
      </button>

      <button
        onClick={onToggleCam}
        aria-label={
          isCamBlocked
            ? "Cámara bloqueada - Haz clic para ver cómo habilitarla"
            : camOn
              ? "Desactivar cámara"
              : "Activar cámara"
        }
        aria-pressed={!isCamBlocked ? camOn : undefined}
        className={`${base} focus-visible:ring-cyan-400 ${
          isCamBlocked
            ? "bg-red-950/40 border border-red-500/40 text-red-400 hover:bg-red-900/40"
            : camOn
              ? "bg-gray-700 hover:bg-gray-600 text-white"
              : "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]"
        }`}
        title={
          isCamBlocked
            ? "Cámara bloqueada - Haz clic para ver cómo habilitarla"
            : camOn
              ? "Desactivar cámara"
              : "Activar cámara"
        }
      >
        {camOn ? (
          <Video className="h-4 w-4 sm:h-5 sm:w-5" />
        ) : (
          <VideoOff className="h-4 w-4 sm:h-5 sm:w-5" />
        )}
        {isCamBlocked && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 border border-gray-900 shadow-md">
            <svg
              className="w-2 h-2 sm:w-2.5 sm:h-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </span>
        )}
      </button>

      {canShareScreen && (
        <button
          onClick={onToggleScreenShare}
          aria-label={screenSharing ? "Dejar de compartir pantalla" : "Compartir pantalla"}
          aria-pressed={screenSharing}
          className={`${base} focus-visible:ring-cyan-400 ${
            screenSharing
              ? "bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.5)]"
              : "bg-gray-700 hover:bg-gray-600 text-white"
          }`}
          title={
            screenSharing ? "Dejar de compartir pantalla" : "Compartir pantalla"
          }
        >
          <Monitor className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
      )}

      <button
        onClick={onToggleChat}
        aria-label={chatOpen ? "Cerrar chat" : "Abrir chat"}
        aria-pressed={chatOpen}
        className={`${base} focus-visible:ring-cyan-400 ${chatOpen ? "bg-cyan-600 hover:bg-cyan-500" : "bg-gray-700 hover:bg-gray-600 text-white"}`}
      >
        <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>

      <button
        onClick={onLeave}
        aria-label="Salir de la sala"
        className={`${base} focus-visible:ring-red-400 bg-red-600 hover:bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)] text-white`}
      >
        <PhoneOff className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>
    </footer>
  );
}
