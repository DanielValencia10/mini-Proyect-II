import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON!)
  initializeApp({ credential: cert(serviceAccount) })
}

export const db   = getFirestore()
export const auth = getAuth()
