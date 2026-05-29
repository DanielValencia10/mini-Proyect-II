import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './stores/useAuthStore'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import UsernameSetupPage from './pages/UsernameSetupPage'
import Dashboard from './pages/Dashboard'
import RoomPage from './pages/RoomPage'

function LoadingScreen() {
  return (
    <main className="min-h-screen bg-neutral-100 flex items-center justify-center" role="main">
      <p className="text-neutral-600" aria-live="polite" aria-busy="true">Cargando...</p>
    </main>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { userLogged, loading, needsUsername } = useAuthStore()
  if (loading) return <LoadingScreen />
  if (!userLogged) return <Navigate to="/" replace />
  if (needsUsername) return <Navigate to="/setup-username" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { userLogged, loading, needsUsername } = useAuthStore()
  if (loading) return <LoadingScreen />
  if (userLogged && needsUsername) return <Navigate to="/setup-username" replace />
  if (userLogged) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function UsernameRoute({ children }: { children: React.ReactNode }) {
  const { userLogged, loading, needsUsername } = useAuthStore()
  if (loading) return <LoadingScreen />
  if (!userLogged) return <Navigate to="/" replace />
  if (!needsUsername) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/setup-username" element={<UsernameRoute><UsernameSetupPage /></UsernameRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/room/:id" element={<ProtectedRoute><RoomPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
