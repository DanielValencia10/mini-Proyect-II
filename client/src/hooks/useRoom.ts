import { useState } from 'react'

export function useRoom() {
    const [camOn, setCamOn] = useState(false)
    const [micOn, setMicOn] = useState(true)
    const [chatOpen, setChatOpen] = useState(false)
    const [message, setMessage] = useState('')
    // Screen share
    const [screenSharing, setScreenSharing] = useState(false)
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null)

    return {
        micOn,
        setMicOn,
        camOn,
        setCamOn,
        chatOpen,
        setChatOpen,
        message,
        setMessage,
        screenSharing,
        setScreenSharing,
        screenStream,
        setScreenStream,
    }
}