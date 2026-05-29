import { useNavigate } from 'react-router-dom'
import { Video } from 'lucide-react'

interface Props {
  showLogin?: boolean
  showRegister?: boolean
  rightSlot?: React.ReactNode
}

function AuthHeader({ showLogin, showRegister, rightSlot }: Props) {
  const navigate = useNavigate()

  return (
    <nav className="bg-white shadow px-8 py-4 flex justify-between items-center">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
        aria-label="StudyRoom - Ir al inicio"
      >
        <div className="bg-blue-600 text-white rounded p-1.5">
          <Video className="h-5 w-5" aria-hidden="true" />
        </div>
        <span className="text-xl font-bold text-gray-800">StudyRoom</span>
      </button>

      <div className="flex gap-3">
        {showLogin && (
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="px-5 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            Iniciar Sesión
          </button>
        )}
        {showRegister && (
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="px-5 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            Registrarse
          </button>
        )}
        {rightSlot}
      </div>
    </nav>
  )
}

export default AuthHeader
