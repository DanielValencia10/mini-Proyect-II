import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Hash, Users, Video } from 'lucide-react';
import useAuthStore from '../stores/useAuthStore';
import { useRoom } from '../hooks/useRoom';
import { useSocket } from '../hooks/useSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { ParticipantCard } from '../features/room/ParticipantCard';
import { ChatPanel } from '../features/room/ChatPanel';
import { RoomControls } from '../features/room/RoomControls';
import { getRoomMessages } from '../services/roomService'
interface Message {
    id: number;
    author: string;
    text: string;
}

interface FirestoreMessage {
    author?: string
    text?: string
}

// ─── Utilidad para grid de video ─────────────────────────────────────────────
function getGridClass(count: number): string {
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-1 sm:grid-cols-2';
    return 'grid-cols-2 lg:grid-cols-3';
}

// ─── Subcomponente para las diferentes distribuciones de video ─────────────
interface VideoGridProps {
    remotePeers: ReturnType<typeof useSocket>['participants'];
    remoteStreams: ReturnType<typeof useWebRTC>['remoteStreams'];
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

    const renderRemoteCard = (peer: typeof remotePeers[number]) => (
        <ParticipantCard
            key={peer.id}
            name={peer.name}
            speaking={peer.speaking}
            stream={remoteStreams.find(s => s.userId === peer.id)?.stream ?? null}
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
    const room = useRoom()

    const { participants: socketParticipants, socket } = useSocket(id ?? '');
    const currentUserId = userLogged?.uid ?? '';

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [chatMessages, setChatMessages] = useState<Message[]>([]);

    const { remoteStreams, joinCall, leaveCall } = useWebRTC(
        id ?? '',
        localStream,
        socket,
        currentUserId
    );

    // ── Memoización de derivados ───────────────────────────────────────────
    const remotePeers = useMemo(
        () => socketParticipants.filter(p => p.id !== currentUserId),
        [socketParticipants, currentUserId]
    );

    const totalPersonas = useMemo(
        () => remotePeers.length + (localStream ? 1 : 0),
        [remotePeers, localStream]
    );

    // ── Efecto: captura de dispositivos locales ────────────────────────────
    useEffect(() => {
        let streamInstance: MediaStream | null = null;

        async function initDevices() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true,
                });

                stream.getAudioTracks().forEach(
                    t => (t.enabled = room.micOn)
                );

                stream.getVideoTracks().forEach(
                    t => (t.enabled = room.camOn)
                );

                setLocalStream(stream);
                streamInstance = stream;

            } catch (err) {
                console.error('Error accediendo a periféricos (video+audio):', err);

                // Fallback: intentar solo con audio (p.ej. cámara ya en uso por otra app/pestaña)
                try {
                    const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
                        video: false,
                        audio: true,
                    });

                    audioOnlyStream.getAudioTracks().forEach(
                        t => (t.enabled = room.micOn)
                    );

                    setLocalStream(audioOnlyStream);
                    streamInstance = audioOnlyStream;

                    console.warn('⚠️ Continuando sin video: solo se obtuvo audio.');
                } catch (audioErr) {
                    console.error('Error accediendo a periféricos (solo audio):', audioErr);
                    // Sin medios disponibles: el usuario entra en modo "solo recibir"
                    setLocalStream(null);
                }
            }
        }

        initDevices();

        return () => {
            streamInstance?.getTracks().forEach(track => track.stop());

            // NO llamar leaveCall aquí
            // leaveCall();
        };
    }, [id]);

    // ── Sincronización de pista de audio ───────────────────────────────────
    useEffect(() => {
        localStream?.getAudioTracks().forEach(t => (t.enabled = room.micOn));
    }, [room.micOn, localStream]);

    // ── Sincronización de pista de video y notificación al socket ────────
    useEffect(() => {
        if (!localStream) return;
        localStream.getVideoTracks().forEach(track => (track.enabled = room.camOn));

        if (socket && id) {
            socket.emit('update-media-state', {
                roomId: id,
                userId: currentUserId,
                camOn: room.camOn,
                micOn: room.micOn,
            });
        }
    }, [room.camOn, room.micOn, localStream, socket, id, currentUserId]);

    // ── Unirse a la llamada WebRTC ────────────────────────────────────────
    useEffect(() => {
        if (socket) {
            joinCall();
        }
    }, [socket, joinCall]);

    // ── Cargar historial de Firestore al entrar ───────────────────────
    useEffect(() => {
        if (!id) return
        getRoomMessages(id).then(result => {
            const data = (Array.isArray(result.data) ? result.data : Object.values(result.data ?? {})) as FirestoreMessage[]
            if (result.success && data.length > 0) {
                setChatMessages(data.map((m: FirestoreMessage, i: number) => ({
                    id: i + 1,
                    author: m.author ?? 'Anónimo',
                    text: m.text ?? '',
                })))
            }
        })
    }, [id])

    // ── Manejo del chat vía socket ────────────────────────────────────────
    useEffect(() => {
        if (!socket) return
        const handler = (msg: Message) =>
            setChatMessages(prev => [...prev, msg])
        socket.on('receive_message', handler)
        return () => {
            socket.off('receive_message', handler)
        }
    }, [socket])

    // ── Handlers memorizados ──────────────────────────────────────────────
    const handleSendMessage = useCallback(() => {
        const text = room.message.trim();
        if (!text || !socket) return;
        socket.emit('send_message', { roomId: id, message: text });
        room.setMessage('');
    }, [room, socket, id]);

    const handleLeaveRoom = useCallback(() => {
        leaveCall();
        localStream?.getTracks().forEach(track => track.stop());
        navigate('/dashboard');
    }, [leaveCall, localStream, navigate]);

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

            {/* Área principal: video + chat */}
            <div className="flex flex-1 overflow-hidden min-h-0 relative">
                <main className="flex-1 p-4 overflow-hidden min-h-0 relative flex items-center justify-center">
                    <div className="w-full h-full relative flex items-center justify-center">
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
                    />
                )}
            </div>

            {/* Controles inferiores */}
            <RoomControls
                micOn={room.micOn}
                camOn={room.camOn}
                chatOpen={room.chatOpen}
                onToggleMic={() => room.setMicOn(v => !v)}
                onToggleCam={() => room.setCamOn(v => !v)}
                onToggleChat={() => room.setChatOpen(v => !v)}
                onLeave={handleLeaveRoom}
            />
        </div>
    );
}

export default RoomPage;