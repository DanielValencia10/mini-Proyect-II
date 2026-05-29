interface Props {
  className?: string
}

export default function Skeleton({ className = '' }: Props) {
  return (
    <div
      className={`bg-gray-200 animate-pulse rounded ${className}`}
      aria-hidden="true"
    />
  )
}
