export type ThemeMode = 'system' | 'light' | 'dark' | 'ember' | 'monokai' | 'oneDarkPro'

export interface ThemeOption {
  id: ThemeMode
  name: string
  author: string
  background: string
  textColors: {
    prompt: string
    command: string
    output: string
  }
  dots?: string[]
}

export const darkThemes: ThemeMode[] = ['dark', 'ember', 'monokai', 'oneDarkPro']

export const themes: ThemeOption[] = [
  {
    id: 'system',
    name: 'System',
    author: 'Follows OS preference',
    background: 'linear-gradient(135deg, #1f1f1f 50%, #ffffff 50%)',
    textColors: { prompt: '#888', command: '#888', output: '#888' },
  },
  {
    id: 'light',
    name: 'Light',
    author: 'Nexwork',
    background: '#ffffff',
    textColors: { prompt: '#52c41a', command: '#1890ff', output: '#faad14' },
    dots: ['#ff4d4f', '#52c41a', '#faad14', '#1890ff', '#722ed1', '#13c2c2'],
  },
  {
    id: 'dark',
    name: 'Dark',
    author: 'Nexwork',
    background: '#1f1f1f',
    textColors: { prompt: '#52c41a', command: '#61dafb', output: '#ffd700' },
    dots: ['#ff6b6b', '#4ecdc4', '#ffe66d', '#4a9eff', '#ff6bcb', '#51d9e8'],
  },
  {
    id: 'ember',
    name: 'Ember',
    author: 'Superset',
    background: '#16191f',
    textColors: { prompt: '#52c41a', command: '#61dafb', output: '#d4976c' },
    dots: ['#ff8a80', '#69f0ae', '#ffd180', '#82b1ff', '#ea80fc', '#80d8ff'],
  },
  {
    id: 'monokai',
    name: 'Monokai',
    author: 'Wimer Hazenberg',
    background: '#272822',
    textColors: { prompt: '#52c41a', command: '#61dafb', output: '#d4976c' },
    dots: ['#f92672', '#a6e22e', '#f4bf75', '#66d9ef', '#ae81ff', '#66d9ef'],
  },
  {
    id: 'oneDarkPro',
    name: 'One Dark Pro',
    author: 'Atom',
    background: '#282c34',
    textColors: { prompt: '#98c379', command: '#61afef', output: '#d19a66' },
    dots: ['#e06c75', '#98c379', '#e5c07b', '#61afef', '#c678dd', '#56b6c2'],
  },
]
