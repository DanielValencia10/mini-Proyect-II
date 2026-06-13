import { X } from 'lucide-react'

interface Message { id: number; author: string; text: string }

interface Props {
    messages: Message[]
    message: string
    onClose: () => void
    onChange: (v: string) => void
    onSend: () => void
}

export function ChatPanel({ messages, message, onClose, onChange, onSend }: Props) {
    return (
        <aside className="w-72 sm:w-80 shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <span className="font-semibold text-sm">Chat</span>
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(m => (
                    <div key={m.id}>
                        <p className="text-cyan-400 text-xs font-medium">{m.author}</p>
                        <p className="text-gray-300 text-sm mt-0.5">{m.text}</p>
                    </div>
                ))}
            </div>

            <div className="p-3 border-t border-gray-800 flex gap-2">
                <input
                    value={message}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && onSend()}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-cyan-500 placeholder-gray-500"
                />
                <button onClick={onSend} className="bg-cyan-500 hover:bg-cyan-600 text-gray-950 px-3 rounded-lg font-bold text-sm transition-colors">
                    ↑
                </button>
            </div>
        </aside>
    )
}