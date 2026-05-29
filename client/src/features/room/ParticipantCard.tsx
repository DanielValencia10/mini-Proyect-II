interface Props {
    name: string
    speaking: boolean
}

export function ParticipantCard({ name, speaking }: Props) {
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2)

    return (
        <div className={`relative rounded-2xl overflow-hidden w-full h-full min-h-0 flex items-center justify-center transition-all duration-300
      ${speaking
                ? 'bg-gradient-to-br from-blue-950 to-blue-900 ring-2 ring-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)]'
                : 'bg-gradient-to-br from-gray-900 to-gray-800'
            }`}
        >
            <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: 'linear-gradient(rgba(34,211,238,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.5) 1px, transparent 1px)',
                backgroundSize: '30px 30px',
            }} />

            <div className={`relative z-10 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-lg sm:text-xl font-bold
        ${speaking ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(34,211,238,0.6)]' : 'bg-gray-700 text-gray-300'}`}
            >
                {initials}
            </div>

            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <span className="text-white text-xs sm:text-sm font-medium truncate drop-shadow">{name}</span>
                {speaking && (
                    <span className="flex gap-0.5 items-end h-4 ml-2 shrink-0">
                        {[1, 2, 3].map(i => (
                            <span key={i} className="w-1 bg-cyan-400 rounded-full animate-pulse"
                                style={{ height: `${i * 30}%`, animationDelay: `${i * 0.1}s` }}
                            />
                        ))}
                    </span>
                )}
            </div>
        </div>
    )
}