import { useEffect, useRef } from 'react'
import { AlertCircle } from 'lucide-react'

interface Props {
    open: boolean
    title: string
    message: string
    onClose: () => void
}

export default function AlertDialog({ open, title, message, onClose }: Props) {
    const btnRef = useRef<HTMLButtonElement>(null)
    const previousFocusRef = useRef<HTMLElement | null>(null)

    useEffect(() => {
        if (open) {
            previousFocusRef.current = document.activeElement as HTMLElement
            btnRef.current?.focus()
        } else {
            if (previousFocusRef.current) {
                previousFocusRef.current.focus()
                previousFocusRef.current = null
            }
        }
    }, [open])

    useEffect(() => {
        return () => {
            if (previousFocusRef.current) {
                previousFocusRef.current.focus()
            }
        }
    }, [])

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' || e.key === 'Enter') {
                onClose()
                return
            }
            if (e.key === 'Tab') {
                e.preventDefault()
                btnRef.current?.focus()
            }
        }
        if (open) document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [open, onClose])

    if (!open) return null

    return (
        <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="alert-title"
            aria-describedby="alert-desc"
            className="fixed inset-0 z-50 flex items-center justify-center"
        >
            <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
            <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className="bg-red-100 rounded-full p-2">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <h2 id="alert-title" className="text-lg font-semibold text-gray-900">
                        {title}
                    </h2>
                </div>
                <p id="alert-desc" className="text-gray-500 text-sm mb-6 ml-1">
                    {message}
                </p>
                <div className="flex justify-end">
                    <button
                        ref={btnRef}
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2 text-sm font-medium text-white bg-blue-800 hover:bg-blue-900 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus:outline-none"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    )
}