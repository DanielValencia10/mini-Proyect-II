import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, User, Mail, Lock } from 'lucide-react'
import useAuthStore from '../stores/useAuthStore'
import { checkUsernameAvailable } from '../services/userService'
import AuthHeader from '../components/AuthHeader'
import AlertDialog from '../components/AlertDialog'

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
)

interface FormState {
  nombres: string
  apellidos: string
  username: string
  email: string
  password: string
  confirmPassword: string
}

type FormErrors = Partial<FormState> & { general?: string }

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/

const validatePassword = (pwd: string): string | null => {
  if (!PASSWORD_REGEX.test(pwd)) {
    return 'Mínimo 8 caracteres, una mayúscula, un número y un símbolo'
  }
  return null
}

export default function RegisterPage() {
  const { registerWithEmail, loginWithGoogle } = useAuthStore()

  const [form, setForm] = useState<FormState>({
    nombres: '', apellidos: '', username: '', email: '', password: '', confirmPassword: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [alertMsg, setAlertMsg] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: undefined, general: undefined }))
    if (name === 'username') setUsernameAvailable(null)
  }

  const handleUsernameBlur = async () => {
    if (!form.username.trim()) return
    setCheckingUsername(true)
    const result = await checkUsernameAvailable(form.username)
    setUsernameAvailable(result.available)
    if (!result.available) {
      setErrors(prev => ({ ...prev, username: 'Este nombre de usuario ya está en uso' }))
    }
    setCheckingUsername(false)
  }

  const handlePasswordBlur = () => {
    const err = validatePassword(form.password)
    if (err) setErrors(prev => ({ ...prev, password: err }))
    else setErrors(prev => ({ ...prev, password: undefined }))
  }

  const validate = (): boolean => {
    const newErrors: FormErrors = {}
    if (!form.nombres.trim()) newErrors.nombres = 'El nombre es requerido'
    if (!form.apellidos.trim()) newErrors.apellidos = 'El apellido es requerido'
    if (!form.username.trim()) newErrors.username = 'El nombre de usuario es requerido'
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Correo inválido'
    const pwdErr = validatePassword(form.password)
    if (pwdErr) newErrors.password = pwdErr
    if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Las contraseñas no coinciden'
    if (usernameAvailable === false) newErrors.username = 'Este nombre de usuario ya está en uso'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Si el username no fue verificado aún (usuario no salió del campo), verificar ahora
    if (form.username.trim() && usernameAvailable === null) {
      setCheckingUsername(true)
      const check = await checkUsernameAvailable(form.username)
      setUsernameAvailable(check.available)
      setCheckingUsername(false)
      if (!check.available) {
        setErrors(prev => ({ ...prev, username: 'Este nombre de usuario ya está en uso' }))
        return
      }
    }

    if (!validate()) return
    setSubmitting(true)
    const result = await registerWithEmail(form)
    if (result.error) {
      setAlertMsg(result.error)
      setSubmitting(false)
    } else {
      setSuccessMsg('¡Cuenta creada exitosamente! Redirigiendo...')
    }
  }

  const handleGoogle = async () => {
    setErrors({})
    const result = await loginWithGoogle()
    if (result.error) setAlertMsg(result.error)
  }

  const inputClass = (field: keyof FormState) =>
    `w-full pl-12 pr-4 py-3 bg-neutral-white border-2 rounded-md text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-100 transition-colors duration-200 ${errors[field] ? 'border-error-500 focus:border-error-500' : 'border-neutral-200 focus:border-primary-500'
    }`

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col">
      <AuthHeader showLogin />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12" role="main">
        <div className="w-full max-w-2xl">
          <div className="bg-neutral-white border border-neutral-200 rounded-xl p-6 sm:p-8 shadow-lg">

            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus size={32} className="text-primary-500" aria-hidden="true" />
              </div>
              <h1 className="text-3xl font-bold text-neutral-950 mb-2">Crear Cuenta</h1>
              <p className="text-neutral-600">Únete a nuestra comunidad de estudiantes</p>
            </div>

            {successMsg && (
              <div role="status" aria-live="polite" className="mb-6 p-3 bg-green-50 border border-green-400 rounded-md flex items-center gap-2">
                <span className="text-green-600 text-lg" aria-hidden="true">✓</span>
                <p className="text-sm text-green-700 font-medium">{successMsg}</p>
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogle}
              className="w-full mb-6 px-6 py-3 bg-neutral-white border-2 border-neutral-200 text-neutral-950 hover:bg-neutral-50 font-medium rounded-md transition-colors duration-200 flex items-center justify-center gap-3 focus:outline-none focus:ring-2 focus:ring-primary-300"
              aria-label="Registrarse con Google"
            >
              <GoogleIcon />
              Registrarse con Google
            </button>

            <div className="relative mb-6" aria-hidden="true">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-neutral-white text-neutral-600">O regístrate con tu correo</span>
              </div>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit} noValidate>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="nombres" className="block text-sm font-medium text-neutral-950 mb-2">
                    Nombre(s) <span className="text-error-500" aria-hidden="true">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User size={20} className="text-neutral-400" aria-hidden="true" />
                    </div>
                    <input
                      id="nombres" name="nombres" type="text"
                      value={form.nombres} onChange={handleChange}
                      placeholder="Juan" required
                      aria-invalid={!!errors.nombres}
                      aria-describedby={errors.nombres ? 'nombres-error' : undefined}
                      className={inputClass('nombres')}
                    />
                  </div>
                  {errors.nombres && <p id="nombres-error" role="alert" className="mt-1 text-xs text-error-500">{errors.nombres}</p>}
                </div>

                <div>
                  <label htmlFor="apellidos" className="block text-sm font-medium text-neutral-950 mb-2">
                    Apellido(s) <span className="text-error-500" aria-hidden="true">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User size={20} className="text-neutral-400" aria-hidden="true" />
                    </div>
                    <input
                      id="apellidos" name="apellidos" type="text"
                      value={form.apellidos} onChange={handleChange}
                      placeholder="Pérez" required
                      aria-invalid={!!errors.apellidos}
                      aria-describedby={errors.apellidos ? 'apellidos-error' : undefined}
                      className={inputClass('apellidos')}
                    />
                  </div>
                  {errors.apellidos && <p id="apellidos-error" role="alert" className="mt-1 text-xs text-error-500">{errors.apellidos}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-neutral-950 mb-2">
                  Nombre de Usuario <span className="text-error-500" aria-hidden="true">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User size={20} className="text-neutral-400" aria-hidden="true" />
                  </div>
                  <input
                    id="username" name="username" type="text"
                    value={form.username} onChange={handleChange} onBlur={handleUsernameBlur}
                    placeholder="juanperez" required
                    aria-invalid={!!errors.username}
                    aria-describedby="username-hint username-error"
                    className={inputClass('username')}
                  />
                </div>
                <p id="username-hint" className="mt-1 text-xs text-neutral-600">
                  {checkingUsername ? 'Verificando...' : usernameAvailable === true ? '✓ Disponible' : 'Este nombre será visible para otros usuarios'}
                </p>
                {errors.username && <p id="username-error" role="alert" className="mt-1 text-xs text-error-500">{errors.username}</p>}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-neutral-950 mb-2">
                  Correo Electrónico <span className="text-error-500" aria-hidden="true">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail size={20} className="text-neutral-400" aria-hidden="true" />
                  </div>
                  <input
                    id="email" name="email" type="email"
                    value={form.email} onChange={handleChange}
                    placeholder="juan.perez@correo.com" required autoComplete="email"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    className={inputClass('email')}
                  />
                </div>
                {errors.email && <p id="email-error" role="alert" className="mt-1 text-xs text-error-500">{errors.email}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-neutral-950 mb-2">
                    Contraseña <span className="text-error-500" aria-hidden="true">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock size={20} className="text-neutral-400" aria-hidden="true" />
                    </div>
                    <input
                      id="password" name="password" type="password"
                      value={form.password} onChange={handleChange} onBlur={handlePasswordBlur}
                      placeholder="••••••••" required autoComplete="new-password"
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? 'password-error' : undefined}
                      className={inputClass('password')}
                    />
                  </div>
                  {errors.password && <p id="password-error" role="alert" className="mt-1 text-xs text-error-500">{errors.password}</p>}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-950 mb-2">
                    Confirmar Contraseña <span className="text-error-500" aria-hidden="true">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock size={20} className="text-neutral-400" aria-hidden="true" />
                    </div>
                    <input
                      id="confirmPassword" name="confirmPassword" type="password"
                      value={form.confirmPassword} onChange={handleChange}
                      placeholder="••••••••" required autoComplete="new-password"
                      aria-invalid={!!errors.confirmPassword}
                      aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
                      className={inputClass('confirmPassword')}
                    />
                  </div>
                  {errors.confirmPassword && <p id="confirm-error" role="alert" className="mt-1 text-xs text-error-500">{errors.confirmPassword}</p>}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || usernameAvailable === false}
                className="w-full px-6 py-3 bg-blue-800 hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {submitting ? 'Creando cuenta...' : 'Crear Cuenta'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-neutral-600">
                ¿Ya tienes una cuenta?{' '}
                <Link to="/login" className="text-primary-700 hover:text-primary-900 font-semibold">
                  Inicia sesión aquí
                </Link>
              </p>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-neutral-500">
            Al crear una cuenta, aceptas nuestros términos de servicio y política de privacidad
          </p>
        </div>
      </main>

      <AlertDialog
        open={!!alertMsg}
        title="Correo no permitido"
        message={alertMsg}
        onClose={() => setAlertMsg('')}
      />
    </div>
  )
}