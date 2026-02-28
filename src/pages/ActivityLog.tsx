import { useState, useEffect, useCallback } from 'react'
import { Typography, Space, Timeline, Tag, Card, Segmented, Empty, Spin } from 'antd'
import { GitCommitHorizontal, GitMerge, Plus, Trash2, CheckCircle2, ArrowDown, ArrowUp, Activity } from 'lucide-react'
import type { ActivityRecord } from '../types'

const { Title, Text, Paragraph } = Typography

const TYPE_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  create: { color: 'green', icon: <Plus size={14} />, label: 'Created' },
  update: { color: 'blue', icon: <Activity size={14} />, label: 'Updated' },
  delete: { color: 'red', icon: <Trash2 size={14} />, label: 'Deleted' },
  complete: { color: 'green', icon: <CheckCircle2 size={14} />, label: 'Completed' },
  push: { color: 'purple', icon: <ArrowUp size={14} />, label: 'Pushed' },
  pull: { color: 'cyan', icon: <ArrowDown size={14} />, label: 'Pulled' },
}

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

function groupByDate(activities: ActivityRecord[]): Record<string, ActivityRecord[]> {
  const groups: Record<string, ActivityRecord[]> = {}
  for (const a of activities) {
    const date = new Date(a.timestamp).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
    if (!groups[date]) groups[date] = []
    groups[date].push(a)
  }
  return groups
}

export function ActivityLog() {
  const [activities, setActivities] = useState<ActivityRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<number>(24)

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true)
      const result = await window.nexworkAPI.activity.getRecent(range)
      if (result.success) {
        setActivities(result.activities || [])
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    loadActivities()
  }, [loadActivities])

  const grouped = groupByDate(activities)

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Title level={2} style={{ marginBottom: 4 }}>
            Activity
          </Title>
          <Paragraph type="secondary">Recent actions across your features and projects.</Paragraph>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Segmented
            value={range}
            onChange={(v) => setRange(v as number)}
            options={[
              { label: 'Last 24h', value: 24 },
              { label: 'Last 7d', value: 168 },
              { label: 'Last 30d', value: 720 },
            ]}
            size="small"
          />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin />
          </div>
        ) : activities.length === 0 ? (
          <Card style={{ borderRadius: 12 }}>
            <Empty description="No activity recorded yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </Card>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <Text type="secondary" strong style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                {date}
              </Text>
              <Timeline
                items={items.map((a) => {
                  const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.update
                  return {
                    color: cfg.color,
                    dot: cfg.icon,
                    children: (
                      <div style={{ paddingBottom: 4 }}>
                        <Space size={8} style={{ marginBottom: 2 }}>
                          <Tag color={cfg.color} style={{ fontSize: 11 }}>
                            {cfg.label}
                          </Tag>
                          <Text strong style={{ fontSize: 13 }}>
                            {a.featureName}
                          </Text>
                          {a.projectName && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              / {a.projectName}
                            </Text>
                          )}
                        </Space>
                        {a.details && (
                          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                            {a.details}
                          </Text>
                        )}
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                          {formatRelativeTime(a.timestamp)}
                        </Text>
                      </div>
                    ),
                  }
                })}
              />
            </div>
          ))
        )}
      </Space>
    </div>
  )
}
