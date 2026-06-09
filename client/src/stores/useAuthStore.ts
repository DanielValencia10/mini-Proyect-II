import { create } from 'zustand'
import {
  onAuthStateChanged,
  onIdTokenChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  GoogleAuthProvider,
  User,
} from 'firebase/auth'
import { firebaseAuth } from '../lib/firebase'
import { getUser, createUser, updateUser, deleteUser } from '../services/userService'

import { INSTITUTIONAL_DOMAIN, isInstitutionalEmail } from '../constants/auth'

interface RegisterData {
  nombres: string
  apellidos: string
  username: string
  email: string
  password: string
}

interface AuthState {
  userLogged: User | null
  loading: boolean
  needsUsername: boolean
  token: string | null
  loginWithGoogle: () => Promise<{ error?: string }>
  loginWithEmail: (email: string, password: string) => Promise<{ error?: string }>
  registerWithEmail: (data: RegisterData) => Promise<{ error?: string }>
  sendPasswordReset: (email: string) => Promise<{ success: boolean }>
  completeProfile: (username: string) => Promise<{ error?: string }>
  updateProfile: (data: { nombres?: string; apellidos?: string; username?: string; avatar?: string; email?: string }) => Promise<{ error?: string }>
  logout: () => Promise<void>
  deleteUserAccount: () => Promise<{ error?: string }>
}

let skipAuthCheck = false

const useAuthStore = create<AuthState>((set, get) => {

  onAuthStateChanged(firebaseAuth, async (user) => {
    if (skipAuthCheck) return
    if (user) {
      if (!isInstitutionalEmail(user.email ?? '')) {
        await signOut(firebaseAuth)
        set({ userLogged: null, needsUsername: false, loading: false })
        return
      }
      const token = await user.getIdToken()
      const result = await getUser(user.uid, token)
      const hasUsername = result.success && result.data?.username
      set({ userLogged: user, needsUsername: !hasUsername, loading: false })
    } else {
      set({ userLogged: null, needsUsername: false, loading: false })
    }
  })

  onIdTokenChanged(firebaseAuth, async (user) => {
    if (user) {
      const newToken = await user.getIdToken()
      set({ token: newToken })
    } else {
      set({ token: null })
    }
  })

  return {
    userLogged: null,
    loading: true,
    needsUsername: false,
    token: null,

    loginWithGoogle: async () => {
      try {
        const result = await signInWithPopup(firebaseAuth, new GoogleAuthProvider())
        if (!isInstitutionalEmail(result.user.email ?? '')) {
          await signOut(firebaseAuth)
          return { error: `Solo se permiten correos @${INSTITUTIONAL_DOMAIN}` }
        }
        return {}
      } catch (err: unknown) {
        const code = (err as { code?: string }).code
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return {}
        return { error: 'No se pudo conectar con Google. Intenta de nuevo' }
      }
    },

    loginWithEmail: async (email, password) => {
      try {
        await signInWithEmailAndPassword(firebaseAuth, email, password)
        return {}
      } catch (err: unknown) {
        const code = (err as { code?: string }).code
        if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
          return { error: 'Correo o contraseña incorrectos' }
        }
        if (code === 'auth/too-many-requests') return { error: 'Demasiados intentos. Intenta más tarde' }
        return { error: 'No se pudo conectar. Verifica tu conexión' }
      }
    },

    registerWithEmail: async ({ nombres, apellidos, username, email, password }) => {
      if (!isInstitutionalEmail(email)) {
        return { error: `Solo se permiten correos @${INSTITUTIONAL_DOMAIN}` }
      }
      try {
        skipAuthCheck = true
        const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password)
        await updateProfile(credential.user, { displayName: `${nombres} ${apellidos}` })
        const result = await createUser({ uid: credential.user.uid, email, username, nombres, apellidos })
        if (!result.success) return { error: 'No se pudo crear la cuenta. Verifica tu conexión' }
        skipAuthCheck = false
        sessionStorage.setItem('sr_welcome', nombres)
        set({ userLogged: credential.user, needsUsername: false, loading: false })
        return {}
      } catch (err: unknown) {
        skipAuthCheck = false
        const code = (err as { code?: string }).code
        if (code === 'auth/email-already-in-use') return { error: 'Este correo ya está registrado' }
        return { error: 'No se pudo crear la cuenta. Verifica tu conexión' }
      }
    },

    sendPasswordReset: async (email) => {
      try {
        await sendPasswordResetEmail(firebaseAuth, email)
        return { success: true }
      } catch {
        return { success: false }
      }
    },

    completeProfile: async (username) => {
      const user = get().userLogged
      if (!user) return { error: 'No hay sesión activa' }
      try {
        await user.getIdToken(true)
        const [nombres, ...rest] = (user.displayName ?? '').split(' ')
        const result = await createUser({
          uid: user.uid,
          email: user.email ?? '',
          username,
          nombres: nombres ?? '',
          apellidos: rest.join(' '),
          avatar: user.photoURL ?? undefined,
        })
        if (!result.success) return { error: 'No se pudo completar tu perfil. Intenta de nuevo' }
        set({ needsUsername: false })
        return {}
      } catch {
        return { error: 'No se pudo completar tu perfil. Intenta de nuevo' }
      }
    },

    logout: async () => {
      await signOut(firebaseAuth)
      set({ userLogged: null, needsUsername: false })
    },

    deleteUserAccount: async () => {
      const user = get().userLogged
      if (!user) return { error: 'No hay sesión activa' }
      try {
        const result = await deleteUser(user.uid)
        if (!result.success) {
          return { error: 'No se pudo eliminar la cuenta de la base de datos. Intente de nuevo' }
        }
        await user.delete()
        set({ userLogged: null, needsUsername: false })
        return {}
      } catch (err: unknown) {
        console.error(err)
        const code = (err as { code?: string }).code
        if (code === 'auth/requires-recent-login') {
          return { error: 'Por seguridad, esta acción requiere que inicies sesión de nuevo antes de poder eliminar tu cuenta.' }
        }
        return { error: 'No se pudo eliminar el usuario de Firebase Auth. Intente de nuevo' }
      }
    },

    updateProfile: async (data) => {
      const user = get().userLogged
      if (!user) return { error: 'No hay sesión activa' }
      try {
        if (data.nombres || data.apellidos) {
          const displayName = `${data.nombres || user.displayName?.split(' ')[0]} ${data.apellidos || user.displayName?.split(' ').slice(1).join(' ')}`.trim()
          await updateProfile(user, { displayName })
        }
        const result = await updateUser(user.uid, data)
        if (!result.success) return { error: 'No se pudo actualizar tu perfil. Intenta de nuevo' }
        return {}
      } catch {
        return { error: 'No se pudo actualizar tu perfil. Intenta de nuevo' }
      }
    },
  }
})

export default useAuthStore