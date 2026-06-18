import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
interface Message { id: number; author: string; text: string }
interface Props {
    messages: Message[]
    message: string
    onClose: () => void
    onChange: (v: string) => void
    onSend: () => void
    currentUserName: string
}
export function ChatPanel({ messages, message, onClose, onChange, onSend, currentUserName }: Props) {
    const bottomRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])
    return (
        <aside className="w-72 sm:w-80 shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <span className="font-semibold text-sm">Chat</span>
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <X className="h-4 w-4" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m, i) => {
                    const isMine = m.author === currentUserName
                    return (
                        <div key={`${m.id}-${i}`} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                            <p className={`text-xs font-medium ${isMine ? 'text-cyan-400' : 'text-gray-400'}`}>
                                {isMine ? 'Tú' : m.author}
                            </p>
                            <div
                                className={`mt-0.5 max-w-[85%] rounded-xl px-3 py-2 text-sm ${isMine
                                        ? 'bg-cyan-500 text-gray-950'
                                        : 'bg-gray-800 text-gray-200'
                                    }`}
                            >
                                {m.text}
                            </div>
                        </div>
                    )
                })}
                <div ref={bottomRef} />
            </div>
            <div className="p-3 border-t border-gray-800 flex gap-2">
                <input
                    value={message}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && onSend()}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-cyan-500 placeholder-gray-500"
                />
                <button
                    onClick={onSend}
                    className="bg-cyan-500 hover:bg-cyan-600 text-gray-950 px-3 rounded-lg font-bold text-sm transition-colors"
                >
                    ↑
                </button>
            </div>
        </aside>
    )
}