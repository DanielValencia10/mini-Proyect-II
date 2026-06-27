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
}: Props) {
  const base = "relative p-2.5 sm:p-3 rounded-full transition-all";

  const isMicBlocked =
    micPermission === "denied" || micPermission === "unavailable";
  const isCamBlocked =
    camPermission === "denied" || camPermission === "unavailable";

  return (
    <footer className="shrink-0 bg-gray-900 border-t border-gray-800 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-center gap-3 sm:gap-4">
      <button
        onClick={onToggleMic}
        className={`${base} ${
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
        {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        {isMicBlocked && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 border border-gray-900 shadow-md">
            <svg
              className="w-2.5 h-2.5"
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
        className={`${base} ${
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
          <Video className="h-5 w-5" />
        ) : (
          <VideoOff className="h-5 w-5" />
        )}
        {isCamBlocked && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 border border-gray-900 shadow-md">
            <svg
              className="w-2.5 h-2.5"
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
        onClick={onToggleScreenShare}
        className={`${base} ${
          screenSharing
            ? "bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.5)]"
            : "bg-gray-700 hover:bg-gray-600 text-white"
        }`}
        title={
          screenSharing ? "Dejar de compartir pantalla" : "Compartir pantalla"
        }
      >
        <Monitor className="h-5 w-5" />
      </button>

      <button
        onClick={onToggleChat}
        className={`${base} ${chatOpen ? "bg-cyan-600 hover:bg-cyan-500" : "bg-gray-700 hover:bg-gray-600 text-white"}`}
      >
        <MessageSquare className="h-5 w-5" />
      </button>

      <button
        onClick={onLeave}
        className={`${base} bg-red-600 hover:bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)] text-white`}
      >
        <PhoneOff className="h-5 w-5" />
      </button>
    </footer>
  );
}
