import { useState } from 'react'

export function useRoom() {
    const [camOn, setCamOn] = useState(false)
    const [micOn, setMicOn] = useState(true)
    const [chatOpen, setChatOpen] = useState(false)
    const [message, setMessage] = useState('')

    return {
        micOn, setMicOn,
        camOn, setCamOn,
        chatOpen, setChatOpen,
        message, setMessage,
    }
}
