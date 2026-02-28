import { Card, Space, Typography, Tooltip, Switch, Divider, Row, Col, Button, Alert } from 'antd'
import {
  Play,
  Square,
  Music,
  Bell,
  Zap,
  CircleDot,
  Radio,
  Headphones,
  Volume2,
  Bot,
  Info,
  HelpCircle,
} from 'lucide-react'
import { SelectableCard } from '../SelectableCard'
import { playNotificationSound, stopNotificationSound } from '../../utils/sounds'
import { useState } from 'react'

const { Text } = Typography

interface NotificationSound {
  id: string
  name: string
  description: string
  icon: any
  duration: string
  emoji: string
}

const notificationSounds: NotificationSound[] = [
  {
    id: 'shamisen',
    name: 'Shamisen',
    description: 'Japanese string instrument',
    icon: Music,
    duration: '1s',
    emoji: '&#127930;',
  },
  {
    id: 'arcade',
    name: 'Arcade',
    description: 'Retro game sounds',
    icon: CircleDot,
    duration: '3s',
    emoji: '&#128377;',
  },
  { id: 'ping', name: 'Ping', description: 'Quick alert tone', icon: Bell, duration: '1s', emoji: '&#128205;' },
  { id: 'quickPing', name: 'Quick Ping', description: 'Short & sweet', icon: Zap, duration: '3s', emoji: '&#9889;' },
  { id: 'dooWap', name: 'Doo-Wap', description: 'Retro vibes', icon: Radio, duration: '10s', emoji: '&#127927;' },
  {
    id: 'agentDone',
    name: 'Agent is Done',
    description: 'Your agent is done!',
    icon: Bot,
    duration: '8s',
    emoji: '&#129302;',
  },
  {
    id: 'codeComplete',
    name: 'Code Complete',
    description: 'World music energy',
    icon: Volume2,
    duration: '9s',
    emoji: '&#127757;',
  },
  {
    id: 'afrobeatComplete',
    name: 'Afrobeat Code Complete',
    description: 'Groovy celebration',
    icon: Music,
    duration: '9s',
    emoji: '&#129345;',
  },
  {
    id: 'longEDM',
    name: 'Long EDM',
    description: 'Bass goes brrrr',
    icon: Headphones,
    duration: '56s',
    emoji: '&#127911;',
  },
  { id: 'comeBack', name: 'Come Back!', description: 'Code needs you', icon: Bell, duration: '7s', emoji: '&#128226;' },
  {
    id: 'shabalaba',
    name: 'Shabalaba',
    description: 'Ding dong vibes',
    icon: Music,
    duration: '7s',
    emoji: '&#127881;',
  },
]

interface Props {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  selectedSound: string
  onSoundChange: (sound: string) => void
  isDark: boolean
}

export function NotificationSettings({ enabled, onEnabledChange, selectedSound, onSoundChange, isDark }: Props) {
  const [playingSound, setPlayingSound] = useState<string | null>(null)

  const handlePlaySound = async (soundId: string, duration: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (playingSound === soundId) {
      stopNotificationSound()
      setPlayingSound(null)
    } else {
      try {
        stopNotificationSound()
        setPlayingSound(soundId)
        await playNotificationSound(soundId)
        setTimeout(() => setPlayingSound(null), parseFloat(duration) * 1000)
      } catch {
        setPlayingSound(null)
      }
    }
  }

  return (
    <Card
      title={
        <Space>
          Notifications
          <Tooltip
            title={
              <div>
                <div>
                  <strong>When do notifications play?</strong>
                </div>
                <div style={{ marginTop: 8 }}>
                  Nexwork plays sounds when git operations complete, builds finish, and features are created.
                </div>
              </div>
            }
          >
            <Info size={16} style={{ color: '#888', cursor: 'help' }} />
          </Tooltip>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Text type="secondary" style={{ fontSize: 12 }}>
          Get audio alerts when long-running tasks complete
        </Text>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Space>
              <Text strong>Notification sounds</Text>
              <Tooltip title="Enable/disable sound alerts for completed operations">
                <HelpCircle size={14} style={{ color: 'var(--color-accent)', cursor: 'help' }} />
              </Tooltip>
            </Space>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Play a sound when tasks complete
            </Text>
          </div>
          <Switch checked={enabled} onChange={onEnabledChange} />
        </div>

        {enabled && (
          <>
            <Divider style={{ margin: '8px 0' }} />
            <Text strong style={{ fontSize: 14 }}>
              Notification Sound
            </Text>

            <Row gutter={[16, 16]}>
              {notificationSounds.map((sound) => (
                <Col xs={24} sm={12} md={8} key={sound.id}>
                  <SelectableCard
                    selected={selectedSound === sound.id}
                    onClick={() => onSoundChange(sound.id)}
                    isDark={isDark}
                    checkmarkPosition="bottom-right"
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 160 }}>
                      <div
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          padding: '16px 0',
                        }}
                      >
                        <div style={{ position: 'absolute', top: 8, right: 8 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {sound.duration}
                          </Text>
                        </div>
                        <div
                          style={{ fontSize: 40, lineHeight: 1 }}
                          dangerouslySetInnerHTML={{ __html: sound.emoji }}
                        />
                        <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
                          <Button
                            type="default"
                            shape="circle"
                            size="large"
                            icon={playingSound === sound.id ? <Square size={18} /> : <Play size={18} />}
                            onClick={(e) => handlePlaySound(sound.id, sound.duration, e)}
                          />
                        </div>
                      </div>
                      <div
                        style={{
                          borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                          paddingTop: 12,
                          paddingBottom: 12,
                          paddingRight: selectedSound === sound.id ? 40 : 0,
                        }}
                      >
                        <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 2 }}>
                          {sound.name}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {sound.description}
                        </Text>
                      </div>
                    </div>
                  </SelectableCard>
                </Col>
              ))}
            </Row>

            <Alert
              message="Preview sounds"
              description="Click the play button to preview. Click stop or play another to stop."
              type="info"
              showIcon
              style={{ marginTop: 8 }}
            />
          </>
        )}
      </Space>
    </Card>
  )
}
