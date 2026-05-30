import { Mic, MicOff, Video, VideoOff, Monitor, MessageSquare, PhoneOff } from 'lucide-react'

interface Props {
    micOn: boolean
    camOn: boolean
    chatOpen: boolean
    onToggleMic: () => void
    onToggleCam: () => void
    onToggleChat: () => void
    onLeave: () => void
}

export function RoomControls({ micOn, camOn, chatOpen, onToggleMic, onToggleCam, onToggleChat, onLeave }: Props) {
    const base = 'p-2.5 sm:p-3 rounded-full transition-all'

    return (
        <footer className="shrink-0 bg-gray-900 border-t border-gray-800 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-center gap-3 sm:gap-4">
            <button onClick={onToggleMic} className={`${base} ${micOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`}>
                {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>

            <button onClick={onToggleCam} className={`${base} ${camOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`}>
                {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>

            <button className={`${base} bg-gray-700 hover:bg-gray-600`}>
                <Monitor className="h-5 w-5" />
            </button>

            <button onClick={onToggleChat} className={`${base} ${chatOpen ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-gray-700 hover:bg-gray-600'}`}>
                <MessageSquare className="h-5 w-5" />
            </button>

            <button onClick={onLeave} className={`${base} bg-red-600 hover:bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]`}>
                <PhoneOff className="h-5 w-5" />
            </button>
        </footer>
    )
}