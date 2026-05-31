import { firebaseAuth } from './firebase'

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await firebaseAuth.currentUser?.getIdToken()
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
}
