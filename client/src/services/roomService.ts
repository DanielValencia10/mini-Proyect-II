import { authFetch } from '../lib/authFetch'

const BASE_URL = import.meta.env.VITE_BACKEND_URL

export interface RoomData {
    id: string
    name: string
    ownerId: string
    participants: number
}

export const getRoomsByOwner = async (ownerId: string) => {
    const res = await authFetch(`${BASE_URL}/rooms?ownerId=${ownerId}`)
    return res.json() as Promise<{ success: boolean; data: RoomData[] }>
}

export const getRoomById = async (id: string) => {
    const res = await authFetch(`${BASE_URL}/rooms/${id}`)
    return res.json() as Promise<{ success: boolean; data: RoomData | null }>
}

export const createRoom = async (room: RoomData) => {
    const res = await authFetch(`${BASE_URL}/rooms`, {
        method: 'POST',
        body: JSON.stringify(room),
    })
    return res.json() as Promise<{ success: boolean }>
}

export const deleteRoom = async (id: string) => {
    const res = await authFetch(`${BASE_URL}/rooms/${id}`, { method: 'DELETE' })
    return res.json() as Promise<{ success: boolean }>
}

export const getRoomMessages = async (roomId: string) => {
    const res = await authFetch(`${BASE_URL}/rooms/${roomId}/messages`)
    return res.json() as Promise<{ success: boolean; data: { id: string; author: string; text: string }[] }>
}