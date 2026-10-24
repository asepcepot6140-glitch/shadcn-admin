import { useMemo, useState, type ReactNode } from 'react'
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
  TableSortLabel,
  TextField,
} from '@mui/material'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

const ROWS_PER_PAGE_OPTIONS = [5, 10, 25, 50]

export interface DataTableColumn<T> {
  header: string
  cell: (row: T) => ReactNode
  className?: string
  align?: 'left' | 'center' | 'right'
  getSortValue?: (row: T) => string | number | null | undefined
}

interface MuiDataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowId: (row: T) => string | number
  actions?: (row: T) => ReactNode
  addLabel?: string
  onAdd?: () => void
  toolbarBeforeAdd?: ReactNode
  toolbarAfterAdd?: ReactNode
  isLoading?: boolean
  loadingLabel?: string
}

export function MuiDataTable<T extends object>({
  columns,
  rows,
  getRowId,
  actions,
  addLabel,
  onAdd,
  toolbarBeforeAdd,
  toolbarAfterAdd,
  isLoading = false,
  loadingLabel = 'Loading...',
}: MuiDataTableProps<T>) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [sort, setSort] = useState<{
    column: DataTableColumn<T>
    direction: 'asc' | 'desc'
  } | null>(null)
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const matchingRows = query
      ? rows.filter((row) =>
          Object.values(row).some((value) =>
            String(value).toLowerCase().includes(query)
          )
        )
      : rows

    if (!sort) return matchingRows

    return [...matchingRows].sort((first, second) => {
      const firstValue = sort.column.getSortValue?.(first)
      const secondValue = sort.column.getSortValue?.(second)
      if (firstValue == null || secondValue == null) {
        if (firstValue == null && secondValue == null) return 0
        return firstValue == null ? 1 : -1
      }

      const comparison =
        typeof firstValue === 'number' && typeof secondValue === 'number'
          ? firstValue - secondValue
          : String(firstValue).localeCompare(String(secondValue), undefined, {
              numeric: true,
              sensitivity: 'base',
            })
      return sort.direction === 'asc' ? comparison : -comparison
    })
  }, [rows, search, sort])

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
        // Prevent a flex-column parent from shrinking the table; the page scrolls instead.
        flexShrink: 0,
      }}
    >
      <Box
        sx={{
          p: 1,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <div className='flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center'>
          {toolbarBeforeAdd}
          {onAdd && (
            <Button
              size='sm'
              onClick={onAdd}
              className='h-7 w-full gap-2 sm:w-auto'
            >
              <Plus className='size-4' />
              {addLabel}
            </Button>
          )}
          {toolbarAfterAdd}
        </div>
        <TextField
          size='small'
          placeholder='Search...'
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(0)
          }}
          sx={{
            width: { xs: '100%', sm: 172 },
            marginLeft: 'auto',
            '& .MuiInputBase-root': { height: 28, fontSize: 14 },
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
      </Box>
      <TableContainer>
        <Table size='small'>
          <TableHead
            sx={{
              backgroundColor: 'action.hover',
              '& .MuiTableCell-root': {
                backgroundColor: 'action.hover',
                fontWeight: 600,
              },
            }}
          >
            <TableRow>
              <TableCell sx={{ fontWeight: 600, width: 48 }}>#</TableCell>
              {columns.map((column) => (
                <TableCell
                  key={column.header}
                  align={column.align}
                  className={column.className}
                  sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
                >
                  {column.getSortValue ? (
                    <TableSortLabel
                      active={sort?.column === column}
                      direction={
                        sort?.column === column ? sort.direction : 'asc'
                      }
                      onClick={() => {
                        setSort((current) => ({
                          column,
                          direction:
                            current?.column === column &&
                            current.direction === 'asc'
                              ? 'desc'
                              : 'asc',
                        }))
                        setPage(0)
                      }}
                    >
                      {column.header}
                    </TableSortLabel>
                  ) : (
                    column.header
                  )}
                </TableCell>
              ))}
              {actions && (
                <TableCell align='center' sx={{ fontWeight: 600, width: 80 }}>
                  Actions
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (actions ? 2 : 1)}
                  align='center'
                  sx={{
                    py: '2px',
                    lineHeight: 1.2,
                    fontSize: 13,
                    color: 'text.secondary',
                  }}
                >
                  {loadingLabel}
                </TableCell>
              </TableRow>
            ) : (
              <>
                {visible.map((row, index) => (
                  <TableRow key={getRowId(row)} hover>
                    <TableCell>
                      {currentPage * rowsPerPage + index + 1}
                    </TableCell>
                    {columns.map((column) => (
                      <TableCell
                        key={column.header}
                        align={column.align}
                        sx={{ whiteSpace: 'nowrap' }}
                      >
                        {column.cell(row)}
                      </TableCell>
                    ))}
                    {actions && (
                      <TableCell align='center'>
                        <div className='flex items-center justify-center gap-0'>
                          {actions(row)}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {visible.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length + (actions ? 2 : 1)}
                      align='center'
                      sx={{ py: 4, color: 'text.secondary' }}
                    >
                      {search ? 'No results found.' : 'No data.'}
                    </TableCell>
                  </TableRow>
                )}
              </>
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
        sx={{
          '& .MuiTablePagination-toolbar': {
            minHeight: 40,
            paddingInline: 1,
          },
          '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows':
            {
              margin: 0,
              fontSize: '0.8rem',
            },
          '& .MuiTablePagination-select': {
            paddingTop: 0.5,
            paddingBottom: 0.5,
          },
          '& .MuiTablePagination-actions button': {
            padding: 0.5,
          },
        }}
        onRowsPerPageChange={(event) => {
          setRowsPerPage(Number.parseInt(event.target.value, 10))
          setPage(0)
        }}
      />
    </Paper>
  )
}
