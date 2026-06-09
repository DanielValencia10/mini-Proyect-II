import { authFetch } from '../lib/authFetch'

const BASE_URL = import.meta.env.VITE_BACKEND_URL

export interface UserData {
  uid: string
  email: string
  username: string
  nombres: string
  apellidos: string
  avatar?: string
}

export const getUser = async (uid: string, token?: string) => {
  const res = token
    ? await fetch(`${BASE_URL}/users/${uid}`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
    : await authFetch(`${BASE_URL}/users/${uid}`)
  return res.json() as Promise<{ success: boolean; data: UserData | null }>
}

export const createUser = async (userData: UserData) => {
  const res = await authFetch(`${BASE_URL}/users`, {
    method: 'POST',
    body: JSON.stringify(userData),
  })
  return res.json() as Promise<{ success: boolean }>
}

export const updateUser = async (
  uid: string,
  fields: Partial<Omit<UserData, 'uid' | 'email'>>,
) => {
  const res = await authFetch(`${BASE_URL}/users/${uid}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  })
  return res.json() as Promise<{ success: boolean }>
}

export const deleteUser = async (uid: string) => {
  const res = await authFetch(`${BASE_URL}/users/${uid}`, { method: 'DELETE' })
  return res.json() as Promise<{ success: boolean }>
}

export const checkUsernameAvailable = async (username: string): Promise<{ available: boolean }> => {
  try {
    const res = await fetch(`${BASE_URL}/users/check-username/${encodeURIComponent(username)}`)
    return res.json() as Promise<{ available: boolean }>
  } catch {
    return { available: false }
  }
}

export const checkEmailAvailable = async (email: string, currentUid?: string): Promise<{ available: boolean }> => {
  try {
    const url = currentUid
      ? `${BASE_URL}/users/check-email/${encodeURIComponent(email)}?excludeUid=${encodeURIComponent(currentUid)}`
      : `${BASE_URL}/users/check-email/${encodeURIComponent(email)}`
    const res = await fetch(url)
    return res.json() as Promise<{ available: boolean }>
  } catch {
    return { available: false }
  }
}

export const checkUsernameAvailableForUpdate = async (username: string, currentUid: string): Promise<{ available: boolean }> => {
  try {
    const res = await fetch(`${BASE_URL}/users/check-username/${encodeURIComponent(username)}?excludeUid=${encodeURIComponent(currentUid)}`)
    return res.json() as Promise<{ available: boolean }>
  } catch {
    return { available: false }
  }
}
