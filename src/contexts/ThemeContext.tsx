import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ConfigProvider, theme as antdTheme } from 'antd'

type ThemeMode = 'system' | 'light' | 'dark' | 'ember' | 'monokai' | 'oneDarkPro'

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

const darkThemes: ThemeMode[] = ['dark', 'ember', 'monokai', 'oneDarkPro']

const getThemeColors = (themeMode: ThemeMode, systemIsDark: boolean) => {
  // Determine if we should use dark mode
  const isDark = themeMode === 'system' 
    ? systemIsDark 
    : darkThemes.includes(themeMode)

  // Base colors for each theme
  const themeColors: Record<ThemeMode, any> = {
    system: isDark ? {
      colorBgContainer: '#1f1f1f',
      colorBgElevated: '#2a2a2a',
      colorBgLayout: '#141414',
      colorText: '#e8e8e8',
      colorTextSecondary: '#a0a0a0',
      colorBorder: '#3a3a3a'
    } : {
      colorBgContainer: '#ffffff',
      colorBgElevated: '#fafafa',
      colorBgLayout: '#f5f5f5',
      colorText: '#000000',
      colorTextSecondary: '#666666',
      colorBorder: '#d9d9d9'
    },
    light: {
      colorBgContainer: '#ffffff',
      colorBgElevated: '#fafafa',
      colorBgLayout: '#f5f5f5',
      colorText: '#000000',
      colorTextSecondary: '#666666',
      colorBorder: '#d9d9d9'
    },
    dark: {
      colorBgContainer: '#1f1f1f',
      colorBgElevated: '#2a2a2a',
      colorBgLayout: '#141414',
      colorText: '#e8e8e8',
      colorTextSecondary: '#a0a0a0',
      colorBorder: '#3a3a3a'
    },
    ember: {
      colorBgContainer: '#16191f',
      colorBgElevated: '#1e2229',
      colorBgLayout: '#0d0f13',
      colorText: '#e8e8e8',
      colorTextSecondary: '#a0a0a0',
      colorBorder: '#2a2f38'
    },
    monokai: {
      colorBgContainer: '#272822',
      colorBgElevated: '#2f3129',
      colorBgLayout: '#1e1f1c',
      colorText: '#f8f8f2',
      colorTextSecondary: '#a8a897',
      colorBorder: '#3e3d32'
    },
    oneDarkPro: {
      colorBgContainer: '#282c34',
      colorBgElevated: '#2c313a',
      colorBgLayout: '#21252b',
      colorText: '#abb2bf',
      colorTextSecondary: '#5c6370',
      colorBorder: '#3e4451'
    }
  }

  return themeColors[themeMode]
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>('light')
  const [systemIsDark, setSystemIsDark] = useState(false)

  // Check system preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemIsDark(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches)
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Load saved theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('nexworkTheme') as ThemeMode
    if (savedTheme) {
      setThemeState(savedTheme)
    }
  }, [])

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme)
    localStorage.setItem('nexworkTheme', newTheme)
  }

  const isDark = theme === 'system' 
    ? systemIsDark 
    : darkThemes.includes(theme)

  const themeColors = getThemeColors(theme, systemIsDark)

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      <ConfigProvider
        theme={{
          algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          token: {
            colorPrimary: '#1890ff',
            borderRadius: 6,
            ...themeColors
          },
          components: {
            Layout: {
              headerBg: themeColors.colorBgContainer,
              siderBg: themeColors.colorBgContainer,
              bodyBg: themeColors.colorBgLayout
            },
            Card: {
              colorBgContainer: themeColors.colorBgContainer
            },
            Menu: {
              colorBgContainer: themeColors.colorBgContainer,
              itemBg: themeColors.colorBgContainer
            }
          }
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}
