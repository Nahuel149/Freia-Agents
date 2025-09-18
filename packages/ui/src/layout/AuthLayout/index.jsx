import { Outlet } from 'react-router-dom'
import { Box, useTheme } from '@mui/material'

// ==============================|| MINIMAL LAYOUT ||============================== //

const AuthLayout = () => {
    const theme = useTheme()

    return (
        <Box
            sx={{
                position: 'relative',
                width: '100vw',
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
                px: { xs: 3, md: 6 },
                py: { xs: 6, md: 8 },
                [theme.breakpoints.down(1367)]: {
                    alignItems: 'flex-start',
                    overflowY: 'auto',
                    py: { xs: 6, md: 8 }
                }
            }}
        >
            <Box sx={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                <Outlet />
            </Box>
        </Box>
    )
}

export default AuthLayout
