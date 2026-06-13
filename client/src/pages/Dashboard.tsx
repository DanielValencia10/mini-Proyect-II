import { useState, useEffect } from 'react'
import { Plus, Hash, LogOut, User, Video, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../stores/useAuthStore'
import { getUser } from '../services/userService'
import { RoomCard } from '../features/dashboard/RoomCard'
import { useRooms } from '../hooks/useRooms'
import ConfirmDialog from '../components/ConfirmDialog'
import Skeleton from '../components/Skeleton'
import Toast from '../components/Toast'
import { getRoomById } from '../services/roomService'


function Dashboard() {
    const navigate = useNavigate()
    const { userLogged, logout } = useAuthStore()
    const firstName = userLogged?.displayName?.split(' ')[0] ?? 'Estudiante'
    const username = userLogged?.email?.split('@')[0] ?? ''
    const [avatar, setAvatar] = useState<string | null>(null)
    const [realUsername, setRealUsername] = useState('')
    const { rooms, loading, addRoom, removeRoom } = useRooms(userLogged?.uid ?? '')

    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
    const [welcomeToast, setWelcomeToast] = useState('')
    const [joining, setJoining] = useState(false)
    const [joinError, setJoinError] = useState('')

    useEffect(() => {
        const loadUserData = async () => {
            if (!userLogged) return
            try {
                const token = await userLogged.getIdToken()
                const result = await getUser(userLogged.uid, token)
                if (result.success && result.data) {
                    if (result.data.avatar) setAvatar(result.data.avatar)
                    if (result.data.username) setRealUsername(result.data.username)
                }
            } catch (err) {
                console.error('Error cargando datos del usuario:', err)
            }
        }
        loadUserData()
    }, [userLogged])

    useEffect(() => {
        const name = sessionStorage.getItem('sr_welcome')
        if (name) {
            setWelcomeToast(`¡Cuenta creada con éxito! Bienvenido, ${name}`)
            sessionStorage.removeItem('sr_welcome')
        }
    }, [])
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

    const handleJoin = async () => {
        if (!joinId.trim()) return
        setJoining(true)
        setJoinError('')

        const roomId = joinId.trim().toUpperCase()
        const result = await getRoomById(roomId)

        setJoining(false)

        if (!result.success || !result.data) {
            setJoinError('No existe ninguna sala con ese ID')
            return
        }

        navigate(`/room/${roomId}`)
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
                    <button
                        onClick={() => navigate('/profile')}
                        className="bg-gray-100 rounded-full p-2 hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                        aria-label="Editar perfil"
                    >
                        <Settings className="h-5 w-5 text-gray-500" />
                    </button>
                    <button
                        onClick={() => navigate('/profile')}
                        className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-2 py-1"
                        aria-label="Ver perfil"
                    >
                        <div className="bg-gray-100 rounded-full p-1 flex-shrink-0 w-10 h-10 flex items-center justify-center overflow-hidden">
                            {avatar ? (
                                <img
                                    src={avatar}
                                    alt="Avatar"
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover rounded-full"
                                />
                            ) : (
                                <User className="h-5 w-5 text-gray-500" />
                            )}
                        </div>
                        <div className="text-sm min-w-0">
                            <p className="font-semibold text-gray-800 truncate">{userLogged?.displayName}</p>
                            <p className="text-gray-400 truncate">@{realUsername}</p>
                        </div>
                    </button>
                    <button onClick={() => setShowLogoutConfirm(true)} aria-label="Cerrar sesión" className="ml-2 text-gray-400 hover:text-red-500 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 rounded">
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
                            {saving && <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />}
                            Crear
                        </button>
                        <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-sm">
                            Cancelar
                        </button>
                    </div>
                )}

                {/* Modal unirse */}
                {showJoin && (
                    <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
                        <div className="flex gap-3 items-center">
                            <input
                                value={joinId}
                                onChange={e => { setJoinId(e.target.value); setJoinError('') }}
                                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                                placeholder="ID de la sala (ej: ABC123)..."
                                className="flex-1 border border-gray-200 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-teal-400 text-sm font-mono uppercase"
                            />
                            <button
                                onClick={handleJoin}
                                disabled={joining}
                                className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                            >
                                {joining && <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />}
                                Unirse
                            </button>
                            <button onClick={() => { setShowJoin(false); setJoinError('') }} className="text-gray-400 hover:text-gray-600 text-sm">
                                Cancelar
                            </button>
                        </div>
                        {joinError && (
                            <p role="alert" className="mt-2 text-sm text-red-500">{joinError}</p>
                        )}
                    </div>
                )}
                {/* Lista salas */}
                <h2 className="text-xl font-bold text-gray-800 mb-4">Mis Salas</h2>

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" aria-busy="true" aria-label="Cargando salas">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white rounded-xl p-6 shadow-sm space-y-3">
                                <Skeleton className="h-5 w-2/3" />
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-8 w-full mt-4" />
                            </div>
                        ))}
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

            {welcomeToast && (
                <Toast message={welcomeToast} onDismiss={() => setWelcomeToast('')} />
            )}

            <ConfirmDialog
                open={showLogoutConfirm}
                title="¿Cerrar sesión?"
                message="Tu sesión se cerrará y serás redirigido al inicio."
                confirmLabel="Cerrar sesión"
                cancelLabel="Cancelar"
                onConfirm={logout}
                onCancel={() => setShowLogoutConfirm(false)}
            />
        </div>
    )
}

export default Dashboard