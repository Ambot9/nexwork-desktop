import { ReactNode } from 'react'
import { Check } from 'lucide-react'

interface SelectableCardProps {
  selected: boolean
  onClick: () => void
  isDark: boolean
  children: ReactNode
  checkmarkPosition?: 'top-right' | 'bottom-right'
}

export function SelectableCard({ selected, onClick, isDark, children, checkmarkPosition = 'top-right' }: SelectableCardProps) {
  const checkmarkStyle = checkmarkPosition === 'bottom-right' 
    ? { bottom: 45, right: 30 }
    : { top: 12, right: 12 }

  return (
    <div
      onClick={onClick}
      style={{
        border: selected ? '2px solid #1890ff' : (isDark ? '2px solid #3a3a3a' : '2px solid #d9d9d9'),
        borderRadius: 8,
        padding: 16,
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.3s',
        background: isDark ? '#2a2a2a' : '#fafafa'
      }}
    >
      {selected && (
        <div style={{ 
          position: 'absolute',
          ...checkmarkStyle,
          background: '#000',
          borderRadius: '50%',
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10
        }}>
          <Check size={14} color="#fff" />
        </div>
      )}
      {children}
    </div>
  )
}
