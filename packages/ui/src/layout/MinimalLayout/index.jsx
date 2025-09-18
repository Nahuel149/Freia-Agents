import { Outlet } from 'react-router-dom'
import { Box } from '@mui/material'

// ==============================|| MINIMAL LAYOUT ||============================== //

const MinimalLayout = () => (
    <Box sx={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
        <Outlet />
    </Box>
)

export default MinimalLayout
