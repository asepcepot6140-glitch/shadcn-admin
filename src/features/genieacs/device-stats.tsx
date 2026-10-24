import { useMemo } from 'react'
import { Clock, Server, Wifi, WifiOff, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { isStaleDevice } from './device-freshness'
import type { GenieACSDevice } from './genieacs-api'

const TONES = {
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
} as const

type StatCardProps = {
  title: string
  value: number
  description: string
  icon: LucideIcon
  tone: keyof typeof TONES
  loading: boolean
  active: boolean
  onClick: () => void
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
  loading,
  active,
  onClick,
}: StatCardProps) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-pressed={active}
      className='min-w-0 rounded-xl text-start focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
    >
      <Card
        className={cn(
          'gap-1 py-2 transition-colors hover:bg-muted/50 sm:py-1.5',
          active && 'ring-2 ring-primary'
        )}
      >
        <CardHeader className='flex flex-row items-center justify-between gap-2 px-3 py-0 sm:px-4'>
          <CardTitle className='truncate text-xs font-medium sm:text-sm'>
            {title}
          </CardTitle>
          <span className={cn('shrink-0 rounded-md p-1 sm:p-1.5', TONES[tone])}>
            <Icon className='size-3.5 sm:size-4' />
          </span>
        </CardHeader>
        <CardContent className='px-3 py-0 sm:flex sm:items-baseline sm:gap-2 sm:px-4'>
          {loading ? (
            <Skeleton className='h-6 w-12' />
          ) : (
            <div className='text-lg leading-tight font-bold sm:text-xl'>
              {value}
            </div>
          )}
          <p className='hidden truncate text-xs text-muted-foreground sm:block'>
            {description}
          </p>
        </CardContent>
      </Card>
    </button>
  )
}

function percent(part: number, total: number) {
  return total === 0 ? '0%' : `${Math.round((part / total) * 100)}%`
}

type DeviceStatsProps = {
  devices: GenieACSDevice[]
  now: number
  loading: boolean
  statusFilter: string
  onStatusFilterChange: (status: string) => void
}

export function DeviceStats({
  devices,
  now,
  loading,
  statusFilter,
  onStatusFilterChange,
}: DeviceStatsProps) {
  const stats = useMemo(() => {
    const online = devices.filter((device) => device.status === 'online').length
    return {
      total: devices.length,
      online,
      offline: devices.length - online,
      stale: devices.filter((device) => isStaleDevice(device, now)).length,
    }
  }, [devices, now])

  // Clicking the active card clears the filter.
  const toggleStatus = (status: string) =>
    onStatusFilterChange(statusFilter === status ? 'all' : status)

  return (
    <div className='mb-3 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4'>
      <StatCard
        title='Total Devices'
        value={stats.total}
        description='All devices'
        icon={Server}
        tone='blue'
        loading={loading}
        active={statusFilter === 'all'}
        onClick={() => onStatusFilterChange('all')}
      />
      <StatCard
        title='Online'
        value={stats.online}
        description={`${percent(stats.online, stats.total)} of total`}
        icon={Wifi}
        tone='green'
        loading={loading}
        active={statusFilter === 'online'}
        onClick={() => toggleStatus('online')}
      />
      <StatCard
        title='Offline'
        value={stats.offline}
        description={`${percent(stats.offline, stats.total)} of total`}
        icon={WifiOff}
        tone='red'
        loading={loading}
        active={statusFilter === 'offline'}
        onClick={() => toggleStatus('offline')}
      />
      <StatCard
        title='No Inform'
        value={stats.stale}
        description='Needs attention'
        icon={Clock}
        tone='violet'
        loading={loading}
        active={statusFilter === 'stale'}
        onClick={() => toggleStatus('stale')}
      />
    </div>
  )
}
