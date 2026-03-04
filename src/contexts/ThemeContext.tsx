import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ConfigProvider, theme as antdTheme } from 'antd'
import { darkThemes } from '../types/theme'
import type { ThemeMode } from '../types/theme'

interface ThemeContextType {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  children: ReactNode
}

const getThemeColors = (themeMode: ThemeMode, systemIsDark: boolean) => {
  const isDark = themeMode === 'system' ? systemIsDark : darkThemes.includes(themeMode)

  const themeColors: Record<ThemeMode, any> = {
    system: isDark
      ? {
          colorBgContainer: '#1a1a1a',
          colorBgElevated: '#242424',
          colorBgLayout: '#111111',
          colorText: '#e5e5e5',
          colorTextSecondary: '#a0a0a0',
          colorBorder: '#2e2e2e',
        }
      : {
          colorBgContainer: '#ffffff',
          colorBgElevated: '#f9fafb',
          colorBgLayout: '#f4f6fa',
          colorText: '#111827',
          colorTextSecondary: '#6b7280',
          colorBorder: '#e5e7eb',
        },
    light: {
      colorBgContainer: '#ffffff',
      colorBgElevated: '#f9fafb',
      colorBgLayout: '#f4f6fa',
      colorText: '#111827',
      colorTextSecondary: '#6b7280',
      colorBorder: '#e5e7eb',
    },
    dark: {
      colorBgContainer: '#1b1f27',
      colorBgElevated: '#222734',
      colorBgLayout: '#11131a',
      colorText: '#e5e7eb',
      colorTextSecondary: '#94a3b8',
      colorBorder: '#2b3242',
    },
    ember: {
      colorBgContainer: '#16191f',
      colorBgElevated: '#1c2027',
      colorBgLayout: '#0e1015',
      colorText: '#e5e5e5',
      colorTextSecondary: '#8b8fa0',
      colorBorder: '#252a33',
    },
    monokai: {
      colorBgContainer: '#272822',
      colorBgElevated: '#2d2e27',
      colorBgLayout: '#1e1f1c',
      colorText: '#f8f8f2',
      colorTextSecondary: '#a8a897',
      colorBorder: '#3e3d32',
    },
    oneDarkPro: {
      colorBgContainer: '#282c34',
      colorBgElevated: '#2c313a',
      colorBgLayout: '#21252b',
      colorText: '#abb2bf',
      colorTextSecondary: '#5c6370',
      colorBorder: '#3e4451',
    },
  }

  return themeColors[themeMode]
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('nexworkTheme') as ThemeMode
    return saved || 'light'
  })
  const [systemIsDark, setSystemIsDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme)
    localStorage.setItem('nexworkTheme', newTheme)
  }

  const isDark = theme === 'system' ? systemIsDark : darkThemes.includes(theme)
  const themeColors = getThemeColors(theme, systemIsDark)

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      <ConfigProvider
        theme={{
          algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          token: {
            colorPrimary: '#375dfb',
            colorInfo: '#2563eb',
            colorSuccess: '#16a34a',
            colorWarning: '#d97706',
            colorError: '#dc2626',
            colorLink: '#1d4ed8',
            colorTextHeading: themeColors.colorText,
            borderRadius: 10,
            controlHeight: 36,
            fontFamily: "'Inter', 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            ...themeColors,
          },
          components: {
            Layout: {
              headerBg: themeColors.colorBgContainer,
              siderBg: themeColors.colorBgContainer,
              bodyBg: themeColors.colorBgLayout,
            },
            Card: {
              colorBgContainer: themeColors.colorBgContainer,
              borderRadiusLG: 14,
            },
            Menu: {
              colorBgContainer: themeColors.colorBgContainer,
              itemBg: themeColors.colorBgContainer,
              itemBorderRadius: 10,
              itemMarginInline: 8,
            },
            Button: {
              borderRadius: 10,
              fontWeight: 600,
            },
            Input: {
              borderRadius: 10,
            },
            Select: {
              borderRadius: 10,
            },
            Tag: {
              borderRadius: 999,
              fontWeight: 600,
            },
          },
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}
