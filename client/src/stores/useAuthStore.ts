import { create } from 'zustand'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  User,
} from 'firebase/auth'
import { firebaseAuth } from '../lib/firebase'

interface AuthState {
  userLogged: User | null
  loading: boolean
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const useAuthStore = create<AuthState>((set) => {
  onAuthStateChanged(firebaseAuth, (user) => {
    set({ userLogged: user ?? null, loading: false })
  })

  return {
    userLogged: null,
    loading: true,

    loginWithGoogle: async () => {
      await signInWithPopup(firebaseAuth, new GoogleAuthProvider())
    },

    logout: async () => {
      await signOut(firebaseAuth)
      set({ userLogged: null })
    },
  }
})

export default useAuthStore
