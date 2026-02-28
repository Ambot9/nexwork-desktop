import { Component, ReactNode } from 'react'
import { Button, Typography } from 'antd'
import { AlertTriangle, RotateCcw } from 'lucide-react'

const { Text, Title } = Typography

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 48,
            gap: 16,
            minHeight: 300,
          }}
        >
          <AlertTriangle size={40} style={{ opacity: 0.4 }} />
          <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
            {this.props.fallbackTitle || 'Something went wrong'}
          </Title>
          <Text type="secondary" style={{ maxWidth: 400, textAlign: 'center' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </Text>
          <Button icon={<RotateCcw size={14} />} onClick={this.handleReset} style={{ marginTop: 8 }}>
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
