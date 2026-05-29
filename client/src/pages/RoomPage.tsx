import { useParams, useNavigate } from 'react-router-dom'
import { Hash, Users, Video } from 'lucide-react'
import useAuthStore from '../stores/useAuthStore'
import { useRoom } from '../hooks/useRoom'
import { useSocket } from '../hooks/useSocket'
import { ParticipantCard } from '../features/room/ParticipantCard'
import { ChatPanel } from '../features/room/ChatPanel'
import { RoomControls } from '../features/room/RoomControls'

function getGridClass(count: number) {
    if (count === 1) return 'grid-cols-1'
    if (count === 2) return 'grid-cols-1 sm:grid-cols-2'
    if (count === 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
    if (count === 4) return 'grid-cols-2'
    if (count <= 6) return 'grid-cols-2 lg:grid-cols-3'
    return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
}

function RoomPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { userLogged } = useAuthStore()
    const room = useRoom(userLogged?.displayName ?? 'Anónimo')
    const { participants } = useSocket(id ?? '')

    return (
        <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
            <header className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 bg-gray-900 border-b border-gray-800">
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
                    <span>{participants.length} participantes</span>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden min-h-0">
                <main className="flex-1 p-3 sm:p-5 overflow-hidden min-h-0">
                    {participants.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-gray-500">Esperando participantes...</p>
                        </div>
                    ) : (
                        <div className={`grid ${getGridClass(participants.length)} gap-3 sm:gap-4 h-full`}>
                            {participants.map(p => (
                                <ParticipantCard key={p.id} name={p.name} speaking={p.speaking} />
                            ))}
                        </div>
                    )}
                </main>

                {room.chatOpen && (
                    <ChatPanel
                        messages={room.messages}
                        message={room.message}
                        onClose={() => room.setChatOpen(false)}
                        onChange={room.setMessage}
                        onSend={room.sendMessage}
                    />
                )}
            </div>

            <RoomControls
                micOn={room.micOn}
                camOn={room.camOn}
                chatOpen={room.chatOpen}
                onToggleMic={() => room.setMicOn(v => !v)}
                onToggleCam={() => room.setCamOn(v => !v)}
                onToggleChat={() => room.setChatOpen(v => !v)}
                onLeave={() => navigate('/dashboard')}
            />
        </div>
    )
}

export default RoomPage