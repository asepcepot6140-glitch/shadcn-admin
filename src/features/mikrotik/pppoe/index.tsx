import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Pencil, Trash2, Plus, Search } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Box,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  ThemeProvider,
  createTheme,
} from '@mui/material'
import { initialPppoeSecrets, type PppoeSecret } from './data/secrets'

/* ------------------------------ Types & data ------------------------------ */

interface ActiveSession {
  index: number
  flags: string
  name: string
  service: string
  callerId: string
  address: string
  uptime: string
  sessionId: string
}

interface ProfileItem {
  index: number
  flags: string
  name: string
  localAddress: string
  remoteAddress: string
  rateLimit: string
}

interface Column<T> {
  header: string
  cell: (row: T) => ReactNode
  className?: string
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
  onConfirm: () => void
}

const initialActiveSessions: ActiveSession[] = [
  {
    index: 0,
    flags: '',
    name: 'Mama raya csr rt4',
    service: 'pppoe',
    callerId: 'E8:6E:44:75:25:D7',
    address: '192.168.253.155',
    uptime: '3w5d44s',
    sessionId: '0x81C21750',
  },
  {
    index: 1,
    flags: '',
    name: 'Sugiyanto csr rt1',
    service: 'pppoe',
    callerId: 'F0:3F:95:59:8A:1C',
    address: '192.168.253.231',
    uptime: '3w5d30s',
    sessionId: '0x81C2176F',
  },
]

const initialProfiles: ProfileItem[] = [
  { index: 0, flags: '*', name: 'default', localAddress: '-', remoteAddress: '-', rateLimit: '-' },
  { index: 1, flags: '', name: '7mb', localAddress: '192.168.252.1', remoteAddress: 'pool-PPPoE', rateLimit: '7M/7M' },
]

// Daftar router sementara (statis), nanti diganti dari API
const routers = [
  { id: '1', name: 'MikroTik Pusat' },
  { id: '2', name: 'MikroTik Cabang 1' },
  { id: '3', name: 'MikroTik Cabang 2' },
]

interface RouterData {
  secrets: PppoeSecret[]
  activeSessions: ActiveSession[]
  profiles: ProfileItem[]
}

const initialRouterData = (): RouterData => ({
  secrets: initialPppoeSecrets,
  activeSessions: initialActiveSessions,
  profiles: initialProfiles,
})

const emptySecret: Partial<PppoeSecret> = {
  name: '',
  password: '',
  service: 'pppoe',
  profile: 'default',
  localAddress: '',
  remoteAddress: '',
}

const emptyProfile: Partial<ProfileItem> = {
  name: '',
  localAddress: '',
  remoteAddress: '',
  rateLimit: '',
}

/* ------------------------- Column & field definitions ------------------------- */

const secretColumns: Column<PppoeSecret>[] = [
  { header: 'Flags', cell: (r) => r.flags, className: 'w-16' },
  { header: 'Name', cell: (r) => <span className='font-semibold'>{r.name}</span> },
  { header: 'Service', cell: (r) => r.service },
  { header: 'Password', cell: (r) => r.password },
  { header: 'Profile', cell: (r) => r.profile },
  { header: 'Local Address', cell: (r) => r.localAddress || '-' },
  { header: 'Remote Address', cell: (r) => r.remoteAddress || '-' },
  { header: 'Last Logged Out', cell: (r) => r.lastLoggedOut },
  { header: 'Last Caller ID', cell: (r) => r.lastCallerId },
  { header: 'Last Disconnect Reason', cell: (r) => r.lastDisconnectReason },
]

// Dipakai bersama oleh tab Online dan Active
const sessionColumns: Column<ActiveSession>[] = [
  { header: 'Flags', cell: (r) => r.flags, className: 'w-16' },
  { header: 'Name', cell: (r) => <span className='font-semibold'>{r.name}</span> },
  { header: 'Service', cell: (r) => r.service },
  { header: 'Caller ID', cell: (r) => r.callerId },
  { header: 'Address', cell: (r) => r.address },
  { header: 'Uptime', cell: (r) => r.uptime },
  { header: 'Session ID', cell: (r) => r.sessionId },
]

const profileColumns: Column<ProfileItem>[] = [
  { header: 'Flags', cell: (r) => r.flags, className: 'w-16' },
  { header: 'Name', cell: (r) => <span className='font-semibold'>{r.name}</span> },
  { header: 'Local Address', cell: (r) => r.localAddress },
  { header: 'Remote Address', cell: (r) => r.remoteAddress },
  { header: 'Rate Limit', cell: (r) => r.rateLimit },
]

const serviceOptions = ['any', 'pppoe', 'pptp', 'l2tp', 'sstp', 'ovpn', 'async']

const secretFields: Field<PppoeSecret>[] = [
  { key: 'name', label: 'Name', placeholder: 'Username', required: true },
  { key: 'password', label: 'Password', placeholder: 'Password', required: true },
  { key: 'service', label: 'Service', placeholder: 'Pilih service', required: true, options: serviceOptions },
  { key: 'profile', label: 'Profile', placeholder: 'Pilih profile', required: true },
  { key: 'localAddress', label: 'Local Address', placeholder: '0.0.0.0' },
  { key: 'remoteAddress', label: 'Remote Address', placeholder: '0.0.0.0' },
]

const profileFields: Field<ProfileItem>[] = [
  { key: 'name', label: 'Name', placeholder: 'Profile Name', required: true },
  { key: 'rateLimit', label: 'Rate Limit', placeholder: '7M/7M' },
  { key: 'localAddress', label: 'Local Address', placeholder: '0.0.0.0' },
  { key: 'remoteAddress', label: 'Remote Address', placeholder: 'pool-name' },
]

const sessionTabs = ['online', 'active']

/* ------------------------- Reusable pieces (same file) ------------------------- */

// Baca mode gelap dari class `.dark` shadcn (hanya membaca, tidak mengubah <html>)
function useIsDark() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  )
  useEffect(() => {
    const el = document.documentElement
    const observer = new MutationObserver(() =>
      setDark(el.classList.contains('dark'))
    )
    observer.observe(el, { attributes: true, attributeFilter: ['class'] })
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

const ROWS_PER_PAGE_OPTIONS = [5, 10, 25, 50]

function DataTable<T extends { index: number }>({
  columns,
  rows,
  actions,
  addLabel,
  onAdd,
}: {
  columns: Column<T>[]
  rows: T[]
  actions: (row: T) => ReactNode
  addLabel?: string
  onAdd?: () => void
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // Search ke semua nilai di dalam baris
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) =>
      Object.values(row).some((v) => String(v).toLowerCase().includes(q))
    )
  }, [rows, search])

  // Cegah halaman kosong setelah data dihapus / difilter
  const lastPage = Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1)
  const currentPage = Math.min(page, lastPage)
  const visible = filtered.slice(
    currentPage * rowsPerPage,
    currentPage * rowsPerPage + rowsPerPage
  )

  return (
    <Paper
      variant='outlined'
      sx={{
        backgroundColor: 'transparent',
        backgroundImage: 'none',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          p: 1.5,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <TextField
          size='small'
          placeholder='Search...'
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
          sx={{
            width: { xs: '100%', sm: 280 },
            '& .MuiInputBase-root': { height: 32, fontSize: 14 },
            '& .MuiInputBase-input': { py: 0 },
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position='start'>
                  <Search size={16} />
                </InputAdornment>
              ),
            },
          }}
        />
        {onAdd && (
          <Button size='sm' onClick={onAdd} className='w-full gap-2 sm:w-auto'>
            <Plus className='size-4' />
            {addLabel}
          </Button>
        )}
      </Box>

      <TableContainer>
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, width: 48 }}>#</TableCell>
              {columns.map((c) => (
                <TableCell
                  key={c.header}
                  className={c.className}
                  sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
                >
                  {c.header}
                </TableCell>
              ))}
              <TableCell align='center' sx={{ fontWeight: 600, width: 80 }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((row) => (
              <TableRow key={row.index} hover>
                <TableCell>{row.index}</TableCell>
                {columns.map((c) => (
                  <TableCell key={c.header} sx={{ whiteSpace: 'nowrap' }}>
                    {c.cell(row)}
                  </TableCell>
                ))}
                <TableCell align='center'>
                  <div className='flex items-center justify-center gap-1'>{actions(row)}</div>
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 2}
                  align='center'
                  sx={{ py: 4, color: 'text.secondary' }}
                >
                  {search ? 'No results found.' : 'No data.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component='div'
        count={filtered.length}
        page={currentPage}
        onPageChange={(_, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10))
          setPage(0)
        }}
      />
    </Paper>
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
      className={`h-7 w-7 ${destructive ? 'text-destructive hover:text-destructive' : ''}`}
      onClick={onClick}
      title={title}
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  idPrefix: string
  fields: Field<T>[]
  data: Partial<T>
  onChange: (data: Partial<T>) => void
  onSubmit: (e: React.FormEvent) => void
  submitLabel: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='p-0 sm:max-w-md' showCloseButton={false}>
        <DialogHeader className='border-b px-6 py-3'>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className='sr-only'>{title} form</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className='space-y-4 px-6 pb-6 pt-2.5'>
          <div className='flex flex-col gap-4'>
            {fields.map((f) => {
              const id = `${idPrefix}-${f.key}`
              const value = String(data[f.key] ?? '')
              return (
                <div key={f.key} className='space-y-2'>
                  <Label htmlFor={id}>{f.label}</Label>
                  {f.options ? (
                    <Select
                      value={value}
                      onValueChange={(v) => onChange({ ...data, [f.key]: v } as Partial<T>)}
                    >
                      <SelectTrigger id={id} className='w-full'>
                        <SelectValue placeholder={f.placeholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Pertahankan nilai lama yang tidak ada di daftar */}
                        {(value && !f.options.includes(value) ? [value, ...f.options] : f.options).map(
                          (opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={id}
                      value={value}
                      onChange={(e) => onChange({ ...data, [f.key]: e.target.value } as Partial<T>)}
                      placeholder={f.placeholder}
                      required={f.required}
                    />
                  )}
                </div>
              )
            })}
          </div>
          <DialogFooter className='pt-2'>
            <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type='submit'>{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const nextIndex = (items: { index: number }[]) =>
  items.length > 0 ? Math.max(...items.map((i) => i.index)) + 1 : 0

/* --------------------------------- Page --------------------------------- */

export function PppoeSecrets() {
  const muiTheme = useMuiTheme()
  const [routerId, setRouterId] = useState(routers[0].id)
  const [dataByRouter, setDataByRouter] = useState<Record<string, RouterData>>(() =>
    Object.fromEntries(routers.map((r) => [r.id, initialRouterData()]))
  )

  const { secrets, activeSessions, profiles } = dataByRouter[routerId]

  // Setter yang hanya mengubah data router yang sedang dipilih
  const updateRouterData =
    <K extends keyof RouterData>(key: K) =>
    (value: RouterData[K] | ((prev: RouterData[K]) => RouterData[K])) =>
      setDataByRouter((all) => {
        const prev = all[routerId][key]
        const next =
          typeof value === 'function'
            ? (value as (p: RouterData[K]) => RouterData[K])(prev)
            : value
        return { ...all, [routerId]: { ...all[routerId], [key]: next } }
      })

  const setSecrets = updateRouterData('secrets')
  const setActiveSessions = updateRouterData('activeSessions')
  const setProfiles = updateRouterData('profiles')

  // Opsi dropdown Profile diambil dari profile milik router yang dipilih
  const secretFormFields = secretFields.map((f) =>
    f.key === 'profile' ? { ...f, options: profiles.map((p) => p.name) } : f
  )

  const [secretDialog, setSecretDialog] = useState({ open: false, editing: false })
  const [secretForm, setSecretForm] = useState<Partial<PppoeSecret>>(emptySecret)
  const [profileDialog, setProfileDialog] = useState({ open: false, editing: false })
  const [profileForm, setProfileForm] = useState<Partial<ProfileItem>>(emptyProfile)

  // Satu dialog konfirmasi untuk semua aksi hapus / kick
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)

  /* Secret handlers */
  const openAddSecret = () => {
    setSecretForm(emptySecret)
    setSecretDialog({ open: true, editing: false })
  }

  const openEditSecret = (secret: PppoeSecret) => {
    setSecretForm({ ...secret })
    setSecretDialog({ open: true, editing: true })
  }

  const submitSecret = (e: React.FormEvent) => {
    e.preventDefault()
    if (secretDialog.editing) {
      setSecrets(secrets.map((s) => (s.index === secretForm.index ? (secretForm as PppoeSecret) : s)))
    } else {
      setSecrets([
        ...secrets,
        {
          index: nextIndex(secrets),
          flags: '',
          name: secretForm.name || '',
          service: secretForm.service || 'pppoe',
          password: secretForm.password || '',
          profile: secretForm.profile || 'default',
          localAddress: secretForm.localAddress || '',
          remoteAddress: secretForm.remoteAddress || '',
          lastLoggedOut: '-',
          lastCallerId: '-',
          lastDisconnectReason: '-',
        },
      ])
    }
    setSecretDialog({ open: false, editing: false })
  }

  /* Profile handlers */
  const openAddProfile = () => {
    setProfileForm(emptyProfile)
    setProfileDialog({ open: true, editing: false })
  }

  const openEditProfile = (profile: ProfileItem) => {
    setProfileForm({ ...profile })
    setProfileDialog({ open: true, editing: true })
  }

  const submitProfile = (e: React.FormEvent) => {
    e.preventDefault()
    if (profileDialog.editing) {
      setProfiles(profiles.map((p) => (p.index === profileForm.index ? (profileForm as ProfileItem) : p)))
    } else {
      setProfiles([
        ...profiles,
        {
          index: nextIndex(profiles),
          flags: '',
          name: profileForm.name || '',
          localAddress: profileForm.localAddress || '',
          remoteAddress: profileForm.remoteAddress || '',
          rateLimit: profileForm.rateLimit || '',
        },
      ])
    }
    setProfileDialog({ open: false, editing: false })
  }

  /* Aksi yang meminta konfirmasi */
  const confirmDeleteSecret = (s: PppoeSecret) =>
    setConfirm({
      title: 'Hapus PPP Secret?',
      description: `Secret "${s.name}" akan dihapus. Tindakan ini tidak bisa dibatalkan.`,
      actionLabel: 'Hapus',
      onConfirm: () => setSecrets((prev) => prev.filter((x) => x.index !== s.index)),
    })

  const confirmDeleteProfile = (p: ProfileItem) =>
    setConfirm({
      title: 'Hapus PPP Profile?',
      description: `Profile "${p.name}" akan dihapus. Tindakan ini tidak bisa dibatalkan.`,
      actionLabel: 'Hapus',
      onConfirm: () => setProfiles((prev) => prev.filter((x) => x.index !== p.index)),
    })

  const confirmKick = (s: ActiveSession) =>
    setConfirm({
      title: 'Putuskan koneksi user?',
      description: `Sesi "${s.name}" (${s.address}) akan diputus.`,
      actionLabel: 'Putuskan',
      onConfirm: () => setActiveSessions((prev) => prev.filter((x) => x.index !== s.index)),
    })

  const handleConfirm = () => {
    confirm?.onConfirm()
    setConfirm(null)
  }

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <Select value={routerId} onValueChange={setRouterId}>
            <SelectTrigger size='sm' className='w-[180px]'>
              <SelectValue placeholder='Pilih router' />
            </SelectTrigger>
            <SelectContent>
              {routers.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main fixed fluid>
        <div className='mb-2'>
          <h1 className='text-2xl font-bold tracking-tight'>PPPoE Management</h1>
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
                rows={secrets}
                addLabel='Add Secret'
                onAdd={openAddSecret}
                actions={(s) => (
                  <>
                    <IconButton title='Edit' onClick={() => openEditSecret(s)}>
                      <Pencil className='size-3.5' />
                    </IconButton>
                    <IconButton title='Delete' destructive onClick={() => confirmDeleteSecret(s)}>
                      <Trash2 className='size-3.5' />
                    </IconButton>
                  </>
                )}
              />
            </TabsContent>

            {/* Online & Active memakai tabel yang sama */}
            {sessionTabs.map((value) => (
              <TabsContent key={value} value={value}>
                <DataTable
                  columns={sessionColumns}
                  rows={activeSessions}
                  actions={(s) => (
                    <IconButton title='Disconnect / Kick' destructive onClick={() => confirmKick(s)}>
                      <Trash2 className='size-3.5' />
                    </IconButton>
                  )}
                />
              </TabsContent>
            ))}

            <TabsContent value='offline'>
              <div className='rounded-xl border p-8 text-center text-muted-foreground'>
                No offline secrets currently recorded.
              </div>
            </TabsContent>

            <TabsContent value='profile'>
              <DataTable
                columns={profileColumns}
                rows={profiles}
                addLabel='Add Profile'
                onAdd={openAddProfile}
                actions={(p) => (
                  <>
                    <IconButton title='Edit' onClick={() => openEditProfile(p)}>
                      <Pencil className='size-3.5' />
                    </IconButton>
                    <IconButton title='Delete' destructive onClick={() => confirmDeleteProfile(p)}>
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
        onOpenChange={(open) => setSecretDialog((d) => ({ ...d, open }))}
        title={secretDialog.editing ? 'Edit PPP Secret' : 'Add PPP Secret'}
        idPrefix='secret'
        fields={secretFormFields}
        data={secretForm}
        onChange={setSecretForm}
        onSubmit={submitSecret}
        submitLabel={secretDialog.editing ? 'Save changes' : 'Add Secret'}
      />

      <FormDialog
        open={profileDialog.open}
        onOpenChange={(open) => setProfileDialog((d) => ({ ...d, open }))}
        title={profileDialog.editing ? 'Edit PPP Profile' : 'Add PPP Profile'}
        idPrefix='profile'
        fields={profileFields}
        data={profileForm}
        onChange={setProfileForm}
        onSubmit={submitProfile}
        submitLabel={profileDialog.editing ? 'Save changes' : 'Add Profile'}
      />

      {/* Dialog konfirmasi hapus / kick */}
      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className='sm:max-w-md' showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setConfirm(null)}>
              Batal
            </Button>
            <Button variant='destructive' onClick={handleConfirm}>
              {confirm?.actionLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}