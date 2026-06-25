import { useEffect, useMemo, useRef, useState } from 'react';
import { Monitor } from 'lucide-react';

interface Props {
    name: string;
    speaking: boolean;
    stream?: MediaStream | null;
    isLocal?: boolean;
    camOn?: boolean;
    isScreenShare?: boolean;
    className?: string;
}

export function ParticipantCard({ name, speaking, stream, isLocal = false, camOn, isScreenShare = false, className = '' }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isVideoActive, setIsVideoActive] = useState(false);

    const initials = useMemo(
        () =>
            name
                .split(' ')
                .map(n => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase(),
        [name]
    );

    // Efecto para asignar el stream al elemento de video y forzar play()
    // Incluye camOn como dependencia para re-ejecutar play() cuando el estado de media cambia
    // (ej. replaceTrack por screen share no cambia la referencia del stream remoto)
    useEffect(() => {
        const videoEl = videoRef.current;

        if (!videoEl || !stream) {
            setIsVideoActive(false);
            if (videoEl) videoEl.srcObject = null;
            return;
        }

        // Solo reasignar srcObject si el stream cambió
        if (videoEl.srcObject !== stream) {
            videoEl.srcObject = stream;
        }

        videoEl.play().catch(err => {
            console.log("Auto-play prevenido o pausado:", err);
        });

        return () => {
            // No nullificar srcObject aquí para evitar flicker al cambiar camOn
        };
    }, [stream, camOn]);

    // Efecto separado para manejar la visibilidad del video basada en camOn y estado del track
    useEffect(() => {
        const videoEl = videoRef.current;
        if (!videoEl || !stream) {
            setIsVideoActive(false);
            return;
        }

        const videoTrack = stream.getVideoTracks()[0];

        const updateVideoActive = () => {
            // Si camOn se pasó explícitamente, usarlo como indicador principal
            if (camOn !== undefined) {
                setIsVideoActive(camOn);
                // Forzar play() cuando camOn se activa (ej. screen share remoto)
                // Esto cubre el caso donde replaceTrack envía nuevos frames
                // pero el video element estaba pausado por falta de contenido previo
                if (camOn && videoEl.paused) {
                    videoEl.play().catch(() => {});
                }
                return;
            }
            // Para local: confiar en el estado del track
            if (isLocal && videoTrack && videoTrack.enabled) {
                setIsVideoActive(true);
                return;
            }
            // Para remoto sin camOn explícito: basarse en el track
            setIsVideoActive(
                !!videoTrack &&
                videoTrack.enabled &&
                videoTrack.readyState !== 'ended'
            );
        };

        // Evaluar inmediatamente
        updateVideoActive();

        // Escuchar cambios en el track de video
        const onUnmute = () => {
            console.log("Track unmuted, reattaching stream to force frame render");
            // Forzar re-attach del stream para solucionar bugs de pantalla negra (especialmente pestañas de Chrome)
            if (videoEl) {
                const currentStream = videoEl.srcObject;
                videoEl.srcObject = null;
                videoEl.srcObject = currentStream;
                videoEl.play().catch(() => {});
            }
            updateVideoActive();
        };

        if (videoTrack) {
            videoTrack.addEventListener('mute', updateVideoActive);
            videoTrack.addEventListener('unmute', onUnmute);
            videoTrack.addEventListener('ended', updateVideoActive);
        }

        // También escuchar cuando el video empiece a reproducir frames reales
        const onPlaying = () => updateVideoActive();
        videoEl.addEventListener('playing', onPlaying);

        return () => {
            if (videoTrack) {
                videoTrack.removeEventListener('mute', updateVideoActive);
                videoTrack.removeEventListener('unmute', onUnmute);
                videoTrack.removeEventListener('ended', updateVideoActive);
            }
            videoEl.removeEventListener('playing', onPlaying);
        };
    }, [stream, isLocal, camOn]);

    // Etiqueta del nombre
    const displayName = isScreenShare ? `🖥️ Pantalla de ${name}` : name;

    return (

        <div className={`relative rounded-2xl overflow-hidden w-full h-full flex items-center justify-center transition-all duration-300
            ${isScreenShare
                ? 'bg-gradient-to-br from-gray-950 to-gray-900 ring-1 ring-cyan-500/30'
                : speaking
                    ? 'bg-gradient-to-br from-blue-950 to-blue-900 ring-2 ring-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)]'
                    : 'bg-gradient-to-br from-gray-900 to-gray-800'
            } ${className}`}>

            {!isVideoActive && (
                <div
                    className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage:
                            'linear-gradient(rgba(34,211,238,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.5) 1px, transparent 1px)',
                        backgroundSize: '30px 30px',
                    }}
                />
            )}

            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isLocal || isScreenShare}
                className={`absolute inset-0 w-full h-full ${isScreenShare ? 'object-contain' : 'object-cover'} z-0 transition-opacity duration-300 ${isVideoActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
            />

            {!isVideoActive && (
                <div
                    className={`relative z-10 flex flex-col items-center justify-center gap-2 transition-all
                        ${isScreenShare
                            ? 'text-gray-500'
                            : speaking
                                ? 'text-white'
                                : 'text-gray-300'
                        }`}
                >
                    {isScreenShare ? (
                        <Monitor className="w-10 h-10 sm:w-12 sm:h-12 text-gray-600" />
                    ) : (
                        <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-lg sm:text-xl font-bold
                            ${speaking
                                ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(34,211,238,0.6)]'
                                : 'bg-gray-700 text-gray-300'
                            }`}
                        >
                            {initials}
                        </div>
                    )}
                </div>
            )}

            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10 bg-gray-950/40 backdrop-blur-sm p-1.5 px-2.5 rounded-xl">
                <span className="text-white text-xs sm:text-sm font-medium truncate drop-shadow">
                    {displayName}
                </span>
                {speaking && !isScreenShare && (
                    <span className="flex gap-0.5 items-end h-4 ml-2 shrink-0">
                        {[1, 2, 3].map(i => (
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