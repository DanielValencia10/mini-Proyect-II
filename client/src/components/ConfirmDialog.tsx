import { useEffect, useRef } from 'react'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open, title, message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm, onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement
      cancelRef.current?.focus()
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
      if (e.key === 'Escape') {
        onCancel()
        return
      }

      if (e.key === 'Tab') {
        if (!cancelRef.current || !confirmRef.current) return

        const active = document.activeElement
        if (e.shiftKey) {
          // Shift + Tab: if focus is on cancel, wrap around to confirm
          if (active === cancelRef.current) {
            confirmRef.current.focus()
            e.preventDefault()
          }
        } else {
          // Tab: if focus is on confirm, wrap around to cancel
          if (active === confirmRef.current) {
            cancelRef.current.focus()
            e.preventDefault()
          }
        }
      }
    }

    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-desc"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <h2 id="dialog-title" className="text-lg font-semibold text-gray-900 mb-2">
          {title}
        </h2>
        <p id="dialog-desc" className="text-gray-500 text-sm mb-6">
          {message}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus:outline-none"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-800 hover:bg-blue-900 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus:outline-none"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

