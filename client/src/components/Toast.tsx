import { useEffect } from 'react'

interface Props {
  message: string
  onDismiss: () => void
  duration?: number
}

export default function Toast({ message, onDismiss, duration = 3000 }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration)
    return () => clearTimeout(timer)
  }, [onDismiss, duration])

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg animate-toast"
    >
      <span className="text-lg" aria-hidden="true">✓</span>
      <p className="text-sm font-medium">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar notificación"
        className="ml-1 opacity-70 hover:opacity-100 text-lg leading-none focus:outline-none focus:ring-2 focus:ring-white rounded"
      >
        ×
      </button>
    </div>
  )
}
