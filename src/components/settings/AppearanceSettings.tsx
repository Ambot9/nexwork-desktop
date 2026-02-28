import { Card, Space, Typography, Row, Col, Alert } from 'antd'
import { Monitor } from 'lucide-react'
import { SelectableCard } from '../SelectableCard'
import { themes } from '../../types/theme'
import type { ThemeMode } from '../../types/theme'

const { Text } = Typography

interface Props {
  selectedTheme: ThemeMode
  onThemeChange: (theme: ThemeMode) => void
  isDark: boolean
}

export function AppearanceSettings({ selectedTheme, onThemeChange, isDark }: Props) {
  return (
    <Card title="Appearance">
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Text strong style={{ fontSize: 16 }}>
            Theme
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Customize how Nexwork looks on your device
          </Text>
        </div>

        <Row gutter={[16, 16]}>
          {themes.map((theme) => (
            <Col xs={24} sm={12} md={8} key={theme.id}>
              <SelectableCard
                selected={selectedTheme === theme.id}
                onClick={() => onThemeChange(theme.id)}
                isDark={isDark}
                checkmarkPosition="bottom-right"
              >
                <div style={{ display: 'flex', flexDirection: 'column', minHeight: 160 }}>
                  <div
                    style={{
                      flex: 1,
                      background: theme.background,
                      border: theme.id === 'light' ? '1px solid rgba(0,0,0,0.06)' : 'none',
                      borderRadius: 6,
                      padding: 12,
                      minHeight: 100,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {theme.id === 'system' ? (
                      <Monitor size={32} color="#888" />
                    ) : (
                      <div style={{ width: '100%' }}>
                        <div
                          style={{
                            color: theme.textColors.prompt,
                            fontSize: 11,
                            marginBottom: 4,
                            fontFamily: 'monospace',
                          }}
                        >
                          $ npm run dev
                        </div>
                        <div
                          style={{
                            color: theme.textColors.command,
                            fontSize: 10,
                            fontFamily: 'monospace',
                            marginBottom: 4,
                          }}
                        >
                          Starting development server...
                        </div>
                        <div
                          style={{
                            color: theme.textColors.output,
                            fontSize: 10,
                            fontFamily: 'monospace',
                            marginBottom: 8,
                          }}
                        >
                          Ready on http://localhost:3000
                        </div>
                        {theme.dots && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            {theme.dots.map((color, idx) => (
                              <div
                                key={idx}
                                style={{ width: 10, height: 10, borderRadius: '50%', background: color }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                      paddingTop: 12,
                      paddingBottom: 12,
                      paddingRight: selectedTheme === theme.id ? 40 : 0,
                    }}
                  >
                    <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 2 }}>
                      {theme.name}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {theme.author}
                    </Text>
                  </div>
                </div>
              </SelectableCard>
            </Col>
          ))}
        </Row>

        <Alert
          message={`Theme: ${themes.find((t) => t.id === selectedTheme)?.name}`}
          description="Theme changes are applied instantly."
          type="success"
          showIcon
        />
      </Space>
    </Card>
  )
}
