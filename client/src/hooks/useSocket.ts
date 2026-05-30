import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import useAuthStore from '../stores/useAuthStore'

interface Participant {
    id: string
    name: string
    speaking: boolean
}

let socket: Socket | null = null

export function useSocket(roomId: string) {
    const { userLogged } = useAuthStore()
    const [participants, setParticipants] = useState<Participant[]>([])

    useEffect(() => {
        if (!userLogged) return

        socket = io(import.meta.env.VITE_BACKEND_URL)

        // Unirse a la sala
        socket.emit('join-room', {
            roomId,
            userId: userLogged.uid,
            userName: userLogged.displayName ?? 'Anónimo',
        })

        // Recibir lista actualizada de participantes
        socket.on('room-participants', (data: Participant[]) => {
            setParticipants(data)
        })

        return () => {
            socket?.emit('leave-room', { roomId, userId: userLogged.uid })
            socket?.disconnect()
            socket = null
        }
    }, [roomId, userLogged])

    return { participants }
}