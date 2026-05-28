import { useState } from 'react'
import { Plus, Hash, LogOut, User, Video, Loader2 } from 'lucide-react'
import useAuthStore from '../stores/useAuthStore'
import { RoomCard } from '../features/dashboard/RoomCard'
import { useRooms } from '../hooks/useRooms'


function Dashboard() {
    const { userLogged, logout } = useAuthStore()
    const firstName = userLogged?.displayName?.split(' ')[0] ?? 'Estudiante'
    const username = userLogged?.email?.split('@')[0] ?? ''

    const { rooms, loading, addRoom, removeRoom } = useRooms(userLogged?.uid ?? '')

    const [showCreate, setShowCreate] = useState(false)
    const [showJoin, setShowJoin] = useState(false)
    const [roomName, setRoomName] = useState('')
    const [joinId, setJoinId] = useState('')
    const [saving, setSaving] = useState(false)

    const handleCreate = async () => {
        if (!roomName.trim()) return
        setSaving(true)
        await addRoom(roomName.trim())
        setRoomName('')
        setShowCreate(false)
        setSaving(false)
    }

    const handleJoin = () => {
        if (!joinId.trim()) return
        window.location.href = `/room/${joinId.trim().toUpperCase()}`
    }

    return (
        <div className="min-h-screen bg-[#f0f4f8]">
            {/* Navbar */}
            <nav className="bg-white shadow-sm px-8 py-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-700 text-white rounded p-1.5"><Video className="h-5 w-5" /></div>
                    <span className="text-xl font-bold text-gray-800">StudyRoom</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-gray-100 rounded-full p-2"><User className="h-5 w-5 text-gray-500" /></div>
                    <div className="text-sm">
                        <p className="font-semibold text-gray-800">{userLogged?.displayName}</p>
                        <p className="text-gray-400">@{username}</p>
                    </div>
                    <button onClick={logout} aria-label="Cerrar sesión" className="ml-2 text-gray-400 hover:text-red-500 transition-colors">
                        <LogOut className="h-5 w-5" />
                    </button>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto px-8 py-10">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Bienvenido, {firstName}</h1>
                    <p className="text-gray-500 mt-1">Gestiona tus salas de estudio o únete a nuevas sesiones</p>
                </div>

                {/* Botones acción */}
                <div className="grid grid-cols-2 gap-4 mb-10">
                    <button
                        onClick={() => { setShowCreate(true); setShowJoin(false) }}
                        className="flex items-center justify-center gap-2 bg-blue-800 hover:bg-blue-900 text-white py-4 rounded-lg font-semibold text-lg transition-colors"
                    >
                        <Plus className="h-5 w-5" />Crear Nueva Sala
                    </button>
                    <button
                        onClick={() => { setShowJoin(true); setShowCreate(false) }}
                        className="flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-lg font-semibold text-lg transition-colors"
                    >
                        <Hash className="h-5 w-5" />Unirse con ID
                    </button>
                </div>

                {/* Modal crear sala */}
                {showCreate && (
                    <div className="bg-white rounded-xl p-6 shadow-sm mb-6 flex gap-3 items-center">
                        <input
                            autoFocus
                            value={roomName}
                            onChange={e => setRoomName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                            placeholder="Nombre de la sala..."
                            className="flex-1 border border-gray-200 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                        />
                        <button
                            onClick={handleCreate}
                            disabled={saving}
                            className="bg-blue-800 hover:bg-blue-900 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            Crear
                        </button>
                        <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-sm">
                            Cancelar
                        </button>
                    </div>
                )}

                {/* Modal unirse */}
                {showJoin && (
                    <div className="bg-white rounded-xl p-6 shadow-sm mb-6 flex gap-3 items-center">
                        <input
                            autoFocus
                            value={joinId}
                            onChange={e => setJoinId(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleJoin()}
                            placeholder="ID de la sala (ej: ABC123)..."
                            className="flex-1 border border-gray-200 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-teal-400 text-sm font-mono uppercase"
                        />
                        <button
                            onClick={handleJoin}
                            className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg text-sm font-medium"
                        >
                            Unirse
                        </button>
                        <button onClick={() => setShowJoin(false)} className="text-gray-400 hover:text-gray-600 text-sm">
                            Cancelar
                        </button>
                    </div>
                )}

                {/* Lista salas */}
                <h2 className="text-xl font-bold text-gray-800 mb-4">Mis Salas</h2>

                {loading ? (
                    <div className="flex items-center gap-2 text-gray-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Cargando salas...</span>
                    </div>
                ) : rooms.length === 0 ? (
                    <p className="text-gray-400">No tienes salas aún. ¡Crea una!</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {rooms.map(room => (
                            <RoomCard key={room.id} room={room} onDelete={removeRoom} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}

export default Dashboard