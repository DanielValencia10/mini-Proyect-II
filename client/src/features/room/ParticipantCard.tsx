import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, VideoOff } from "lucide-react";

const AVATAR_COLORS = [
  "bg-blue-700",
  "bg-purple-700",
  "bg-rose-700",
  "bg-amber-700",
  "bg-green-700",
  "bg-cyan-700",
  "bg-pink-700",
  "bg-indigo-700",
];

function nameToColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

interface Props {
  name: string;
  speaking: boolean;
  stream?: MediaStream | null;
  isLocal?: boolean;
  camOn?: boolean;
  className?: string;
  micOn?: boolean;
  avatar?: string;
}

export function ParticipantCard({
  name,
  speaking,
  stream,
  isLocal = false,
  camOn,
  className = "",
  micOn,
  avatar,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoActive, setIsVideoActive] = useState(false);

  const initials = useMemo(
    () =>
      name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [name],
  );

  useEffect(() => {
    const videoEl = videoRef.current;

    if (!videoEl || !stream) {
      setIsVideoActive(false);
      if (videoEl) videoEl.srcObject = null;
      return;
    }

    videoEl.srcObject = stream;
    const videoTrack = stream.getVideoTracks()[0];

    const updateVideoActive = () => {
      if (camOn !== undefined) {
        setIsVideoActive(camOn);
        return;
      }
      if (isLocal && videoTrack && videoTrack.enabled) {
        setIsVideoActive(true);
        return;
      }
      setIsVideoActive(
        !!videoTrack && videoTrack.enabled && videoTrack.readyState !== "ended",
      );
    };

    // Forzar la reproducción del elemento nativo
    videoEl
      .play()
      .then(() => {
        // Evaluamos el estado justo después de que el video asegura su reproducción
        updateVideoActive();
      })
      .catch((err) => {
        console.log("Auto-play prevenido o pausado:", err);
        updateVideoActive();
      });

    if (videoTrack) {
      videoTrack.addEventListener("mute", updateVideoActive);
      videoTrack.addEventListener("unmute", updateVideoActive);
      videoTrack.addEventListener("ended", updateVideoActive);
    }

    return () => {
      if (videoTrack) {
        videoTrack.removeEventListener("mute", updateVideoActive);
        videoTrack.removeEventListener("unmute", updateVideoActive);
        videoTrack.removeEventListener("ended", updateVideoActive);
      }
      videoEl.srcObject = null;
    };
  }, [stream, isLocal, camOn]);

  // El estado del micrófono se asume "activado" si no se especifica (mismo
  // criterio que ya usabas para isVideoActive cuando camOn es undefined),
  // para no afectar a cards que todavía no pasan esta prop.
  const isMicOn = micOn ?? true;
  const isCamOn = camOn ?? true;

  return (
    <div
      className={`relative rounded-2xl overflow-hidden w-full h-full flex items-center justify-center transition-all duration-300
            ${
              speaking
                ? "bg-gradient-to-br from-blue-950 to-blue-900 ring-2 ring-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)]"
                : "bg-gradient-to-br from-gray-900 to-gray-800"
            } ${className}`}
    >
      {!isVideoActive && (
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(34,211,238,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.5) 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        />
      )}

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300 ${
          isVideoActive ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {!isVideoActive && (
        avatar ? (
          <img
            src={avatar}
            alt={name}
            className={`relative z-10 w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full object-cover transition-all
              ${speaking ? "ring-2 ring-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.6)]" : ""}`}
          />
        ) : (
          <div
            className={`relative z-10 w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center text-sm sm:text-base md:text-lg font-bold transition-all
              ${
                speaking
                  ? "bg-cyan-500 text-white shadow-[0_0_15px_rgba(34,211,238,0.6)]"
                  : `${nameToColor(name)} text-white`
              }`}
          >
            {initials}
          </div>
        )
      )}

      {/* Indicadores de micrófono y cámara: aparecen en la esquina superior derecha */}
      <div className="absolute top-1 right-1 sm:top-2.5 sm:right-2.5 z-10 flex gap-1 sm:gap-2">
        <div
          className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-colors
                      ${isMicOn ? "bg-gray-950/40 backdrop-blur-sm" : "bg-red-600/90"}`}
          title={isMicOn ? "Micrófono activado" : "Micrófono silenciado"}
        >
          {isMicOn ? (
            <Mic className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
          ) : (
            <MicOff className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
          )}
        </div>
        {!isCamOn && (
          <div
            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center bg-red-600/90 transition-colors"
            title="Cámara apagada"
          >
            <VideoOff className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
          </div>
        )}
      </div>

      <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 flex items-center justify-between z-10 bg-gray-950/40 backdrop-blur-sm p-1 sm:p-1.5 px-1.5 sm:px-2.5 rounded-lg sm:rounded-xl">
        <span className="text-white text-[10px] sm:text-xs font-medium truncate drop-shadow flex items-center gap-1">
          {name}
          {!isMicOn && <MicOff className="w-2 h-2 sm:w-3 sm:h-3 text-red-400 shrink-0" />}
          {!isCamOn && <VideoOff className="w-2 h-2 sm:w-3 sm:h-3 text-red-400 shrink-0" />}
        </span>
        {speaking && (
          <span className="flex gap-0.5 items-end h-4 ml-2 shrink-0">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-1 bg-cyan-400 rounded-full animate-pulse"
                style={{ height: `${i * 30}%`, animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
