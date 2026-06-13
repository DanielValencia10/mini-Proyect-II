import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hash, Users, Trash2, Copy, Check, Pencil, X } from 'lucide-react'
import useAuthStore from '../../stores/useAuthStore'

interface Room {
    id: string
    name: string
    participants: string[]
    ownerId: string
}

interface Props {
    room: Room
    onDelete: (id: string) => void
    onRename: (id: string, name: string) => Promise<boolean>
}

export function RoomCard({ room, onDelete, onRename }: Props) {
    const navigate = useNavigate()
    const { userLogged } = useAuthStore()
    const isOwner = userLogged?.uid === room.ownerId

    const [copied, setCopied] = useState(false)
    const [editing, setEditing] = useState(false)
    const [editName, setEditName] = useState(room.name)
    const [saving, setSaving] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (editing) inputRef.current?.focus()
    }, [editing])

    const copyId = () => {
        navigator.clipboard.writeText(room.id)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleSaveRename = async () => {
        const trimmed = editName.trim()
        if (!trimmed || trimmed === room.name) { setEditing(false); return }
        setSaving(true)
        await onRename(room.id, trimmed)
        setSaving(false)
        setEditing(false)
    }

    return (
        <div className="bg-white rounded-xl p-6 shadow-sm flex flex-col justify-between">
            <div>
                <div className="flex items-start justify-between mb-3">
                    {editing ? (
                        <div className="flex items-center gap-2 flex-1 mr-2">
                            <input
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleSaveRename(); if (e.key === 'Escape') setEditing(false) }}
                                maxLength={50}
                                ref={inputRef}
                                className="flex-1 border border-blue-400 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                            />
                            <button onClick={handleSaveRename} disabled={saving} aria-label="Guardar nombre" className="text-green-600 hover:text-green-700 disabled:opacity-50">
                                <Check className="h-4 w-4" />
                            </button>
                            <button onClick={() => { setEditing(false); setEditName(room.name) }} aria-label="Cancelar edición" className="text-gray-400 hover:text-gray-600">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                        <h3 className="font-bold text-gray-800 text-lg leading-tight">{room.name}</h3>
                    )}
                    {isOwner && !editing && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium whitespace-nowrap ml-2">
                            Propietario
                        </span>
                    )}
                </div>

                <button
                    onClick={copyId}
                    className="flex items-center gap-1 text-gray-500 text-sm mb-2 hover:text-blue-600 transition-colors group"
                    aria-label="Copiar ID de sala"
                >
                    <Hash className="h-4 w-4" />
                    <span className="font-mono">{room.id}</span>
                    {copied
                        ? <Check className="h-3 w-3 text-green-500 ml-1" />
                        : <Copy className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    }
                </button>

                <div className="flex items-center gap-1 text-gray-500 text-sm mb-5">
                    <Users className="h-4 w-4" /><span>{room.participants.length} participantes</span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={() => navigate(`/room/${room.id}`)}
                    className="flex-1 bg-blue-800 hover:bg-blue-900 text-white py-2 rounded-lg font-medium transition-colors"
                >
                    Entrar
                </button>
                {isOwner && (
                    <>
                        <button
                            onClick={() => { setEditing(true); setEditName(room.name) }}
                            aria-label="Editar nombre de sala"
                            className="p-2 text-gray-400 hover:text-blue-600 border border-gray-200 rounded-lg transition-colors"
                        >
                            <Pencil className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => onDelete(room.id)}
                            aria-label="Eliminar sala"
                            className="p-2 text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg transition-colors"
                        >
                            <Trash2 className="h-5 w-5" />
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
