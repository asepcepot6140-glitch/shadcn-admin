import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ThemeProvider, createTheme } from '@mui/material'
import { Pencil, Power, PowerOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  MuiDataTable as DataTable,
  type DataTableColumn as Column,
} from '@/components/data-table'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { getMikrotikRouters, type MikrotikRouter } from '../router/mikrotik-api'
import {
  deletePppoeProfile,
  deletePppoeSecret,
  disconnectPppoeActive,
  getPppoeActive,
  getPppoeErrorMessage,
  getPppoeOffline,
  getPppoePools,
  getPppoeProfiles,
  getPppoeQueueNames,
  getPppoeSecrets,
  savePppoeProfile,
  savePppoeSecret,
  setPppoeSecretDisabled,
  type PppoeActiveConnection,
  type PppoeProfile,
  type PppoeProfileInput,
  type PppoePool,
  type PppoeSecret,
  type PppoeSecretInput,
} from './pppoe-api'

interface SecretRow extends PppoeSecret {
  index: number
  flags: string
  localAddress: string
  remoteAddress: string
  callerId: string
  lastLoggedOut: string
  lastCallerId: string
  lastDisconnectReason: string
}

interface ActiveRow extends PppoeActiveConnection {
  index: number
  flags: string
  callerId: string
  sessionId: string
}

interface ProfileRow {
  index: number
  flags: string
  name: string
  localAddress: string
  remoteAddress: string
  rateLimit: string
  onlyOne: string
  insertQueueBefore: string
  parentQueue: string
  addressList: string
  onUp: string
  onDown: string
  comment: string
}

interface Field<T> {
  key: keyof T & string
  label: string
  placeholder: string
  required?: boolean
  options?: string[]
}

interface ConfirmState {
  title: string
  description: string
  actionLabel: string
  destructive?: boolean
  onConfirm: () => Promise<void>
}

const emptySecret: Partial<SecretRow> = {
  name: '',
  password: '',
  service: 'pppoe',
  profile: '',
  local_address: '',
  remote_address: '',
  localAddress: '',
  remoteAddress: '',
  caller_id: '',
  last_logged_out: '',
  last_caller_id: '',
  last_disconnect_reason: '',
  comment: '',
  id: '',
  disabled: false,
  index: 0,
  flags: '',
  callerId: '',
  lastLoggedOut: '',
  lastCallerId: '',
  lastDisconnectReason: '',
}

const emptyProfile: Partial<ProfileRow> = {
  name: '',
  localAddress: '',
  remoteAddress: '',
  rateLimit: '',
  onlyOne: '',
  insertQueueBefore: '',
  parentQueue: '',
  addressList: '',
  onUp: '',
  onDown: '',
  comment: '',
}

const serviceOptions = ['any', 'pppoe', 'pptp', 'l2tp', 'sstp', 'ovpn', 'async']

function lastLoggedOutSortValue(value: string) {
  const match = value.match(
    /^([a-z]{3})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}:\d{2}:\d{2}))?$/i
  )
  if (!match) return null

  const month = [
    'jan',
    'feb',
    'mar',
    'apr',
    'may',
    'jun',
    'jul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec',
  ].indexOf(match[1].toLowerCase())
  if (month < 0) return null

  const [hours = '0', minutes = '0', seconds = '0'] = (
    match[4] ?? '00:00:00'
  ).split(':')
  return new Date(
    Number(match[3]),
    month,
    Number(match[2]),
    Number(hours),
    Number(minutes),
    Number(seconds)
  ).getTime()
}

const secretColumns: Column<SecretRow>[] = [
  {
    header: 'Name',
    cell: (row) => <span className='font-semibold'>{row.name}</span>,
    getSortValue: (row) => row.name,
  },
  {
    header: 'Status',
    cell: (row) => (
      <span
        className={
          row.disabled
            ? 'text-xs font-medium text-destructive'
            : 'text-xs font-medium text-emerald-600 dark:text-emerald-400'
        }
      >
        {row.disabled ? 'Disabled' : 'Enabled'}
      </span>
    ),
    getSortValue: (row) => (row.disabled ? 'Disabled' : 'Enabled'),
  },
  { header: 'Service', cell: (row) => row.service },
  { header: 'Password', cell: (row) => row.password },
  { header: 'Profile', cell: (row) => row.profile },
  { header: 'Local Address', cell: (row) => row.localAddress || '-' },
  { header: 'Remote Address', cell: (row) => row.remoteAddress || '-' },
  {
    header: 'Last Logged Out',
    cell: (row) => row.lastLoggedOut || '-',
    getSortValue: (row) => lastLoggedOutSortValue(row.lastLoggedOut),
  },
  { header: 'Last Caller ID', cell: (row) => row.lastCallerId || '-' },
  {
    header: 'Last Disconnect',
    cell: (row) => row.lastDisconnectReason || '-',
  },
]

const sessionColumns: Column<ActiveRow>[] = [
  {
    header: 'Name',
    cell: (row) => <span className='font-semibold'>{row.name}</span>,
  },
  { header: 'Service', cell: (row) => row.service },
  { header: 'Caller ID', cell: (row) => row.callerId },
  { header: 'Address', cell: (row) => row.address },
  { header: 'Uptime', cell: (row) => row.uptime },
  { header: 'Session ID', cell: (row) => row.sessionId },
]

const profileColumns: Column<ProfileRow>[] = [
  {
    header: 'Name',
    cell: (row) => <span className='font-semibold'>{row.name}</span>,
  },
  { header: 'Local Address', cell: (row) => row.localAddress || '-' },
  { header: 'Remote Address', cell: (row) => row.remoteAddress || '-' },
  { header: 'Rate Limit', cell: (row) => row.rateLimit || '-' },
]

const secretFields: Field<SecretRow>[] = [
  { key: 'name', label: 'Name', placeholder: 'Username', required: true },
  { key: 'password', label: 'Password', placeholder: 'Password' },
  {
    key: 'service',
    label: 'Service',
    placeholder: 'Select service',
    required: true,
    options: serviceOptions,
  },
  { key: 'profile', label: 'Profile', placeholder: 'Select profile' },
  { key: 'localAddress', label: 'Local Address', placeholder: '0.0.0.0' },
  { key: 'remoteAddress', label: 'Remote Address', placeholder: '0.0.0.0' },
  { key: 'comment', label: 'Comment', placeholder: 'Comment' },
]

const profileFields: Field<ProfileRow>[] = [
  { key: 'name', label: 'Name', placeholder: 'Profile Name', required: true },
  { key: 'rateLimit', label: 'Rate Limit', placeholder: '7M/7M' },
  { key: 'localAddress', label: 'Local Address', placeholder: '0.0.0.0' },
  { key: 'remoteAddress', label: 'Remote Address', placeholder: 'pool-name' },
  {
    key: 'onlyOne',
    label: 'Only One',
    placeholder: 'Select setting',
    options: ['yes', 'no'],
  },
  {
    key: 'insertQueueBefore',
    label: 'Insert Queue Before',
    placeholder: 'Select queue',
  },
  {
    key: 'parentQueue',
    label: 'Parent Queue',
    placeholder: 'Select parent queue',
  },
  { key: 'addressList', label: 'Address List', placeholder: 'Address list' },
  { key: 'onUp', label: 'On Up', placeholder: 'Script' },
  { key: 'onDown', label: 'On Down', placeholder: 'Script' },
  { key: 'comment', label: 'Comment', placeholder: 'Comment' },
]

function useIsDark() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  )

  useEffect(() => {
    const element = document.documentElement
    const observer = new MutationObserver(() =>
      setDark(element.classList.contains('dark'))
    )
    observer.observe(element, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return dark
}

function useMuiTheme() {
  const dark = useIsDark()
  return useMemo(
    () =>
      createTheme({
        palette: { mode: dark ? 'dark' : 'light' },
        typography: { fontFamily: 'inherit' },
      }),
    [dark]
  )
}

function IconButton({
  title,
  onClick,
  destructive,
  children,
}: {
  title: string
  onClick: () => void
  destructive?: boolean
  children: ReactNode
}) {
  return (
    <Button
      variant='ghost'
      size='icon'
      className={`h-6 w-6 ${destructive ? 'text-destructive hover:text-destructive' : ''}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      {children}
    </Button>
  )
}

function FormDialog<T extends object>({
  open,
  onOpenChange,
  title,
  idPrefix,
  fields,
  data,
  onChange,
  onSubmit,
  submitLabel,
  passwordOptional = false,
  basicKeys,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  idPrefix: string
  fields: Field<T>[]
  data: Partial<T>
  onChange: (data: Partial<T>) => void
  onSubmit: (event: React.FormEvent) => void
  submitLabel: string
  passwordOptional?: boolean
  // When set, fields are split into Basic (these keys) and Advanced (all) tabs.
  basicKeys?: string[]
}) {
  const renderField = (field: Field<T>) => {
    const id = `${idPrefix}-${field.key}`
    const value = String(data[field.key] ?? '')
    const required =
      field.required || (field.key === 'password' && !passwordOptional)
    return (
      <div key={field.key} className='space-y-2'>
        <Label htmlFor={id}>{field.label}</Label>
        {field.options ? (
          <Select
            value={value}
            onValueChange={(next) =>
              onChange({ ...data, [field.key]: next } as Partial<T>)
            }
          >
            <SelectTrigger id={id} className='w-full'>
              <SelectValue placeholder={field.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {(value && !field.options.includes(value)
                ? [value, ...field.options]
                : field.options
              ).map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id={id}
            value={value}
            onChange={(event) =>
              onChange({
                ...data,
                [field.key]: event.target.value,
              } as Partial<T>)
            }
            placeholder={field.placeholder}
            required={required}
            autoComplete={field.key === 'password' ? 'new-password' : 'off'}
            type={field.key === 'password' ? 'password' : 'text'}
          />
        )}
      </div>
    )
  }

  const renderFields = (list: Field<T>[]) => (
    <div className='flex flex-col gap-4'>{list.map(renderField)}</div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='max-h-[85vh] overflow-y-auto p-0 sm:max-w-md'
        showCloseButton={false}
      >
        <DialogHeader className='border-b px-6 py-3'>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className='sr-only'>
            {title} form
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={onSubmit}
          className='space-y-4 px-6 pt-2.5 pb-6'
          autoComplete='off'
        >
          {basicKeys ? (
            <Tabs defaultValue='basic'>
              <TabsList className='w-full'>
                <TabsTrigger value='basic'>Basic</TabsTrigger>
                <TabsTrigger value='advanced'>Advanced</TabsTrigger>
              </TabsList>
              <TabsContent value='basic' className='pt-2'>
                {renderFields(
                  fields.filter((field) => basicKeys.includes(field.key))
                )}
              </TabsContent>
              <TabsContent value='advanced' className='pt-2'>
                {renderFields(fields)}
              </TabsContent>
            </Tabs>
          ) : (
            renderFields(fields)
          )}
          <DialogFooter className='pt-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type='submit'>{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Only fields that differ from the loaded secret; an emptied field is sent as "" to clear it.
function changedSecretInput(
  original: SecretRow | undefined,
  form: Partial<SecretRow>
): PppoeSecretInput {
  const input: PppoeSecretInput = {}
  const name = form.name?.trim() ?? ''
  if (name && name !== original?.name) input.name = name
  if (form.password && form.password !== original?.password) {
    input.password = form.password
  }
  if (form.service && form.service !== original?.service) {
    input.service = form.service
  }
  if (form.profile && form.profile !== original?.profile) {
    input.profile = form.profile
  }
  const local = form.localAddress?.trim() ?? ''
  if (local !== (original?.localAddress ?? '')) input.local_address = local
  const remote = form.remoteAddress?.trim() ?? ''
  if (remote !== (original?.remoteAddress ?? '')) input.remote_address = remote
  const comment = form.comment ?? ''
  if (comment !== (original?.comment ?? '')) input.comment = comment
  return input
}

function secretRow(secret: PppoeSecret, index: number): SecretRow {
  return {
    ...secret,
    index,
    flags: secret.disabled ? 'X' : '',
    localAddress: secret.local_address,
    remoteAddress: secret.remote_address,
    callerId: secret.caller_id,
    lastLoggedOut: secret.last_logged_out,
    lastCallerId: secret.last_caller_id,
    lastDisconnectReason: secret.last_disconnect_reason,
  }
}

function profileRow(profile: PppoeProfile, index: number): ProfileRow {
  return {
    index,
    flags: profile.name === 'default' ? '*' : '',
    name: profile.name,
    localAddress: profile.local_address,
    remoteAddress: profile.remote_address,
    rateLimit: profile.rate_limit,
    onlyOne: profile.only_one,
    insertQueueBefore: profile.insert_queue_before,
    parentQueue: profile.parent_queue,
    addressList: profile.address_list,
    onUp: profile.on_up,
    onDown: profile.on_down,
    comment: profile.comment,
  }
}

function activeRow(
  connection: PppoeActiveConnection,
  index: number
): ActiveRow {
  return {
    ...connection,
    index,
    flags: '',
    callerId: connection.caller_id,
    sessionId: connection.session_id,
  }
}

// Maps form keys to API keys, excluding name which is handled separately.
const profileApiKeys = {
  localAddress: 'local_address',
  remoteAddress: 'remote_address',
  onlyOne: 'only_one',
  rateLimit: 'rate_limit',
  insertQueueBefore: 'insert_queue_before',
  parentQueue: 'parent_queue',
  addressList: 'address_list',
  onUp: 'on_up',
  onDown: 'on_down',
  comment: 'comment',
} as const satisfies Partial<Record<keyof ProfileRow, keyof PppoeProfile>>

// Add sends name plus filled fields; edit sends only fields that differ (empty clears).
function profileInput(
  form: Partial<ProfileRow>,
  original?: ProfileRow
): PppoeProfileInput {
  const input: PppoeProfileInput = {}
  const name = form.name?.trim() ?? ''
  if (!original || name !== original.name) input.name = name

  for (const [formKey, apiKey] of Object.entries(profileApiKeys) as [
    keyof typeof profileApiKeys,
    (typeof profileApiKeys)[keyof typeof profileApiKeys],
  ][]) {
    const value = (form[formKey] ?? '').trim()
    if (original ? value !== (original[formKey] ?? '') : value !== '') {
      input[apiKey] = value
    }
  }
  return input
}

export function PppoeSecrets() {
  const muiTheme = useMuiTheme()
  const [routers, setRouters] = useState<MikrotikRouter[]>([])
  const [routerId, setRouterId] = useState('')
  const [isLoadingRouters, setIsLoadingRouters] = useState(true)
  const [secrets, setSecrets] = useState<SecretRow[]>([])
  const [secretProfileFilter, setSecretProfileFilter] = useState('all')
  const [offlineSecrets, setOfflineSecrets] = useState<SecretRow[]>([])
  const [activeSessions, setActiveSessions] = useState<ActiveRow[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [ipPools, setIpPools] = useState<PppoePool[]>([])
  const [queueNames, setQueueNames] = useState<string[]>([])
  const [secretDialog, setSecretDialog] = useState({
    open: false,
    editing: false,
  })
  const [secretForm, setSecretForm] = useState<Partial<SecretRow>>(emptySecret)
  const [editingSecretId, setEditingSecretId] = useState<string | null>(null)
  const [profileDialog, setProfileDialog] = useState({
    open: false,
    editing: false,
  })
  const [profileForm, setProfileForm] =
    useState<Partial<ProfileRow>>(emptyProfile)
  const [editingProfileName, setEditingProfileName] = useState<string | null>(
    null
  )
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const dataRequestId = useRef(0)

  const loadRouters = useCallback(async () => {
    setIsLoadingRouters(true)
    try {
      const result = await getMikrotikRouters()
      setRouters(result)
      setRouterId((current) =>
        result.some((router) => String(router.id) === current) ? current : ''
      )
    } catch (error) {
      toast.error(getPppoeErrorMessage(error))
    } finally {
      setIsLoadingRouters(false)
    }
  }, [])

  const loadRouterData = useCallback(async () => {
    const requestId = ++dataRequestId.current
    if (!routerId) {
      setSecrets([])
      setOfflineSecrets([])
      setActiveSessions([])
      setProfiles([])
      setIpPools([])
      setQueueNames([])
      return
    }

    setSecrets([])
    setOfflineSecrets([])
    setActiveSessions([])
    setProfiles([])
    setIpPools([])
    setQueueNames([])
    try {
      const id = Number(routerId)
      const [
        secretData,
        offlineData,
        activeData,
        profileData,
        poolData,
        queues,
      ] = await Promise.all([
        getPppoeSecrets(id),
        getPppoeOffline(id),
        getPppoeActive(id),
        getPppoeProfiles(id),
        getPppoePools(id),
        getPppoeQueueNames(id),
      ])
      if (requestId !== dataRequestId.current) return
      setSecrets(secretData.map(secretRow))
      setOfflineSecrets(offlineData.map(secretRow))
      setActiveSessions(activeData.map(activeRow))
      setProfiles(profileData.map(profileRow))
      setIpPools(poolData)
      setQueueNames(queues)
    } catch (error) {
      if (requestId === dataRequestId.current) {
        toast.error(getPppoeErrorMessage(error))
      }
    } finally {
    }
  }, [routerId])

  useEffect(() => {
    void loadRouters()
  }, [loadRouters])

  useEffect(() => {
    void loadRouterData()
  }, [loadRouterData])

  const openAddSecret = () => {
    setEditingSecretId(null)
    setSecretForm({
      ...emptySecret,
      profile:
        profiles.find((profile) => profile.name === 'default')?.name ?? '',
    })
    setSecretDialog({ open: true, editing: false })
  }

  const openEditSecret = (secret: SecretRow) => {
    setEditingSecretId(secret.id)
    setSecretForm({ ...secret })
    setSecretDialog({ open: true, editing: true })
  }

  const submitSecret = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!routerId) return
    if (!secretDialog.editing && !secretForm.password) {
      toast.error('Password is required.')
      return
    }

    try {
      const input = secretDialog.editing
        ? changedSecretInput(
            [...secrets, ...offlineSecrets].find(
              (secret) => secret.id === editingSecretId
            ),
            secretForm
          )
        : {
            name: secretForm.name?.trim() ?? '',
            ...(secretForm.password ? { password: secretForm.password } : {}),
            service: secretForm.service || 'pppoe',
            profile: secretForm.profile || 'default',
            ...(secretForm.localAddress
              ? { local_address: secretForm.localAddress }
              : {}),
            ...(secretForm.remoteAddress
              ? { remote_address: secretForm.remoteAddress }
              : {}),
            ...(secretForm.comment ? { comment: secretForm.comment } : {}),
          }

      if (secretDialog.editing && Object.keys(input).length === 0) {
        toast.info('No changes to save.')
        setSecretDialog({ open: false, editing: false })
        return
      }

      const result = await savePppoeSecret(
        Number(routerId),
        input,
        editingSecretId ?? undefined
      )
      toast.success(result.message)
      setSecretDialog({ open: false, editing: false })
      await loadRouterData()
    } catch (error) {
      toast.error(getPppoeErrorMessage(error))
    }
  }

  const openAddProfile = () => {
    setEditingProfileName(null)
    setProfileForm(emptyProfile)
    setProfileDialog({ open: true, editing: false })
  }

  const openEditProfile = (profile: ProfileRow) => {
    setEditingProfileName(profile.name)
    setProfileForm({ ...profile })
    setProfileDialog({ open: true, editing: true })
  }

  const submitProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!routerId) return

    const original = editingProfileName
      ? profiles.find((profile) => profile.name === editingProfileName)
      : undefined
    if (!profileForm.name?.trim()) {
      toast.error('Name is required.')
      return
    }
    const input = profileInput(profileForm, original)
    if (original && Object.keys(input).length === 0) {
      toast.info('No changes to save.')
      setProfileDialog({ open: false, editing: false })
      return
    }

    try {
      const result = await savePppoeProfile(
        Number(routerId),
        input,
        editingProfileName ?? undefined
      )
      toast.success(result.message)
      setProfileDialog({ open: false, editing: false })
      await loadRouterData()
    } catch (error) {
      toast.error(getPppoeErrorMessage(error))
    }
  }

  const confirmDeleteSecret = (secret: SecretRow) =>
    setConfirm({
      title: 'Delete PPP Secret?',
      description: `Secret "${secret.name}" will be permanently deleted. This action cannot be undone.`,
      actionLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        const result = await deletePppoeSecret(Number(routerId), secret.id)
        toast.success(result.message)
        await loadRouterData()
      },
    })

  const confirmToggleSecret = (secret: SecretRow) => {
    const disabled = !secret.disabled
    const action = disabled ? 'Disable' : 'Enable'
    setConfirm({
      title: `${action} PPP Secret?`,
      description: `Are you sure you want to ${action.toLowerCase()} "${secret.name}"?`,
      actionLabel: action,
      destructive: disabled,
      onConfirm: async () => {
        const result = await setPppoeSecretDisabled(
          Number(routerId),
          secret.id,
          disabled
        )
        toast.success(result.message)
        await loadRouterData()
      },
    })
  }

  const toggleSecretDisabled = async (secret: SecretRow) => {
    if (!routerId || isConfirming) return
    confirmToggleSecret(secret)
  }

  const confirmDeleteProfile = (profile: ProfileRow) =>
    setConfirm({
      title: 'Delete PPP Profile?',
      description: `Profile "${profile.name}" will be permanently deleted. This action cannot be undone.`,
      actionLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        const result = await deletePppoeProfile(Number(routerId), profile.name)
        toast.success(result.message)
        await loadRouterData()
      },
    })

  const confirmDisconnect = (session: ActiveRow) =>
    setConfirm({
      title: 'Disconnect user?',
      description: `Session "${session.name}" (${session.address}) will be disconnected.`,
      actionLabel: 'Disconnect',
      destructive: true,
      onConfirm: async () => {
        const result = await disconnectPppoeActive(Number(routerId), session.id)
        toast.success(result.message)
        await loadRouterData()
      },
    })

  const handleConfirm = async () => {
    if (!confirm) return
    setIsConfirming(true)
    try {
      await confirm.onConfirm()
      setConfirm(null)
    } catch (error) {
      toast.error(getPppoeErrorMessage(error))
    } finally {
      setIsConfirming(false)
    }
  }

  const profileOptions = profiles.map((profile) => profile.name)
  const ipPoolOptions = ipPools.map((pool) => pool.name)
  const insertQueueOptions = ['bottom', 'first', ...queueNames]
  const parentQueueOptions = ['none', ...queueNames]
  const filteredSecrets =
    secretProfileFilter === 'all'
      ? secrets
      : secrets.filter((secret) => secret.profile === secretProfileFilter)
  const currentRouter = routers.find((router) => String(router.id) === routerId)

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>
      <Main fixed fluid className='min-h-0 !overflow-y-auto'>
        <div className='mb-2'>
          <h1 className='text-2xl font-bold tracking-tight'>
            PPPoE Management
          </h1>
        </div>

        <ThemeProvider theme={muiTheme}>
          <Tabs defaultValue='secret' className='w-full'>
            <TabsList className='mb-2'>
              <TabsTrigger value='secret'>Secret</TabsTrigger>
              <TabsTrigger value='online'>Online</TabsTrigger>
              <TabsTrigger value='offline'>Offline</TabsTrigger>
              <TabsTrigger value='active'>Active</TabsTrigger>
              <TabsTrigger value='profile'>Profile</TabsTrigger>
            </TabsList>
            <TabsContent value='secret'>
              <DataTable
                columns={secretColumns}
                rows={filteredSecrets}
                getRowId={(secret) => secret.id}
                addLabel='Add Secret'
                onAdd={currentRouter ? openAddSecret : undefined}
                toolbarBeforeAdd={
                  <>
                    <Select
                      value={routerId}
                      onValueChange={setRouterId}
                      disabled={isLoadingRouters || routers.length === 0}
                    >
                      <SelectTrigger size='sm' className='h-7 w-full sm:w-43'>
                        <SelectValue
                          placeholder={
                            isLoadingRouters
                              ? 'Loading MikroTik...'
                              : 'Select MikroTik'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {routers.map((router) => (
                          <SelectItem key={router.id} value={String(router.id)}>
                            {router.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={secretProfileFilter}
                      onValueChange={setSecretProfileFilter}
                    >
                      <SelectTrigger size='sm' className='h-7 w-full sm:w-43'>
                        <SelectValue placeholder='Filter by profile' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='all'>All profiles</SelectItem>
                        {profileOptions.map((profile) => (
                          <SelectItem key={profile} value={profile}>
                            {profile}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                }
                actions={(secret) => (
                  <>
                    <Button
                      type='button'
                      size='icon'
                      variant='ghost'
                      className='size-6 p-0'
                      title={secret.disabled ? 'Enable' : 'Disable'}
                      aria-label={`${secret.disabled ? 'Enable' : 'Disable'} ${secret.name}`}
                      disabled={isConfirming}
                      onClick={() => void toggleSecretDisabled(secret)}
                    >
                      {secret.disabled ? (
                        <Power className='size-3.5' />
                      ) : (
                        <PowerOff className='size-3.5' />
                      )}
                    </Button>
                    <IconButton
                      title='Edit'
                      onClick={() => openEditSecret(secret)}
                    >
                      <Pencil className='size-3.5' />
                    </IconButton>
                    <IconButton
                      title='Delete'
                      destructive
                      onClick={() => confirmDeleteSecret(secret)}
                    >
                      <Trash2 className='size-3.5' />
                    </IconButton>
                  </>
                )}
              />
            </TabsContent>
            {(['online', 'active'] as const).map((tab) => (
              <TabsContent key={tab} value={tab}>
                <DataTable
                  columns={sessionColumns}
                  rows={activeSessions}
                  getRowId={(session) => session.id}
                  actions={(session) => (
                    <IconButton
                      title='Disconnect / Kick'
                      destructive
                      onClick={() => confirmDisconnect(session)}
                    >
                      <Trash2 className='size-3.5' />
                    </IconButton>
                  )}
                />
              </TabsContent>
            ))}
            <TabsContent value='offline'>
              <DataTable
                columns={secretColumns}
                rows={offlineSecrets}
                getRowId={(secret) => secret.id}
                actions={(secret) => (
                  <>
                    <Button
                      type='button'
                      size='icon'
                      variant='ghost'
                      className='size-6 p-0'
                      title={secret.disabled ? 'Enable' : 'Disable'}
                      aria-label={`${secret.disabled ? 'Enable' : 'Disable'} ${secret.name}`}
                      disabled={isConfirming}
                      onClick={() => void toggleSecretDisabled(secret)}
                    >
                      {secret.disabled ? (
                        <Power className='size-3.5' />
                      ) : (
                        <PowerOff className='size-3.5' />
                      )}
                    </Button>
                    <IconButton
                      title='Edit'
                      onClick={() => openEditSecret(secret)}
                    >
                      <Pencil className='size-3.5' />
                    </IconButton>
                    <IconButton
                      title='Delete'
                      destructive
                      onClick={() => confirmDeleteSecret(secret)}
                    >
                      <Trash2 className='size-3.5' />
                    </IconButton>
                  </>
                )}
              />
            </TabsContent>
            <TabsContent value='profile'>
              <DataTable
                columns={profileColumns}
                rows={profiles}
                getRowId={(profile) => profile.name}
                addLabel='Add Profile'
                onAdd={currentRouter ? openAddProfile : undefined}
                actions={(profile) => (
                  <>
                    <IconButton
                      title='Edit'
                      onClick={() => openEditProfile(profile)}
                    >
                      <Pencil className='size-3.5' />
                    </IconButton>
                    <IconButton
                      title='Delete'
                      destructive
                      onClick={() => confirmDeleteProfile(profile)}
                    >
                      <Trash2 className='size-3.5' />
                    </IconButton>
                  </>
                )}
              />
            </TabsContent>
          </Tabs>
        </ThemeProvider>
      </Main>

      <FormDialog
        open={secretDialog.open}
        onOpenChange={(open) =>
          setSecretDialog((state) => ({ ...state, open }))
        }
        title={secretDialog.editing ? 'Edit PPP Secret' : 'Add PPP Secret'}
        idPrefix='secret'
        fields={secretFields.map((field) =>
          field.key === 'profile'
            ? { ...field, options: profileOptions }
            : field
        )}
        data={secretForm}
        onChange={setSecretForm}
        onSubmit={submitSecret}
        submitLabel={secretDialog.editing ? 'Save changes' : 'Add Secret'}
        passwordOptional={secretDialog.editing}
        basicKeys={['name', 'password', 'service', 'profile']}
      />
      <FormDialog
        open={profileDialog.open}
        onOpenChange={(open) =>
          setProfileDialog((state) => ({ ...state, open }))
        }
        title={profileDialog.editing ? 'Edit PPP Profile' : 'Add PPP Profile'}
        idPrefix='profile'
        fields={profileFields.map((field) =>
          field.key === 'remoteAddress'
            ? {
                ...field,
                placeholder:
                  ipPoolOptions.length > 0
                    ? 'Select IP pool'
                    : 'No IP pools available',
                options: ipPoolOptions,
              }
            : field.key === 'insertQueueBefore'
              ? { ...field, options: insertQueueOptions }
              : field.key === 'parentQueue'
                ? { ...field, options: parentQueueOptions }
                : field
        )}
        data={profileForm}
        onChange={setProfileForm}
        onSubmit={submitProfile}
        submitLabel={profileDialog.editing ? 'Save changes' : 'Add Profile'}
        basicKeys={[
          'name',
          'rateLimit',
          'localAddress',
          'remoteAddress',
          'onlyOne',
          'insertQueueBefore',
          'parentQueue',
        ]}
      />
      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <DialogContent className='sm:max-w-md' showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setConfirm(null)}
              disabled={isConfirming}
            >
              Cancel
            </Button>
            <Button
              variant={confirm?.destructive ? 'destructive' : 'default'}
              onClick={() => void handleConfirm()}
              disabled={isConfirming}
            >
              {isConfirming ? 'Processing...' : confirm?.actionLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
