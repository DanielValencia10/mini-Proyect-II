import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Video, Users, MessageSquare, Monitor } from 'lucide-react'
import useAuthStore from '../stores/useAuthStore'

const features = [
    {
        icon: <Video className="h-7 w-7 text-blue-600" />,
        title: 'Video en Tiempo Real',
        desc: 'Transmisión de audio y video con WebRTC de baja latencia para sesiones fluidas.',
    },
    {
        icon: <Users className="h-7 w-7 text-blue-600" />,
        title: 'Salas de Estudio',
        desc: 'Crea y gestiona tus propias salas o únete a sesiones existentes con un ID único.',
    },
    {
        icon: <MessageSquare className="h-7 w-7 text-blue-600" />,
        title: 'Chat Persistente',
        desc: 'Mensajería instantánea con historial guardado para no perder el contexto.',
    },
    {
        icon: <Monitor className="h-7 w-7 text-blue-600" />,
        title: 'Compartir Pantalla',
        desc: 'Comparte tu pantalla para presentaciones y colaboración visual efectiva.',
    },
]

function LandingPage() {
    const { userLogged, loginWithGoogle } = useAuthStore()
    const navigate = useNavigate()

    useEffect(() => {
        if (userLogged) navigate('/dashboard')
    }, [userLogged, navigate])

    return (
        <div className="min-h-screen bg-[#f0f4f8]">
            {/* Navbar */}
            <nav className="bg-white shadow px-8 py-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-600 text-white rounded p-1.5">
                        <Video className="h-5 w-5" />
                    </div>
                    <span className="text-xl font-bold text-gray-800">StudyRoom</span>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={loginWithGoogle}
                        className="px-5 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
                    >
                        Iniciar Sesión
                    </button>
                    <button
                        onClick={loginWithGoogle}
                        className="px-5 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 text-sm font-medium transition-colors"
                    >
                        Registrarse
                    </button>
                </div>
            </nav>

            {/* Hero */}
            <section className="flex flex-col items-center justify-center text-center py-24 px-6">
                <h1 className="text-5xl font-bold text-gray-900 mb-4">
                    Plataforma de Videoconferencia Educativa
                </h1>
                <p className="text-lg text-gray-500 max-w-xl mb-8">
                    Conecta con estudiantes, crea salas de estudio virtuales y colabora en
                    tiempo real con audio, video y chat integrado.
                </p>
                <button
                    onClick={loginWithGoogle}
                    className="px-8 py-3 bg-blue-800 text-white rounded-lg text-lg font-semibold hover:bg-blue-900 transition-colors"
                >
                    Comenzar Ahora
                </button>
            </section>

            {/* Feature cards */}
            <section className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-8 pb-24">
                {features.map((f) => (
                    <div key={f.title} className="bg-white rounded-xl p-6 shadow-sm">
                        <div className="mb-3">{f.icon}</div>
                        <h3 className="font-semibold text-gray-800 mb-2">{f.title}</h3>
                        <p className="text-gray-500 text-sm">{f.desc}</p>
                    </div>
                ))}
            </section>
        </div>
    )
}

export default LandingPage