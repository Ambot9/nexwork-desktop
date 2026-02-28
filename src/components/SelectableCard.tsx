import { ReactNode } from 'react'
import { Check } from 'lucide-react'

interface SelectableCardProps {
  selected: boolean
  onClick: () => void
  isDark: boolean
  children: ReactNode
  checkmarkPosition?: 'top-right' | 'bottom-right'
}

export function SelectableCard({
  selected,
  onClick,
  isDark,
  children,
  checkmarkPosition = 'top-right',
}: SelectableCardProps) {
  const checkmarkStyle = checkmarkPosition === 'bottom-right' ? { bottom: 45, right: 30 } : { top: 12, right: 12 }

  return (
    <div
      onClick={onClick}
      style={{
        border: selected
          ? '2px solid var(--color-accent, #4f6ef7)'
          : `2px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: 12,
        padding: 16,
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 200ms ease',
        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.01)',
      }}
    >
      {selected && (
        <div
          style={{
            position: 'absolute',
            ...checkmarkStyle,
            background: 'var(--color-accent, #4f6ef7)',
            borderRadius: '50%',
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <Check size={14} color="#fff" />
        </div>
      )}
      {children}
    </div>
  )
}
