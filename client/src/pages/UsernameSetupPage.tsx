import { useState } from 'react'
import { User } from 'lucide-react'
import useAuthStore from '../stores/useAuthStore'
import { checkUsernameAvailable } from '../services/userService'
import AuthHeader from '../components/AuthHeader'
import ConfirmDialog from '../components/ConfirmDialog'

export default function UsernameSetupPage() {
  const { userLogged, completeProfile, logout } = useAuthStore()
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [available, setAvailable] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [networkError, setNetworkError] = useState('')

  const handleBlur = async () => {
    if (!username.trim()) return
    setChecking(true)
    const result = await checkUsernameAvailable(username)
    setAvailable(result.available)
    if (!result.available) setError('Este nombre de usuario ya está en uso')
    else setError('')
    setChecking(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) { setError('El nombre de usuario es requerido'); return }
    if (available === false) { setError('Este nombre de usuario ya está en uso'); return }
    setSubmitting(true)
    setNetworkError('')
    const result = await completeProfile(username)
    if (result.error) {
      setNetworkError(result.error)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col">
      <AuthHeader
        rightSlot={
          <button
            type="button"
            onClick={() => setShowCancelConfirm(true)}
            className="px-5 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            Cancelar
          </button>
        }
      />

      <main className="flex-1 flex items-center justify-center px-6 py-12" role="main">
        <div className="w-full max-w-md">
          <div className="bg-neutral-white border border-neutral-200 rounded-xl p-8 shadow-lg">

            <div className="text-center mb-8">
              {userLogged?.photoURL ? (
                <img
                  src={userLogged.photoURL}
                  alt={`Foto de ${userLogged.displayName}`}
                  className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-neutral-200"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
                  <User size={36} className="text-primary-500" aria-hidden="true" />
                </div>
              )}
              <h1 className="text-2xl font-bold text-neutral-950 mb-1">
                Hola, {userLogged?.displayName?.split(' ')[0] ?? 'usuario'}
              </h1>
              <p className="text-neutral-600 text-sm">Elige un nombre de usuario para tu perfil</p>
            </div>

            {networkError && (
              <div role="alert" className="mb-4 p-3 bg-red-50 border border-error-500 rounded-md">
                <p className="text-sm text-error-500">{networkError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-6">
                <label htmlFor="username" className="block text-sm font-medium text-neutral-950 mb-2">
                  Nombre de Usuario <span className="text-error-500" aria-hidden="true">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User size={20} className="text-neutral-400" aria-hidden="true" />
                  </div>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setAvailable(null); setError('') }}
                    onBlur={handleBlur}
                    placeholder="tunombredeusuario"
                    required
                    aria-invalid={!!error}
                    aria-describedby="username-status username-error"
                    className={`w-full pl-12 pr-4 py-3 bg-neutral-white border-2 rounded-md text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-100 transition-colors ${error ? 'border-error-500' : 'border-neutral-200 focus:border-primary-500'}`}
                  />
                </div>
                <p id="username-status" className="mt-1 text-xs text-neutral-600">
                  {checking ? 'Verificando...' : available === true ? '✓ Disponible' : 'Este nombre será visible para otros usuarios'}
                </p>
                {error && <p id="username-error" role="alert" className="mt-1 text-xs text-error-500">{error}</p>}
              </div>

              <button
                type="submit"
                disabled={submitting || available === false}
                className="w-full px-6 py-3 bg-primary-500 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-white font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                {submitting ? 'Guardando...' : 'Continuar'}
              </button>
            </form>
          </div>
        </div>
      </main>

      <ConfirmDialog
        open={showCancelConfirm}
        title="¿Cancelar configuración?"
        message="Tu cuenta de Google fue creada, pero sin un username no podrás acceder a la plataforma. ¿Seguro que quieres salir?"
        confirmLabel="Sí, salir"
        cancelLabel="Quedarse"
        onConfirm={logout}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </div>
  )
}
