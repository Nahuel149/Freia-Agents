import { styled } from '@mui/material/styles'
import { TableCell, TableRow } from '@mui/material'
import { tableCellClasses } from '@mui/material/TableCell'

export const StyledTableCell = styled(TableCell)(({ theme }) => ({
    borderColor: theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[300],

    [`&.${tableCellClasses.head}`]: {
        color: theme.palette.text.primary,
        fontWeight: 600
    },
    [`&.${tableCellClasses.body}`]: {
        fontSize: 14,
        height: 64,
        color: theme.palette.text.primary
    }
}))

export const StyledTableRow = styled(TableRow)(() => ({
    // hide last border
    '&:last-child td, &:last-child th': {
        border: 0
    }
}))
