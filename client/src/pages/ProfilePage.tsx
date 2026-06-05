import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Mail, Loader } from 'lucide-react'
import useAuthStore from '../stores/useAuthStore'
import { checkUsernameAvailableForUpdate, checkEmailAvailable, getUser } from '../services/userService'
import Toast from '../components/Toast'

interface FormState {
  nombres: string
  apellidos: string
  username: string
  email: string
  avatar: string
}

type FormErrors = Partial<FormState> & { general?: string }

export default function ProfilePage() {
  const navigate = useNavigate()
  const { userLogged, updateProfile } = useAuthStore()
  const isGoogleAccount = userLogged?.providerData?.some(provider => provider.providerId === 'google.com') ?? false
  const [form, setForm] = useState<FormState>({
    nombres: '',
    apellidos: '',
    username: '',
    email: '',
    avatar: '',
  })
  const [originalForm, setOriginalForm] = useState<FormState>(form)
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    const loadProfile = async () => {
      if (!userLogged) return
      try {
        const token = await userLogged.getIdToken()
        const result = await getUser(userLogged.uid, token)
        if (result.success && result.data) {
          const data = {
            nombres: result.data.nombres,
            apellidos: result.data.apellidos,
            username: result.data.username,
            email: result.data.email,
            avatar: result.data.avatar || '',
          }
          setForm(data)
          setOriginalForm(data)
        }
      } catch {
        setErrors({ general: 'No se pudo cargar tu perfil' })
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [userLogged])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    if (name === 'email' && isGoogleAccount) return
    setForm(f => ({ ...f, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: undefined, general: undefined }))
    if (name === 'username') setUsernameAvailable(null)
    if (name === 'email') setEmailAvailable(null)
  }

  const handleUsernameBlur = async () => {
    if (!form.username.trim() || form.username === originalForm.username) {
      setUsernameAvailable(null)
      return
    }
    setCheckingUsername(true)
    const result = await checkUsernameAvailableForUpdate(form.username, userLogged!.uid)
    setUsernameAvailable(result.available)
    if (!result.available) {
      setErrors(prev => ({ ...prev, username: 'Este nombre de usuario ya está en uso' }))
    }
    setCheckingUsername(false)
  }

  const handleEmailBlur = async () => {
    if (!form.email.trim() || form.email === originalForm.email) {
      setEmailAvailable(null)
      return
    }
    if (!/\S+@\S+\.\S+/.test(form.email)) return
    const result = await checkEmailAvailable(form.email, userLogged!.uid)
    setEmailAvailable(result.available)
    if (!result.available) {
      setErrors(prev => ({ ...prev, email: 'Este correo electrónico ya está registrado' }))
    }
  }

  const validate = (): boolean => {
    const newErrors: FormErrors = {}
    if (!form.nombres.trim()) newErrors.nombres = 'El nombre es requerido'
    if (!form.apellidos.trim()) newErrors.apellidos = 'El apellido es requerido'
    if (!form.username.trim()) newErrors.username = 'El nombre de usuario es requerido'
    if (!isGoogleAccount) {
      if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Correo inválido'
      if (form.email !== originalForm.email && emailAvailable === false) {
        newErrors.email = 'Este correo electrónico ya está registrado'
      }
    }
    if (form.avatar.trim() && !/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(form.avatar)) {
      newErrors.avatar = 'URL de imagen inválida'
    }
    if (form.username !== originalForm.username && usernameAvailable === false) {
      newErrors.username = 'Este nombre de usuario ya está en uso'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    const result = await updateProfile({
      nombres: form.nombres,
      apellidos: form.apellidos,
      username: form.username !== originalForm.username ? form.username : undefined,
      avatar: form.avatar !== originalForm.avatar ? form.avatar : undefined,
      email: !isGoogleAccount && form.email !== originalForm.email ? form.email : undefined,
    })

    if (result.error) {
      setErrors({ general: result.error })
      setSubmitting(false)
    } else {
      setSuccessMsg('¡Perfil actualizado exitosamente!')
      setOriginalForm(form)
      setSubmitting(false)
    }
  }

  const inputClass = (field: keyof FormState) =>
    `w-full pl-12 pr-4 py-3 bg-neutral-white border-2 rounded-md text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-100 transition-colors duration-200 ${
      errors[field] ? 'border-error-500 focus:border-error-500' : 'border-neutral-200 focus:border-primary-500'
    }`

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-8 h-8 text-primary-500 animate-spin" />
          <p className="text-neutral-600">Cargando perfil...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      {/* Header */}
      <nav className="bg-white shadow-sm px-8 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-neutral-600 hover:text-neutral-950 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-300 rounded"
          aria-label="Volver al dashboard"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-neutral-950">Mi Perfil</h1>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="bg-neutral-white border border-neutral-200 rounded-xl p-8 shadow-lg">

          {successMsg && (
            <div role="status" aria-live="polite" className="mb-6 p-3 bg-green-50 border border-green-400 rounded-md flex items-center gap-2">
              <span className="text-green-600 text-lg" aria-hidden="true">✓</span>
              <p className="text-sm text-green-700 font-medium">{successMsg}</p>
            </div>
          )}

          {errors.general && (
            <div role="alert" className="mb-6 p-3 bg-red-50 border border-error-500 rounded-md">
              <p className="text-sm text-error-500">{errors.general}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            {/* Avatar Preview */}
            <div className="flex justify-center mb-8">
              <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center overflow-hidden">
                {form.avatar ? (
                  <img src={form.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={48} className="text-primary-500" />
                )}
              </div>
            </div>

            {/* Avatar URL */}
            <div>
              <label htmlFor="avatar" className="block text-sm font-medium text-neutral-950 mb-2">
                URL del Avatar (opcional)
              </label>
              <div className="relative">
                <input
                  id="avatar"
                  name="avatar"
                  type="url"
                  value={form.avatar}
                  onChange={handleChange}
                  placeholder="https://ejemplo.com/avatar.jpg"
                  className="w-full pl-4 pr-4 py-3 bg-neutral-white border-2 rounded-md text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-100 transition-colors duration-200"
                  aria-invalid={!!errors.avatar}
                  aria-describedby={errors.avatar ? 'avatar-error' : 'avatar-hint'}
                />
              </div>
              <p id="avatar-hint" className="mt-1 text-xs text-neutral-600">
                JPG, PNG, GIF o WebP. Ej: https://imgur.com/abc123.jpg
              </p>
              {errors.avatar && <p id="avatar-error" role="alert" className="mt-1 text-xs text-error-500">{errors.avatar}</p>}
            </div>

            {/* Nombres y Apellidos */}
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
                    id="nombres"
                    name="nombres"
                    type="text"
                    value={form.nombres}
                    onChange={handleChange}
                    placeholder="Juan"
                    required
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
                    id="apellidos"
                    name="apellidos"
                    type="text"
                    value={form.apellidos}
                    onChange={handleChange}
                    placeholder="Pérez"
                    required
                    aria-invalid={!!errors.apellidos}
                    aria-describedby={errors.apellidos ? 'apellidos-error' : undefined}
                    className={inputClass('apellidos')}
                  />
                </div>
                {errors.apellidos && <p id="apellidos-error" role="alert" className="mt-1 text-xs text-error-500">{errors.apellidos}</p>}
              </div>
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-neutral-950 mb-2">
                Nombre de Usuario <span className="text-error-500" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User size={20} className="text-neutral-400" aria-hidden="true" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={form.username}
                  onChange={handleChange}
                  onBlur={handleUsernameBlur}
                  placeholder="juanperez"
                  required
                  aria-invalid={!!errors.username}
                  aria-describedby="username-hint username-error"
                  className={inputClass('username')}
                />
              </div>
              <p id="username-hint" className="mt-1 text-xs text-neutral-600">
                {checkingUsername ? 'Verificando...' : usernameAvailable === true ? '✓ Disponible' : form.username === originalForm.username ? 'Tu nombre de usuario actual' : 'Será visible para otros usuarios'}
              </p>
              {errors.username && <p id="username-error" role="alert" className="mt-1 text-xs text-error-500">{errors.username}</p>}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-950 mb-2">
                Correo Electrónico <span className="text-error-500" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail size={20} className={isGoogleAccount ? 'text-neutral-300' : 'text-neutral-400'} aria-hidden="true" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  onBlur={handleEmailBlur}
                  placeholder="juan.perez@correo.com"
                  required
                  disabled={isGoogleAccount}
                  aria-invalid={!!errors.email}
                  aria-describedby="email-hint email-error"
                  className={isGoogleAccount
                    ? 'w-full pl-12 pr-4 py-3 bg-neutral-100 border-2 border-neutral-200 rounded-md text-neutral-600 placeholder:text-neutral-400 cursor-not-allowed disabled:opacity-75'
                    : inputClass('email')
                  }
                />
              </div>
              <p id="email-hint" className="mt-1 text-xs text-neutral-600">
                {isGoogleAccount
                  ? '📌 Cuenta de Google: El correo no puede ser modificado'
                  : form.email === originalForm.email ? 'Tu correo actual' : 'Se actualizará en tu cuenta'
                }
              </p>
              {errors.email && <p id="email-error" role="alert" className="mt-1 text-xs text-error-500">{errors.email}</p>}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || (form.username !== originalForm.username && usernameAvailable === false)}
              className="w-full px-6 py-3 bg-blue-800 hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {submitting ? 'Guardando cambios...' : 'Guardar Cambios'}
            </button>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="w-full px-6 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-950 font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-300"
            >
              Cancelar
            </button>
          </form>
        </div>
      </main>

      {successMsg && (
        <Toast message={successMsg} onDismiss={() => setSuccessMsg('')} />
      )}
    </div>
  )
}
