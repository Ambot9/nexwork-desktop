import { Button, Space, Typography, Tag, Alert } from 'antd'
import { ArrowLeft, Clock, Calendar } from 'lucide-react'
import type { FeatureDetailsContext } from './types'

const { Title, Text } = Typography

interface Props {
  ctx: FeatureDetailsContext
}

export function FeatureHeader({ ctx }: Props) {
  const { feature, stats, onBack } = ctx
  if (!feature) return null

  const progress = stats ? Math.round((stats.projectStatus.completed / stats.projectStatus.total) * 100) : 0
  const projectCount = feature.projects.length

  const getProgressTag = () => {
    if (progress === 100) return <Tag color="success">Completed</Tag>
    if (progress > 0) return <Tag color="processing">In Progress</Tag>
    return <Tag color="default">Not Started</Tag>
  }

  const renderExpiration = () => {
    if (!feature.expiresAt) return null
    const expiresDate = new Date(feature.expiresAt)
    const now = new Date()
    const daysRemaining = Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const isExpired = daysRemaining < 0
    const isExpiringSoon = daysRemaining <= 7 && daysRemaining > 0
    return (
      <Text type={isExpired ? 'danger' : isExpiringSoon ? 'warning' : 'secondary'} style={{ fontSize: 13 }}>
        <Calendar size={12} style={{ marginRight: 4, verticalAlign: '-1px' }} />
        {isExpired ? `Expired ${Math.abs(daysRemaining)}d ago` : `${daysRemaining}d remaining`}
      </Text>
    )
  }

  const renderExpirationAlert = () => {
    if (!feature.expiresAt) return null
    const expiresDate = new Date(feature.expiresAt)
    const now = new Date()
    const daysRemaining = Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const isExpired = daysRemaining < 0
    const isExpiringSoon = daysRemaining <= 7 && daysRemaining > 0
    if (isExpired) {
      return (
        <Alert
          message="Feature Expired"
          description={
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text>{`This feature expired on ${expiresDate.toLocaleDateString()}. Clean it up to keep your workspace organized.`}</Text>
              <Button type="primary" danger size="small" onClick={ctx.handleCleanupExpired}>
                Clean Up Now
              </Button>
            </Space>
          }
          type="error"
          showIcon
          closable
          style={{ marginTop: 12 }}
        />
      )
    } else if (isExpiringSoon) {
      return (
        <Alert
          message={`Expiring in ${daysRemaining} day(s)`}
          type="warning"
          showIcon
          closable
          style={{ marginTop: 12 }}
        />
      )
    }
    return null
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <Button
        type="text"
        icon={<ArrowLeft size={14} />}
        onClick={onBack}
        size="small"
        style={{ padding: '4px 8px', marginBottom: 12, opacity: 0.65 }}
      >
        Dashboard
      </Button>

      <div
        style={{
          padding: '20px 22px',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          borderRadius: 20,
          background:
            'linear-gradient(135deg, rgba(79, 110, 247, 0.08) 0%, rgba(255, 255, 255, 0.96) 48%, rgba(82, 196, 26, 0.05) 100%)',
          boxShadow: '0 16px 40px rgba(15, 23, 42, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          <Title level={2} style={{ margin: 0, wordBreak: 'break-word', fontWeight: 750, letterSpacing: '-0.02em' }}>
            {feature.name}
          </Title>
          {getProgressTag()}
        </div>

        <Text
          type="secondary"
          style={{ display: 'block', fontSize: 14, lineHeight: 1.6, marginBottom: 14, maxWidth: 860 }}
        >
          Track progress, review repository changes, and manage worktrees for this feature from one place.
        </Text>

        <Space size={[8, 8]} wrap style={{ marginBottom: 12 }}>
          <Tag color="blue" style={{ paddingInline: 10 }}>
            {projectCount} project{projectCount !== 1 ? 's' : ''}
          </Tag>
          {stats && (
            <Tag color="geekblue" style={{ paddingInline: 10 }}>
              {stats.projectStatus.completed}/{stats.projectStatus.total} completed
            </Tag>
          )}
          <Tag color="default" style={{ paddingInline: 10 }}>
            Created {new Date(feature.createdAt).toLocaleDateString()}
          </Tag>
        </Space>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            <Clock size={12} style={{ marginRight: 4, verticalAlign: '-1px' }} />
            Created {new Date(feature.createdAt).toLocaleDateString()}
          </Text>
          {feature.startedAt && (
            <Text type="secondary" style={{ fontSize: 13 }}>
              Started {new Date(feature.startedAt).toLocaleDateString()}
            </Text>
          )}
          {renderExpiration()}
        </div>

        {renderExpirationAlert()}
      </div>
    </div>
  )
}
