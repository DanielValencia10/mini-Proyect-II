import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, VideoOff } from "lucide-react";

interface Props {
  name: string;
  speaking: boolean;
  stream?: MediaStream | null;
  isLocal?: boolean;
  camOn?: boolean;
  className?: string;
  micOn?: boolean;
}

export function ParticipantCard({
  name,
  speaking,
  stream,
  isLocal = false,
  camOn,
  className = "",
  micOn,
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
        <div
          className={`relative z-10 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-lg sm:text-xl font-bold transition-all
            ${
              speaking
                ? "bg-cyan-500 text-white shadow-[0_0_15px_rgba(34,211,238,0.6)]"
                : "bg-gray-700 text-gray-300"
            }`}
        >
          {initials}
        </div>
      )}

      {/* Indicadores de micrófono y cámara: aparecen en la esquina superior derecha */}
      <div className="absolute top-2.5 right-2.5 z-10 flex gap-2">
        <div
          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-colors
                      ${isMicOn ? "bg-gray-950/40 backdrop-blur-sm" : "bg-red-600/90"}`}
          title={isMicOn ? "Micrófono activado" : "Micrófono silenciado"}
        >
          {isMicOn ? (
            <Mic className="w-3.5 h-3.5 text-white" />
          ) : (
            <MicOff className="w-3.5 h-3.5 text-white" />
          )}
        </div>
        {!isCamOn && (
          <div
            className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center bg-red-600/90 transition-colors"
            title="Cámara apagada"
          >
            <VideoOff className="w-3.5 h-3.5 text-white" />
          </div>
        )}
      </div>

      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10 bg-gray-950/40 backdrop-blur-sm p-1.5 px-2.5 rounded-xl">
        <span className="text-white text-xs sm:text-sm font-medium truncate drop-shadow flex items-center gap-1.5">
          {name}
          {!isMicOn && <MicOff className="w-3 h-3 text-red-400 shrink-0" />}
          {!isCamOn && <VideoOff className="w-3 h-3 text-red-400 shrink-0" />}
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
