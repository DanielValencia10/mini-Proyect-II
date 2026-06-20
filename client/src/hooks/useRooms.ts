import { useState, useEffect, useCallback } from 'react'
import { getRoomsByOwner, createRoom, updateRoom, deleteRoom, RoomData } from '../services/roomService'

function generateId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export function useRooms(ownerId: string) {
    const [rooms, setRooms] = useState<RoomData[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchRooms = useCallback(async () => {
        setLoading(true)
        const { success, data } = await getRoomsByOwner(ownerId)
        if (success) setRooms(data)
        else setError('Error cargando salas')
        setLoading(false)
    }, [ownerId])

    useEffect(() => { fetchRooms() }, [fetchRooms])

    const addRoom = async (name: string) => {
        const room: RoomData = { id: generateId(), name, ownerId, participants: [ownerId] }
        const { success } = await createRoom(room)
        if (success) setRooms(prev => [...prev, room])
        return success
    }

    const renameRoom = async (id: string, name: string) => {
        const { success } = await updateRoom(id, { name })
        if (success) setRooms(prev => prev.map(r => r.id === id ? { ...r, name } : r))
        return success
    }

    const removeRoom = async (id: string) => {
        const { success } = await deleteRoom(id)
        if (success) setRooms(prev => prev.filter(r => r.id !== id))
        return success
    }

    return { rooms, loading, error, addRoom, renameRoom, removeRoom, refetch: fetchRooms }
}