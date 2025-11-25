import { useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'

import { ThemeProvider } from '@mui/material/styles'
import { Box, CssBaseline, StyledEngineProvider } from '@mui/material'

// routing
import Routes from '@/routes'

// defaultTheme
import themes from '@/themes'

// project imports
import NavigationScroll from '@/layout/NavigationScroll'
import AnimatedBackdrop from '@/ui-component/background/AnimatedBackdrop'

// ==============================|| APP ||============================== //

const App = () => {
    const customization = useSelector((state) => state.customization)
    const activeTheme = themes(customization)
    const isDark = customization?.isDarkMode
    const location = useLocation()

    const authRoutes = ['/register', '/signin', '/forgot-password']
    const isAuthRoute = authRoutes.some((path) => location.pathname.startsWith(path))

    return (
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={activeTheme}>
                <CssBaseline />
                <Box
                    sx={{
                        minHeight: '100vh',
                        position: 'relative',
                        overflow: 'hidden',
                        background: isAuthRoute
                            ? 'transparent'
                            : isDark
                            ? 'radial-gradient(circle at top, rgba(15, 23, 42, 0.92) 0%, rgba(2, 6, 23, 0.96) 45%, rgba(2, 6, 23, 1) 100%)'
                            : 'linear-gradient(135deg, rgba(244, 247, 255, 1) 0%, rgba(228, 233, 255, 0.95) 35%, rgba(210, 224, 255, 0.9) 100%)'
                    }}
                >
                    {!isAuthRoute && <AnimatedBackdrop />}
                    <NavigationScroll>
                        <Box sx={{ position: 'relative', zIndex: 1 }}>
                            <Routes />
                        </Box>
                    </NavigationScroll>
                </Box>
            </ThemeProvider>
        </StyledEngineProvider>
    )
}

export default App
