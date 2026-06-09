import { useEffect, useMemo, useRef, useState } from 'react';

interface Props {
    name: string;
    speaking: boolean;
    stream?: MediaStream | null;
    isLocal?: boolean;
}

export function ParticipantCard({ name, speaking, stream, isLocal = false }: Props) {
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
            // Si es remoto, pasa por la validación estándar de estado de pista.
            if (isLocal && videoTrack && videoTrack.enabled) {
                setIsVideoActive(true);
                return;
            }

            setIsVideoActive(
                !!videoTrack &&
                videoTrack.enabled &&
                videoTrack.readyState !== 'ended'
            );
        };

        // Forzar la reproducción del elemento nativo
        videoEl.play()
            .then(() => {
                // Evaluamos el estado justo después de que el video asegura su reproducción
                updateVideoActive();
            })
            .catch(err => {
                console.log("Auto-play prevenido o pausado:", err);
                updateVideoActive();
            });

        if (videoTrack) {
            videoTrack.addEventListener('mute', updateVideoActive);
            videoTrack.addEventListener('unmute', updateVideoActive);
            videoTrack.addEventListener('ended', updateVideoActive);
        }

        return () => {
            if (videoTrack) {
                videoTrack.removeEventListener('mute', updateVideoActive);
                videoTrack.removeEventListener('unmute', updateVideoActive);
                videoTrack.removeEventListener('ended', updateVideoActive);
            }
            videoEl.srcObject = null;
        };
    }, [stream, isLocal]);

    return (
        <div
            className={`relative rounded-2xl overflow-hidden w-full h-full flex items-center justify-center transition-all duration-300
        ${speaking
                    ? 'bg-gradient-to-br from-blue-950 to-blue-900 ring-2 ring-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)]'
                    : 'bg-gradient-to-br from-gray-900 to-gray-800'
                }`}
        >
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

            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isLocal}
                className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300 ${isVideoActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
            />

            {!isVideoActive && (
                <div
                    className={`relative z-10 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-lg sm:text-xl font-bold transition-all
            ${speaking
                            ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(34,211,238,0.6)]'
                            : 'bg-gray-700 text-gray-300'
                        }`}
                >
                    {initials}
                </div>
            )}

            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10 bg-gray-950/40 backdrop-blur-sm p-1.5 px-2.5 rounded-xl">
                <span className="text-white text-xs sm:text-sm font-medium truncate drop-shadow">
                    {name}
                </span>
                {speaking && (
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