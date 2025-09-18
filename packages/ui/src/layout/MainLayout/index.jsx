import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Outlet } from 'react-router-dom'

// material-ui
import { styled, useTheme } from '@mui/material/styles'
import { AppBar, Box, CssBaseline, Toolbar, useMediaQuery } from '@mui/material'

// project imports
import Header from './Header'
import Sidebar from './Sidebar'
import { drawerWidth, headerHeight } from '@/store/constant'
import { SET_MENU } from '@/store/actions'

// styles
const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })(({ theme, open }) => {
    const isDark = theme?.customization?.isDarkMode
    const surfaceBackground = isDark
        ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.88) 0%, rgba(30, 41, 59, 0.8) 100%)'
        : 'linear-gradient(135deg, rgba(255, 255, 255, 0.92) 0%, rgba(244, 247, 255, 0.88) 100%)'
    const surfaceBorder = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.28)'
    const surfaceShadow = isDark ? '0 32px 95px rgba(8, 12, 30, 0.65)' : '0 28px 70px rgba(79, 70, 229, 0.14)'

    return {
        ...theme.typography.mainContent,
        position: 'relative',
        zIndex: 1,
        background: surfaceBackground,
        border: `1px solid ${surfaceBorder}`,
        borderRadius: '28px',
        boxShadow: surfaceShadow,
        backdropFilter: 'blur(30px) saturate(150%)',
        padding: theme.spacing(5),
        marginTop: `${headerHeight + 24}px`,
        marginLeft: theme.spacing(4),
        marginRight: theme.spacing(4),
        marginBottom: theme.spacing(6),
        width: `calc(100% - ${theme.spacing(8)})`,
        transition: theme.transitions.create(['margin', 'width', 'backdrop-filter'], {
            easing: theme.transitions.easing.easeInOut,
            duration: theme.transitions.duration.standard
        }),
        [theme.breakpoints.down('lg')]: {
            marginTop: `${headerHeight + 16}px`,
            marginLeft: theme.spacing(3),
            marginRight: theme.spacing(3),
            width: `calc(100% - ${theme.spacing(6)})`,
            padding: theme.spacing(4)
        },
        [theme.breakpoints.down('md')]: {
            marginTop: `${headerHeight + 12}px`,
            marginLeft: theme.spacing(2),
            marginRight: theme.spacing(2),
            marginBottom: theme.spacing(4),
            width: `calc(100% - ${theme.spacing(4)})`,
            borderRadius: '24px',
            padding: theme.spacing(3)
        },
        [theme.breakpoints.down('sm')]: {
            marginTop: `${headerHeight + 8}px`,
            marginLeft: theme.spacing(1.5),
            marginRight: theme.spacing(1.5),
            width: 'calc(100% - 24px)',
            padding: theme.spacing(2.5)
        },
        ...(!open && {
            transition: theme.transitions.create(['margin', 'width'], {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.leavingScreen
            }),
            marginRight: theme.spacing(1.5),
            [theme.breakpoints.up('md')]: {
                marginLeft: -drawerWidth,
                width: `calc(100% - ${drawerWidth}px)`
            },
            [theme.breakpoints.down('md')]: {
                marginLeft: theme.spacing(2),
                width: `calc(100% - ${theme.spacing(4)})`
            }
        }),
        ...(open && {
            transition: theme.transitions.create(['margin', 'width'], {
                easing: theme.transitions.easing.easeOut,
                duration: theme.transitions.duration.enteringScreen
            }),
            marginLeft: 0,
            marginRight: theme.spacing(1),
            [theme.breakpoints.up('md')]: {
                width: `calc(100% - ${drawerWidth}px)`
            },
            [theme.breakpoints.down('md')]: {
                width: `calc(100% - ${theme.spacing(4)})`
            }
        })
    }
})

// ==============================|| MAIN LAYOUT ||============================== //

const MainLayout = () => {
    const theme = useTheme()
    const matchDownMd = useMediaQuery(theme.breakpoints.down('lg'))
    const isDarkMode = theme?.customization?.isDarkMode ?? false

    // Handle left drawer
    const leftDrawerOpened = useSelector((state) => state.customization.opened)
    const dispatch = useDispatch()
    const handleLeftDrawerToggle = () => {
        dispatch({ type: SET_MENU, opened: !leftDrawerOpened })
    }

    useEffect(() => {
        setTimeout(() => dispatch({ type: SET_MENU, opened: !matchDownMd }), 0)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matchDownMd])

    return (
        <Box sx={{ display: 'flex', position: 'relative', zIndex: 1 }}>
            <CssBaseline />
            {/* header */}
            <AppBar
                enableColorOnDark
                position='fixed'
                color='inherit'
                elevation={0}
                sx={{
                    background: isDarkMode
                        ? 'linear-gradient(120deg, rgba(15, 23, 42, 0.85) 0%, rgba(56, 189, 248, 0.22) 100%)'
                        : 'linear-gradient(120deg, rgba(255, 255, 255, 0.92) 0%, rgba(191, 219, 254, 0.5) 100%)',
                    backdropFilter: 'blur(24px) saturate(160%)',
                    borderBottom: `1px solid ${isDarkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.35)'}`,
                    boxShadow: isDarkMode
                        ? '0 18px 45px rgba(8, 12, 30, 0.45)'
                        : '0 16px 40px rgba(79, 70, 229, 0.12)',
                    transition: leftDrawerOpened ? theme.transitions.create(['width', 'background']) : 'none'
                }}
            >
                <Toolbar
                    sx={{
                        height: `${headerHeight}px`,
                        px: { xs: 2, md: 4 },
                        gap: 2,
                        alignItems: 'center'
                    }}
                >
                    <Header handleLeftDrawerToggle={handleLeftDrawerToggle} />
                </Toolbar>
            </AppBar>

            {/* drawer */}
            <Sidebar drawerOpen={leftDrawerOpened} drawerToggle={handleLeftDrawerToggle} />

            {/* main content */}
            <Main theme={theme} open={leftDrawerOpened}>
                <Outlet />
            </Main>
        </Box>
    )
}

export default MainLayout
