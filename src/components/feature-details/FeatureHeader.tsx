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
    <div style={{ marginBottom: 20 }}>
      {/* Back link */}
      <Button
        type="text"
        icon={<ArrowLeft size={14} />}
        onClick={onBack}
        size="small"
        style={{ padding: '4px 8px', marginBottom: 12, opacity: 0.6 }}
      >
        Dashboard
      </Button>

      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <Title level={3} style={{ margin: 0, wordBreak: 'break-word', fontWeight: 700 }}>
          {feature.name}
        </Title>
        {getProgressTag()}
      </div>

      {/* Metadata row */}
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
  )
}
