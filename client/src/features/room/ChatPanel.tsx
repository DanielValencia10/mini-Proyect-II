import { X } from "lucide-react";
import { useEffect, useRef } from "react";

const MAX_CHARS = 500;

interface Message {
  id: number;
  author: string;
  text: string;
}
interface Props {
  messages: Message[];
  message: string;
  onClose: () => void;
  onChange: (v: string) => void;
  onSend: () => void;
  currentUserName: string;
}
export function ChatPanel({
  messages,
  message,
  onClose,
  onChange,
  onSend,
  currentUserName,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const remaining = MAX_CHARS - message.length;
  const canSend = message.trim().length > 0 && remaining >= 0;

  return (
    <aside className="fixed sm:static bottom-0 sm:bottom-auto left-0 sm:left-auto right-0 sm:inset-y-0 h-[55vh] sm:h-auto w-full sm:w-80 min-w-0 sm:shrink-0 bg-gray-900 border-t sm:border-t-0 sm:border-l border-gray-800 flex flex-col z-40 shadow-2xl sm:shadow-none rounded-t-2xl sm:rounded-none">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <span className="font-semibold text-sm">Chat</span>
        <button onClick={onClose} className="text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded p-0.5 focus:outline-none">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        className="flex-1 min-w-0 overflow-y-auto p-4 space-y-3"
        aria-live="polite"
        aria-label="Mensajes del chat"
      >
        {messages.length === 0 ? (
          <p className="text-gray-500 text-sm text-center mt-4">
            ¡No hay mensajes aún!
          </p>
        ) : (
          messages.map((m, i) => {
            const isMine = m.author === currentUserName;
            return (
              <div
                key={`${m.id}-${i}`}
                className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
              >
                <p
                  className={`text-xs font-medium ${isMine ? "text-cyan-400" : "text-gray-400"}`}
                >
                  {isMine ? "Tú" : m.author}
                </p>
                <div
                  className={`mt-0.5 max-w-[90%] min-w-0 rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm break-all whitespace-pre-wrap overflow-hidden ${
                    isMine
                       ? "bg-cyan-500 text-gray-950"
                       : "bg-gray-800 text-gray-200"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-gray-800 flex flex-col gap-1">
        <div className="flex gap-2">
          <input
            value={message}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CHARS) onChange(e.target.value);
            }}
            onKeyDown={(e) => e.key === "Enter" && canSend && onSend()}
            placeholder="Escribe un mensaje..."
            maxLength={MAX_CHARS}
            autoFocus
            className="flex-1 bg-gray-800 text-white text-xs sm:text-sm rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus:outline-none placeholder-gray-500 outline-none"
          />
          <button
            onClick={onSend}
            disabled={!canSend}
            className="bg-cyan-500 hover:bg-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-950 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus:outline-none"
          >
            ↑
          </button>
        </div>
        {message.length > 0 && (
          <p
            className={`text-xs text-right ${remaining < 50 ? "text-amber-400" : "text-gray-500"}`}
          >
            {remaining} caracteres restantes
          </p>
        )}
      </div>
    </aside>
  );
}
