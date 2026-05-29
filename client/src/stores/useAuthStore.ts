import { create } from 'zustand'
import {
  onAuthStateChanged,
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
import { getUser, createUser } from '../services/userService'

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
  loginWithGoogle: () => Promise<{ error?: string }>
  loginWithEmail: (email: string, password: string) => Promise<{ error?: string }>
  registerWithEmail: (data: RegisterData) => Promise<{ error?: string }>
  sendPasswordReset: (email: string) => Promise<{ success: boolean }>
  completeProfile: (username: string) => Promise<{ error?: string }>
  logout: () => Promise<void>
}

let skipAuthCheck = false

const useAuthStore = create<AuthState>((set, get) => {
  onAuthStateChanged(firebaseAuth, async (user) => {
    if (skipAuthCheck) return
    if (user) {
      const result = await getUser(user.uid)
      const hasUsername = result.success && result.data?.username
      set({ userLogged: user, needsUsername: !hasUsername, loading: false })
    } else {
      set({ userLogged: null, needsUsername: false, loading: false })
    }
  })

  return {
    userLogged: null,
    loading: true,
    needsUsername: false,

    loginWithGoogle: async () => {
      try {
        await signInWithPopup(firebaseAuth, new GoogleAuthProvider())
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
      try {
        skipAuthCheck = true
        const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password)
        await updateProfile(credential.user, { displayName: `${nombres} ${apellidos}` })
        const result = await createUser({ uid: credential.user.uid, email, username, nombres, apellidos })
        if (!result.success) return { error: 'No se pudo crear la cuenta. Verifica tu conexión' }
        skipAuthCheck = false
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
  }
})

export default useAuthStore
