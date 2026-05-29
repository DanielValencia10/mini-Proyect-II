import { useNavigate } from 'react-router-dom'
import { Hash, Users, Settings, Trash2 } from 'lucide-react'

interface Room {
    id: string
    name: string
    participants: number
    ownerId: string
}

interface Props {
    room: Room
    onDelete: (id: string) => void
}

export function RoomCard({ room, onDelete }: Props) {
    const navigate = useNavigate()

    return (
        <div className="bg-white rounded-xl p-6 shadow-sm flex flex-col justify-between">
            <div>
                <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-gray-800 text-lg leading-tight">{room.name}</h3>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium whitespace-nowrap ml-2">
                        Propietario
                    </span>
                </div>
                <div className="flex items-center gap-1 text-gray-500 text-sm mb-2">
                    <Hash className="h-4 w-4" /><span>ID: {room.id}</span>
                </div>
                <div className="flex items-center gap-1 text-gray-500 text-sm mb-5">
                    <Users className="h-4 w-4" /><span>{room.participants} participantes</span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={() => navigate(`/room/${room.id}`)}
                    className="flex-1 bg-blue-800 hover:bg-blue-900 text-white py-2 rounded-lg font-medium transition-colors"
                >
                    Entrar
                </button>
                <button
                    aria-label="Configurar sala"
                    className="p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg transition-colors"
                >
                    <Settings className="h-5 w-5" />
                </button>
                <button
                    onClick={() => onDelete(room.id)}
                    aria-label="Eliminar sala"
                    className="p-2 text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg transition-colors"
                >
                    <Trash2 className="h-5 w-5" />
                </button>
            </div>
        </div>
    )
}