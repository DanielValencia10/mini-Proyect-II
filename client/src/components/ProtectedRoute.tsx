import { Navigate } from 'react-router-dom'
import useAuthStore from '../stores/useAuthStore'

interface Props {
    children: React.ReactNode
}

function ProtectedRoute({ children }: Props) {
    const { userLogged, loading } = useAuthStore()

    if (loading) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <p className="text-gray-500" aria-live="polite" aria-busy="true">
                    Cargando...
                </p>
            </main>
        )
    }

    if (!userLogged) {
        return <Navigate to="/" replace />
    }

    return <>{children}</>
}

export default ProtectedRoute