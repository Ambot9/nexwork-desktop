import { Card, Row, Col, Progress, Typography } from 'antd'
import { TrendingUp, GitCommitHorizontal, FileCode, ArrowUpDown } from 'lucide-react'
import type { FeatureDetailsContext } from './types'

const { Text } = Typography

interface Props {
  ctx: FeatureDetailsContext
}

interface StatCardProps {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: string | number
  extra?: React.ReactNode
  valueColor?: string
}

function StatCard({ icon, iconBg, label, value, extra, valueColor }: StatCardProps) {
  return (
    <Card bodyStyle={{ padding: '16px 20px' }} style={{ height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
            {label}
          </Text>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, color: valueColor }}>{value}</div>
          {extra}
        </div>
      </div>
    </Card>
  )
}

export function FeatureStatsRow({ ctx }: Props) {
  const { stats } = ctx
  if (!stats) return null

  const progress = Math.round((stats.projectStatus.completed / stats.projectStatus.total) * 100)
  const netChange = stats.gitStats.netChange
  const netPrefix = netChange > 0 ? '+' : ''

  return (
    <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          icon={<TrendingUp size={20} color="#4f6ef7" />}
          iconBg="rgba(79,110,247,0.1)"
          label="Progress"
          value={`${progress}%`}
          extra={
            <Progress
              percent={progress}
              showInfo={false}
              size="small"
              strokeColor="#4f6ef7"
              style={{ marginTop: 6, marginBottom: 0 }}
            />
          }
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          icon={<GitCommitHorizontal size={20} color="#722ed1" />}
          iconBg="rgba(114,46,209,0.1)"
          label="Commits"
          value={stats.gitStats.commits}
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          icon={<FileCode size={20} color="#fa8c16" />}
          iconBg="rgba(250,140,22,0.1)"
          label="Files Changed"
          value={stats.gitStats.filesChanged}
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          icon={<ArrowUpDown size={20} color={netChange >= 0 ? '#52c41a' : '#ff4d4f'} />}
          iconBg={netChange >= 0 ? 'rgba(82,196,26,0.1)' : 'rgba(255,77,79,0.1)'}
          label="Net Change"
          value={`${netPrefix}${netChange}`}
          valueColor={netChange >= 0 ? '#52c41a' : '#ff4d4f'}
        />
      </Col>
    </Row>
  )
}
