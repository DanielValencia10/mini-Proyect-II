import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import useAuthStore from './stores/useAuthStore'
import { getUser, createUser } from './services/userService'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import LandingPage from './pages/LandingPage'
import RoomPage from './pages/RoomPage'

function App() {
  const { userLogged } = useAuthStore()

  useEffect(() => {
    if (!userLogged) return

    const registerIfNew = async () => {
      const { success, data } = await getUser(userLogged.uid)
      if (success && data) return

      const [nombres, ...rest] = (userLogged.displayName ?? '').split(' ')
      await createUser({
        uid: userLogged.uid,
        email: userLogged.email ?? '',
        username: userLogged.email?.split('@')[0] ?? '',
        nombres: nombres ?? '',
        apellidos: rest.join(' '),
        avatar: userLogged.photoURL ?? undefined,
      })
    }

    registerIfNew()
  }, [userLogged])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />

        <Route path="/room/:id" element={
          <ProtectedRoute><RoomPage /></ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}

export default App