import React from 'react'
import ReactDOM from 'react-dom/client'
import { App as AntApp } from 'antd'
import App from './App'
import { ThemeProvider } from './contexts/ThemeContext'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AntApp>
        <App />
      </AntApp>
    </ThemeProvider>
  </React.StrictMode>,
)


