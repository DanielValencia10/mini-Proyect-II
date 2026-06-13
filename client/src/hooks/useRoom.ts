import { useState } from 'react'

export function useRoom() {
    const [camOn, setCamOn] = useState(false)
    const [micOn, setMicOn] = useState(true)
    const [chatOpen, setChatOpen] = useState(false)
    const [message, setMessage] = useState('')
    const [messages, setMessages] = useState<{ id: number; author: string; text: string }[]>([])

    const sendMessage = () => {
        if (!message.trim()) return
        setMessages(prev => [...prev, {
            id: prev.length + 1,
            author: userName,
            text: message.trim(),
        }])
        setMessage('')
    }

    return {
        micOn, setMicOn,
        camOn, setCamOn,
        chatOpen, setChatOpen,
        message, setMessage,
        messages,
        sendMessage,
    }
}
