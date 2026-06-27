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
    <aside className="absolute inset-0 sm:relative z-40 w-full sm:w-80 min-w-0 shrink-0 bg-gray-900 sm:border-l border-gray-800 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <span className="font-semibold text-sm">Chat</span>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
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
                  className={`mt-0.5 max-w-[85%] min-w-0 rounded-xl px-3 py-2 text-sm break-all whitespace-pre-wrap overflow-hidden ${
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
            className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-cyan-500 placeholder-gray-500"
          />
          <button
            onClick={onSend}
            disabled={!canSend}
            className="bg-cyan-500 hover:bg-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-950 px-3 rounded-lg font-bold text-sm transition-colors"
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
