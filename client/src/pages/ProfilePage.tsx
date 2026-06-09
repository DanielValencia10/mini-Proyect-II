import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Mail, Loader, Edit2, X, Check } from 'lucide-react'
import useAuthStore from '../stores/useAuthStore'
import { checkUsernameAvailableForUpdate, getUser } from '../services/userService'
import Toast from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'

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
  const { userLogged, updateProfile, deleteUserAccount } = useAuthStore()
  const isGoogleAccount = userLogged?.providerData?.some(provider => provider.providerId === 'google.com') ?? false

  const [profileData, setProfileData] = useState<FormState>({
    nombres: '',
    apellidos: '',
    username: '',
    email: '',
    avatar: '',
  })

  const [editForm, setEditForm] = useState<FormState>(profileData)
  const [isEditing, setIsEditing] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)

  const handleDeleteAccount = async () => {
    setShowDeleteConfirm(false)
    setDeleting(true)
    const result = await deleteUserAccount()
    setDeleting(false)
    if (result.error) {
      setErrors({ general: result.error })
    } else {
      navigate('/login')
    }
  }

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
          setProfileData(data)
          setEditForm(data)
        }
      } catch {
        setErrors({ general: 'No se pudo cargar tu perfil' })
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [userLogged])

  const handleEditClick = () => {
    setIsEditing(true)
    setEditForm(profileData)
    setErrors({})
    setUsernameAvailable(null)
  }

  const handleCancelClick = () => {
    setIsEditing(false)
    setEditForm(profileData)
    setErrors({})
    setUsernameAvailable(null)
  }

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (name === 'email' && isGoogleAccount) return
    setEditForm(f => ({ ...f, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: undefined, general: undefined }))
    if (name === 'username') setUsernameAvailable(null)
  }

  const handleUsernameBlur = async () => {
    if (!editForm.username.trim() || editForm.username === profileData.username) {
      setUsernameAvailable(null)
      return
    }
    setCheckingUsername(true)
    const result = await checkUsernameAvailableForUpdate(editForm.username, userLogged!.uid)
    setUsernameAvailable(result.available)
    if (!result.available) {
      setErrors(prev => ({ ...prev, username: 'Este nombre de usuario ya está en uso' }))
    }
    setCheckingUsername(false)
  }

  const validate = (): boolean => {
    const newErrors: FormErrors = {}
    if (!editForm.nombres.trim()) newErrors.nombres = 'El nombre es requerido'
    if (!editForm.apellidos.trim()) newErrors.apellidos = 'El apellido es requerido'
    if (!editForm.username.trim()) newErrors.username = 'El nombre de usuario es requerido'
    if (!isGoogleAccount) {
      if (!editForm.email.trim() || !/\S+@\S+\.\S+/.test(editForm.email)) newErrors.email = 'Correo inválido'
    }
    if (editForm.avatar.trim() && !/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(editForm.avatar)) {
      newErrors.avatar = 'URL de imagen inválida'
    }
    if (editForm.username !== profileData.username && usernameAvailable === false) {
      newErrors.username = 'Este nombre de usuario ya está en uso'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    const result = await updateProfile({
      nombres: editForm.nombres,
      apellidos: editForm.apellidos,
      username: editForm.username !== profileData.username ? editForm.username : undefined,
      avatar: editForm.avatar !== profileData.avatar ? editForm.avatar : undefined,
      email: !isGoogleAccount && editForm.email !== profileData.email ? editForm.email : undefined,
    })

    setSubmitting(false)

    if (result.error) {
      setErrors({ general: result.error })
    } else {
      setProfileData(editForm)
      setIsEditing(false)
      setSuccessMsg('Perfil actualizado correctamente')
    }
  }

  const inputClass = (field: keyof FormState, isEdit: boolean) =>
    `w-full pl-12 pr-4 py-3 bg-neutral-white border-2 rounded-md text-neutral-950 placeholder:text-neutral-400 transition-colors duration-200 ${
      isEdit
        ? `focus:outline-none focus:ring-2 focus:ring-primary-100 ${errors[field] ? 'border-error-500 focus:border-error-500' : 'border-neutral-200 focus:border-primary-500'}`
        : 'border-neutral-200 cursor-default'
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
      <nav className="bg-white shadow-sm px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-neutral-600 hover:text-neutral-950 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-300 rounded"
            aria-label="Volver al dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-neutral-950">Mi Perfil</h1>
        </div>

        {!isEditing && (
          <button
            onClick={handleEditClick}
            className="flex items-center gap-2 px-4 py-2 bg-blue-800 hover:bg-blue-900 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Editar perfil"
          >
            <Edit2 className="h-4 w-4" />
            Editar
          </button>
        )}
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="bg-neutral-white border border-neutral-200 rounded-xl p-8 shadow-lg">

          {successMsg && (
            <div role="status" aria-live="polite" className="mb-6 p-3 bg-green-50 border border-green-400 rounded-md flex items-center gap-2">
              <Check className="text-green-600 h-5 w-5" />
              <p className="text-sm text-green-700 font-medium">{successMsg}</p>
            </div>
          )}

          {errors.general && (
            <div role="alert" className="mb-6 p-3 bg-red-50 border border-error-500 rounded-md">
              <p className="text-sm text-error-500">{errors.general}</p>
            </div>
          )}

          {/* Avatar Preview */}
          <div className="flex justify-center mb-8">
            <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center overflow-hidden">
              {(isEditing ? editForm.avatar : profileData.avatar) ? (
                <img src={isEditing ? editForm.avatar : profileData.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={48} className="text-primary-500" />
              )}
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleSave} noValidate>
            {/* Avatar URL */}
            {isEditing && (
              <div>
                <label htmlFor="avatar" className="block text-sm font-medium text-neutral-950 mb-2">
                  URL del Avatar (opcional)
                </label>
                <div className="relative">
                  <input
                    id="avatar"
                    name="avatar"
                    type="url"
                    value={editForm.avatar}
                    onChange={handleEditChange}
                    placeholder="https://ejemplo.com/avatar.jpg"
                    className="w-full pl-4 pr-4 py-3 bg-neutral-white border-2 border-neutral-200 rounded-md text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-100 transition-colors duration-200"
                    aria-invalid={!!errors.avatar}
                    aria-describedby={errors.avatar ? 'avatar-error' : 'avatar-hint'}
                  />
                </div>
                <p id="avatar-hint" className="mt-1 text-xs text-neutral-600">
                  JPG, PNG, GIF o WebP. Ej: https://imgur.com/abc123.jpg
                </p>
                {errors.avatar && <p id="avatar-error" role="alert" className="mt-1 text-xs text-error-500">{errors.avatar}</p>}
              </div>
            )}

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
                    value={isEditing ? editForm.nombres : profileData.nombres}
                    onChange={handleEditChange}
                    readOnly={!isEditing}
                    placeholder="Juan"
                    required
                    aria-invalid={!!errors.nombres}
                    aria-describedby={errors.nombres ? 'nombres-error' : undefined}
                    className={inputClass('nombres', isEditing)}
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
                    value={isEditing ? editForm.apellidos : profileData.apellidos}
                    onChange={handleEditChange}
                    readOnly={!isEditing}
                    placeholder="Pérez"
                    required
                    aria-invalid={!!errors.apellidos}
                    aria-describedby={errors.apellidos ? 'apellidos-error' : undefined}
                    className={inputClass('apellidos', isEditing)}
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
                  value={isEditing ? editForm.username : profileData.username}
                  onChange={handleEditChange}
                  onBlur={isEditing ? handleUsernameBlur : undefined}
                  readOnly={!isEditing}
                  placeholder="juanperez"
                  required
                  aria-invalid={!!errors.username}
                  aria-describedby="username-hint username-error"
                  className={inputClass('username', isEditing)}
                />
              </div>
              {isEditing && (
                <p id="username-hint" className="mt-1 text-xs text-neutral-600">
                  {checkingUsername ? 'Verificando...' : usernameAvailable === true ? '✓ Disponible' : editForm.username === profileData.username ? 'Tu nombre de usuario actual' : 'Será visible para otros usuarios'}
                </p>
              )}
              {errors.username && <p id="username-error" role="alert" className="mt-1 text-xs text-error-500">{errors.username}</p>}
            </div>

            {/* Email */}
            {!isGoogleAccount && (
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-neutral-950 mb-2">
                  Correo Electrónico <span className="text-error-500" aria-hidden="true">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail size={20} className="text-neutral-400" aria-hidden="true" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={isEditing ? editForm.email : profileData.email}
                    onChange={handleEditChange}
                    readOnly={!isEditing}
                    placeholder="juan.perez@correo.com"
                    required
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    className={inputClass('email', isEditing)}
                  />
                </div>
                {errors.email && <p id="email-error" role="alert" className="mt-1 text-xs text-error-500">{errors.email}</p>}
              </div>
            )}

            {/* Google Account Email (Read-only) */}
            {isGoogleAccount && (
              <div>
                <label htmlFor="email-google" className="block text-sm font-medium text-neutral-950 mb-2">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail size={20} className="text-neutral-300" aria-hidden="true" />
                  </div>
                  <input
                    id="email-google"
                    type="email"
                    value={profileData.email}
                    readOnly
                    className="w-full pl-12 pr-4 py-3 bg-neutral-100 border-2 border-neutral-200 rounded-md text-neutral-600 placeholder:text-neutral-400 cursor-not-allowed disabled:opacity-75"
                  />
                </div>
                <p className="mt-1 text-xs text-neutral-600">
                  📌 Cuenta de Google: El correo no puede ser modificado
                </p>
              </div>
            )}

            {/* Buttons */}
            {isEditing ? (
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting || (editForm.username !== profileData.username && usernameAvailable === false)}
                  className="flex-1 px-6 py-3 bg-blue-800 hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Guardar
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCancelClick}
                  disabled={submitting}
                  className="flex-1 px-6 py-3 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 text-neutral-950 font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-300 flex items-center justify-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="space-y-3 pt-4">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="w-full px-6 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-950 font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-300"
                >
                  Volver al Dashboard
                </button>

                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                  className="w-full px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-300 flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      Eliminando cuenta...
                    </>
                  ) : (
                    'Eliminar Cuenta'
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
      </main>

      {successMsg && (
        <Toast message={successMsg} onDismiss={() => setSuccessMsg('')} />
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="¿Eliminar cuenta?"
        message="Esta acción es permanente y eliminará todos tus datos. No podrás recuperar tu cuenta."
        confirmLabel="Eliminar permanentemente"
        cancelLabel="Cancelar"
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}
