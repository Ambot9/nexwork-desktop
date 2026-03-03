import { useState, useEffect, useRef } from 'react'
import { App, Button, Input, Typography, Spin, theme } from 'antd'
import { FolderGit2, Github, ArrowRight, Copy, Check, Globe, Cloud, ChevronLeft } from 'lucide-react'

const { Title, Text } = Typography

interface GitAuthProps {
  onAuthenticated: (info: { provider: string; user: string; avatar: string }) => void
}

export function GitAuth({ onAuthenticated }: GitAuthProps) {
  const { message } = App.useApp()
  const [gitlabToken, setGitlabToken] = useState('')
  const [gitlabUrl, setGitlabUrl] = useState('')
  const [loading, setLoading] = useState<'github' | 'gitlab' | null>(null)
  const [authCode, setAuthCode] = useState<string | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)
  const [gitlabStep, setGitlabStep] = useState<'idle' | 'choose' | 'cloud' | 'self-hosted'>('idle')
  const cleanupRef = useRef<(() => void) | null>(null)
  const {
    token: { colorBgContainer, colorBgElevated, colorBorder, colorTextSecondary },
  } = theme.useToken()

  useEffect(() => {
    return () => {
      cleanupRef.current?.()
    }
  }, [])

  const handleCopyCode = async () => {
    if (!authCode) return
    try {
      await navigator.clipboard.writeText(authCode)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const startAuthCodeListener = () => {
    cleanupRef.current?.()
    cleanupRef.current = window.nexworkAPI.gitAuth.onAuthCode((code) => setAuthCode(code))
  }

  const cleanupListener = () => {
    cleanupRef.current?.()
    cleanupRef.current = null
  }

  const saveAndFinish = async (provider: string, user: string, avatar: string) => {
    await window.nexworkAPI.gitAuth.saveAuth({ provider, user, avatar })
    message.success(`Connected as ${user}`)
    onAuthenticated({ provider, user, avatar })
  }

  const handleGitHubLogin = async () => {
    if (loading) return
    setLoading('github')
    setAuthCode(null)
    startAuthCodeListener()
    try {
      const result = await window.nexworkAPI.gitAuth.githubLogin()
      cleanupListener()
      if (!result.success) {
        message.error(result.error || 'GitHub authentication failed')
        return
      }
      await saveAndFinish('github', result.user || 'GitHub User', result.avatar || '')
    } catch (error: any) {
      cleanupListener()
      message.error(error.message || 'GitHub login failed')
    } finally {
      setLoading(null)
      setAuthCode(null)
    }
  }

  const handleGitLabClick = async () => {
    if (loading) return
    if (gitlabStep !== 'idle') return
    setLoading('gitlab')
    startAuthCodeListener()
    try {
      const result = await window.nexworkAPI.gitAuth.gitlabLogin()
      cleanupListener()
      if (result.success) {
        await saveAndFinish('gitlab', result.user || 'GitLab User', result.avatar || '')
        return
      }
      if (result.error !== 'not_installed') {
        message.error(result.error || 'GitLab authentication failed')
        return
      }
    } catch {
      cleanupListener()
    }
    setLoading(null)
    setAuthCode(null)
    setGitlabStep('choose')
  }

  const handleGitLabCloud = () => {
    setGitlabStep('cloud')
    window.nexworkAPI.runCommand(
      'open "https://gitlab.com/-/user_settings/personal_access_tokens?name=Nexwork&scopes=api,read_user"',
    )
  }

  const handleGitLabSelfHosted = () => {
    setGitlabStep('self-hosted')
  }

  const handleGitLabTokenSubmit = async () => {
    if (!gitlabToken.trim()) {
      message.warning('Please paste the token')
      return
    }
    const baseUrl =
      gitlabStep === 'self-hosted' && gitlabUrl.trim() ? gitlabUrl.trim().replace(/\/+$/, '') : 'https://gitlab.com'
    setLoading('gitlab')
    try {
      const result = await window.nexworkAPI.runCommand(
        `curl -s -H "PRIVATE-TOKEN: ${gitlabToken.trim()}" ${baseUrl}/api/v4/user`,
      )
      if (!result.success) {
        message.error('Failed to validate token')
        return
      }
      let userData: any
      try {
        userData = JSON.parse(result.output)
      } catch {
        message.error('Invalid response — check the URL')
        return
      }
      if (userData.message === '401 Unauthorized' || userData.error) {
        message.error('Invalid token — check scopes and try again')
        return
      }
      await saveAndFinish('gitlab', userData.username || 'GitLab User', userData.avatar_url || '')
    } catch (error: any) {
      message.error(error.message || 'GitLab login failed')
    } finally {
      setLoading(null)
    }
  }

  const handleSkip = async () => {
    await window.nexworkAPI.gitAuth.saveAuth({ provider: 'local', user: 'Local Mode', avatar: '' })
    onAuthenticated({ provider: 'local', user: 'Local Mode', avatar: '' })
  }

  // ── Main view: provider selection ──
  if (gitlabStep === 'idle' && !authCode) {
    return (
      <Page>
        <Logo />
        <Heading title="Welcome to Nexwork" subtitle="Connect your Git provider to get started." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <ProviderButton
            icon={<Github size={18} />}
            iconBg={colorBgContainer === '#ffffff' ? '#24292e' : '#e5e5e5'}
            iconColor={colorBgContainer === '#ffffff' ? '#fff' : '#1a1a1a'}
            label="Continue with GitHub"
            loading={loading === 'github'}
            disabled={loading !== null}
            onClick={handleGitHubLogin}
          />
          <ProviderButton
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0118.6 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51L23 13.45a.84.84 0 01-.35.94z" />
              </svg>
            }
            iconBg="#FC6D26"
            iconColor="#fff"
            label="Continue with GitLab"
            loading={loading === 'gitlab'}
            disabled={loading !== null}
            onClick={handleGitLabClick}
          />
        </div>
        <Divider />
        <SkipButton onClick={handleSkip} disabled={loading !== null} />
      </Page>
    )
  }

  // ── Auth code view (GitHub / GitLab CLI waiting) ──
  if (authCode) {
    return (
      <Page>
        <Logo />
        <Heading title="Authorize in Browser" subtitle="Enter this one-time code on the page we opened." />
        <div
          style={{
            textAlign: 'center',
            padding: '28px 20px',
            borderRadius: 16,
            border: `1px solid ${colorBorder}`,
            background: colorBgElevated,
            marginTop: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Text
              strong
              style={{
                fontSize: 32,
                letterSpacing: 6,
                fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
                color: 'var(--color-accent)',
              }}
            >
              {authCode}
            </Text>
            <Button
              type="text"
              size="small"
              icon={codeCopied ? <Check size={16} /> : <Copy size={16} />}
              onClick={handleCopyCode}
              style={{
                color: codeCopied ? 'var(--color-success)' : colorTextSecondary,
                marginTop: 2,
              }}
            />
          </div>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Spin size="small" />
            <Text type="secondary" style={{ fontSize: 13 }}>
              Waiting for authorization...
            </Text>
          </div>
        </div>
      </Page>
    )
  }

  // ── GitLab: choose instance ──
  if (gitlabStep === 'choose') {
    return (
      <Page>
        <Logo />
        <Heading title="Choose GitLab Instance" subtitle="Where is your GitLab hosted?" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <ProviderButton
            icon={<Cloud size={18} />}
            iconBg="#FC6D26"
            iconColor="#fff"
            label="GitLab.com"
            onClick={handleGitLabCloud}
          />
          <ProviderButton
            icon={<Globe size={18} />}
            iconBg="rgba(128,128,128,0.15)"
            iconColor="inherit"
            label="Self-hosted GitLab"
            onClick={handleGitLabSelfHosted}
          />
        </div>
        <BackLink onClick={() => setGitlabStep('idle')} />
      </Page>
    )
  }

  // ── GitLab: paste token (cloud or self-hosted) ──
  return (
    <Page>
      <Logo />
      <Heading
        title={gitlabStep === 'self-hosted' ? 'Self-hosted GitLab' : 'GitLab.com'}
        subtitle={
          gitlabStep === 'self-hosted'
            ? 'Enter your instance URL and personal access token.'
            : 'Paste the token from the page we just opened.'
        }
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          marginTop: 8,
        }}
      >
        {gitlabStep === 'self-hosted' && (
          <Input
            placeholder="https://gitlab.yourcompany.com"
            value={gitlabUrl}
            onChange={(e) => setGitlabUrl(e.target.value)}
            disabled={loading !== null}
            size="large"
            style={{ borderRadius: 10 }}
            autoFocus
          />
        )}
        <Input
          placeholder={gitlabStep === 'self-hosted' ? 'Personal access token' : 'glpat-xxxxxxxxxxxxxxxxxxxx'}
          value={gitlabToken}
          onChange={(e) => setGitlabToken(e.target.value)}
          disabled={loading !== null}
          onPressEnter={handleGitLabTokenSubmit}
          size="large"
          style={{ borderRadius: 10 }}
          autoFocus={gitlabStep === 'cloud'}
        />
        <Button
          type="primary"
          size="large"
          block
          loading={loading === 'gitlab'}
          disabled={loading !== null && loading !== 'gitlab'}
          onClick={handleGitLabTokenSubmit}
          style={{ borderRadius: 10, height: 44, fontWeight: 500 }}
        >
          Connect
        </Button>
      </div>
      <BackLink
        onClick={() => {
          setGitlabStep('choose')
          setGitlabToken('')
          setGitlabUrl('')
        }}
      />
    </Page>
  )
}

// ── Shared sub-components ──

function Page({ children }: { children: React.ReactNode }) {
  const {
    token: { colorBgElevated },
  } = theme.useToken()
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        overflow: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          animation: 'fadeIn 0.35s ease',
          background: colorBgElevated,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 20,
          padding: '40px 32px 32px',
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255,255,255,0.04) inset',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Logo() {
  return (
    <div style={{ textAlign: 'center', marginBottom: 8 }}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 15,
          background: 'linear-gradient(140deg, #4f6ef7 0%, #7c5cfc 100%)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 6px 24px rgba(79, 110, 247, 0.3)',
        }}
      >
        <FolderGit2 size={24} style={{ color: '#fff' }} />
      </div>
    </div>
  )
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  const {
    token: { colorText, colorTextSecondary },
  } = theme.useToken()
  return (
    <div style={{ textAlign: 'center', marginBottom: 28 }}>
      <Title level={3} style={{ margin: '16px 0 0', fontWeight: 700, letterSpacing: '-0.3px', color: colorText }}>
        {title}
      </Title>
      <Text style={{ fontSize: 13, display: 'block', marginTop: 6, lineHeight: 1.5, color: colorTextSecondary }}>
        {subtitle}
      </Text>
    </div>
  )
}

function ProviderButton({
  icon,
  iconBg,
  iconColor,
  label,
  loading: isLoading,
  disabled,
  onClick,
}: {
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  label: string
  loading?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  const {
    token: { colorBgElevated, colorBorder, colorText },
  } = theme.useToken()

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '12px 16px',
        borderRadius: 12,
        border: `1px solid ${colorBorder}`,
        background: colorBgElevated,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !isLoading ? 0.5 : 1,
        transition: 'all 150ms ease',
        outline: 'none',
        color: colorText,
        fontSize: 14,
        fontWeight: 500,
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = 'var(--color-accent)'
          e.currentTarget.style.boxShadow = '0 2px 12px rgba(79, 110, 247, 0.1)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = colorBorder
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: iconBg,
          color: iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
      {isLoading ? <Spin size="small" /> : <ArrowRight size={16} style={{ opacity: 0.3 }} />}
    </button>
  )
}

function SkipButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  const {
    token: { colorTextSecondary },
  } = theme.useToken()
  return (
    <div style={{ textAlign: 'center' }}>
      <button
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        style={{
          background: 'none',
          border: 'none',
          color: colorTextSecondary,
          fontSize: 13,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 0.6,
          padding: '4px 8px',
          fontFamily: 'inherit',
          transition: 'opacity 150ms',
        }}
        onMouseEnter={(e) => {
          if (!disabled) e.currentTarget.style.opacity = '1'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = disabled ? '0.4' : '0.6'
        }}
      >
        Skip — continue without login
      </button>
    </div>
  )
}

function Divider() {
  const {
    token: { colorBorder, colorTextSecondary },
  } = theme.useToken()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '20px 0' }}>
      <div style={{ flex: 1, height: 1, background: colorBorder }} />
      <Text style={{ fontSize: 11, color: colorTextSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>or</Text>
      <div style={{ flex: 1, height: 1, background: colorBorder }} />
    </div>
  )
}

function BackLink({ onClick }: { onClick: () => void }) {
  const {
    token: { colorTextSecondary },
  } = theme.useToken()
  return (
    <div style={{ textAlign: 'center', marginTop: 20 }}>
      <button
        onClick={onClick}
        style={{
          background: 'none',
          border: 'none',
          color: colorTextSecondary,
          fontSize: 13,
          cursor: 'pointer',
          padding: '4px 8px',
          fontFamily: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          opacity: 0.6,
          transition: 'opacity 150ms',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.6'
        }}
      >
        <ChevronLeft size={14} />
        Back
      </button>
    </div>
  )
}
