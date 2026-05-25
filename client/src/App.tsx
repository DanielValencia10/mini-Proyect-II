import { useEffect } from 'react'
import useAuthStore from './stores/useAuthStore'
import { getUser, createUser } from './services/userService'

function App() {
  const { userLogged, loading, loginWithGoogle, logout } = useAuthStore()

  useEffect(() => {
    if (!userLogged) return

    const registerIfNew = async () => {
      const { success, data } = await getUser(userLogged.uid)

      if (success && data) return

      const [nombres, ...rest] = (userLogged.displayName ?? '').split(' ')

      await createUser({
        uid:       userLogged.uid,
        email:     userLogged.email ?? '',
        username:  userLogged.email?.split('@')[0] ?? '',
        nombres:   nombres ?? '',
        apellidos: rest.join(' '),
        avatar:    userLogged.photoURL ?? undefined,
      })
    }

    registerIfNew()
  }, [userLogged])

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center" role="main">
        <p className="text-gray-500" aria-live="polite" aria-busy="true">Cargando...</p>
      </main>
    )
  }

  return (
    <main
      className="min-h-screen bg-gray-50 flex items-center justify-center"
      role="main"
    >
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">
          Estudio Síncrono Colaborativo
        </h1>
        <p className="text-lg text-gray-500">
          Sprint 0 — Base técnica inicializada correctamente
        </p>
        <p className="text-sm text-green-600 font-medium">
          React + Vite + TypeScript + Tailwind CSS
        </p>

        {userLogged ? (
          <div className="space-y-2">
            <p className="text-gray-700">
              Bienvenido, <strong>{userLogged.displayName}</strong>
            </p>
            <button
              type="button"
              aria-label="Cerrar sesión"
              onClick={logout}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              Cerrar sesión
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label="Iniciar sesión con Google"
            onClick={loginWithGoogle}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            Iniciar sesión con Google
          </button>
        )}
      </div>
    </main>
  )
}

export default App
