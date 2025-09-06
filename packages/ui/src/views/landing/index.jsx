import { Box, Button, Container, Grid, Stack, Typography, ToggleButton, ToggleButtonGroup, Switch, Card, CardContent } from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useTheme, styled } from '@mui/material/styles'
// Removed list view icons; not needed for language toggle
import { useDispatch, useSelector } from 'react-redux'
import { SET_DARKMODE } from '@/store/actions'

const Feature = ({ icon, title, description }) => {
    const theme = useTheme();
    const customization = useSelector((state) => state.customization);
    
    return (
        <Card 
            sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                borderRadius: '20px',
                background: customization?.isDarkMode 
                    ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)'
                    : 'linear-gradient(145deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.6) 100%)',
                backdropFilter: 'blur(20px)',
                border: `1px solid ${customization?.isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.3)'}`,
                boxShadow: customization?.isDarkMode 
                    ? '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                    : '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: customization?.isDarkMode 
                        ? '0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                        : '0 20px 40px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 1)'
                }
            }}
        >
            <CardContent sx={{ flexGrow: 1, textAlign: 'center', p: 4 }}>
                <Box
                    sx={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 3,
                        boxShadow: '0 8px 25px rgba(102, 126, 234, 0.3)'
                    }}
                >
                    <Typography variant="h4" sx={{ fontSize: '2rem' }}>
                        {icon}
                    </Typography>
                </Box>
                <Typography 
                    variant="h6" 
                    component="h3" 
                    sx={{ 
                        fontWeight: 600,
                        mb: 2,
                        color: customization?.isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)'
                    }}
                >
                    {title}
                </Typography>
                <Typography 
                    variant="body2" 
                    sx={{ 
                        color: customization?.isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
                        lineHeight: 1.6
                    }}
                >
                    {description}
                </Typography>
            </CardContent>
        </Card>
    );
};

// Styled switch copied from Header to keep visual consistency
const MaterialUISwitch = styled(Switch)(({ theme }) => ({
    width: 62,
    height: 34,
    padding: 7,
    '& .MuiSwitch-switchBase': {
        margin: 1,
        padding: 0,
        transform: 'translateX(6px)',
        '&.Mui-checked': {
            color: '#fff',
            transform: 'translateX(22px)',
            '& .MuiSwitch-thumb:before': {
                backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 20 20"><path fill="${encodeURIComponent(
                    '#fff'
                )}" d="M4.2 2.5l-.7 1.8-1.8.7 1.8.7.7 1.8.6-1.8L6.7 5l-1.9-.7-.6-1.8zm15 8.3a6.7 6.7 0 11-6.6-6.6 5.8 5.8 0 006.6 6.6z"/></svg>')`
            },
            '& + .MuiSwitch-track': {
                opacity: 1,
                backgroundColor: theme.palette.mode === 'dark' ? '#8796A5' : '#aab4be'
            }
        }
    },
    '& .MuiSwitch-thumb': {
        backgroundColor: theme.palette.mode === 'dark' ? '#003892' : '#001e3c',
        width: 32,
        height: 32,
        '&:before': {
            content: "''",
            position: 'absolute',
            width: '100%',
            height: '100%',
            left: 0,
            top: 0,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 20 20"><path fill="${encodeURIComponent(
                '#fff'
            )}" d="M9.305 1.667V3.75h1.389V1.667h-1.39zm-4.707 1.95l-.982.982L5.09 6.072l.982-.982-1.473-1.473zm10.802 0L13.927 5.09l.982.982 1.473-1.473-.982-.982zM10 5.139a4.872 4.872 0 00-4.862 4.86A4.872 4.872 0 0010 14.862 4.872 4.872 0 0014.86 10 4.872 4.872 0 0010 5.139zm0 1.389A3.462 3.462 0 0113.471 10a3.462 3.462 0 01-3.473 3.472A3.462 3.462 0 016.527 10 3.462 3.462 0 0110 6.528zM1.665 9.305v1.39h2.083v-1.39H1.666zm14.583 0v1.39h2.084v-1.39h-2.084zM5.09 13.928L3.616 15.4l.982.982 1.473-1.473-.982-.982zm9.82 0l-.982.982 1.473 1.473.982-.982-1.473-1.473zM9.305 16.25v2.083h1.389V16.25h-1.39z"/></svg>')`
        }
    },
    '& .MuiSwitch-track': {
        opacity: 1,
        backgroundColor: theme.palette.mode === 'dark' ? '#8796A5' : '#aab4be',
        borderRadius: 20 / 2
    }
}))

const LandingPage = () => {
    const navigate = useNavigate()
    const { t, i18n } = useTranslation()
    const theme = useTheme()
    const dispatch = useDispatch()
    const customization = useSelector((state) => state.customization)

    // Language toggle (persisted via localStorage)
    const initialLang =
        (typeof window !== 'undefined' && localStorage.getItem('app_lang')) ||
        (i18n.language && i18n.language.split('-')[0]) ||
        'en'
    const [lang, setLang] = useState(initialLang)
    const handleLangToggle = (event, nextLang) => {
        if (!nextLang) return
        setLang(nextLang)
        i18n.changeLanguage(nextLang)
        if (typeof window !== 'undefined') localStorage.setItem('app_lang', nextLang)
    }

    // Dark mode toggle (mirrors Header behavior)
    const [isDark, setIsDark] = useState(customization.isDarkMode)
    const changeDarkMode = () => {
        dispatch({ type: SET_DARKMODE, isDarkMode: !isDark })
        setIsDark((prev) => !prev)
        localStorage.setItem('isDarkMode', !isDark)
    }

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Top-right quick actions: language toggle and dark mode */}
            <Box sx={{ position: 'fixed', top: 16, right: 24, display: 'flex', alignItems: 'center', gap: 2.5, zIndex: 1200 }}>
                <ToggleButtonGroup
                    sx={{
                        borderRadius: '12px',
                        maxHeight: 40,
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
                    }}
                    value={lang}
                    color='primary'
                    exclusive
                    onChange={handleLangToggle}
                >
                    <ToggleButton
                        sx={{
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            borderRadius: '10px',
                            color: theme?.customization?.isDarkMode ? 'white' : 'inherit',
                            background: 'rgba(255, 255, 255, 0.1)',
                            backdropFilter: 'blur(5px)',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                background: 'rgba(255, 255, 255, 0.2)',
                                transform: 'translateY(-2px)',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                            },
                            '&.Mui-selected': {
                                background: 'linear-gradient(135deg, rgba(74, 144, 226, 0.3) 0%, rgba(80, 200, 120, 0.3) 100%)',
                                color: 'white'
                            }
                        }}
                        variant='contained'
                        value='en'
                        title={t('common.english')}
                    >
                        EN
                    </ToggleButton>
                    <ToggleButton
                        sx={{
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            borderRadius: '10px',
                            color: theme?.customization?.isDarkMode ? 'white' : 'inherit',
                            background: 'rgba(255, 255, 255, 0.1)',
                            backdropFilter: 'blur(5px)',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                background: 'rgba(255, 255, 255, 0.2)',
                                transform: 'translateY(-2px)',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                            },
                            '&.Mui-selected': {
                                background: 'linear-gradient(135deg, rgba(74, 144, 226, 0.3) 0%, rgba(80, 200, 120, 0.3) 100%)',
                                color: 'white'
                            }
                        }}
                        variant='contained'
                        value='es'
                        title={t('common.spanish')}
                    >
                        ES
                    </ToggleButton>
                </ToggleButtonGroup>
                <MaterialUISwitch checked={isDark} onChange={changeDarkMode} />
            </Box>

            {/* Hero */}
            <Box 
                sx={{ 
                    pt: 16, 
                    pb: 12,
                    background: theme.palette.mode === 'dark' 
                        ? 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 25%, #16213e 50%, #0f3460 75%, #533483 100%)'
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%)',
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(255,255,255,0.05) 0%, transparent 50%)',
                        pointerEvents: 'none'
                    }
                }}
            >
                <Container maxWidth='lg' sx={{ position: 'relative', zIndex: 1 }}>
                    <Grid container spacing={8} alignItems='center'>
                        <Grid item xs={12} md={6}>
                            <Box sx={{ display: 'flex', justifyContent: { xs: 'center', md: 'flex-start' }, mb: 4 }}>
                                <Box
                                    sx={{
                                        p: 2,
                                        borderRadius: '20px',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        backdropFilter: 'blur(20px)',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                                    }}
                                >
                                    <img 
                                        src="/assets/Freia.png" 
                                        alt="Freia Logo" 
                                        style={{
                                            height: '48px',
                                            width: 'auto',
                                            objectFit: 'contain'
                                        }}
                                    />
                                </Box>
                            </Box>
                            <Typography 
                                variant='h1' 
                                sx={{
                                    fontWeight: 900,
                                    fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4rem' },
                                    lineHeight: 1.1,
                                    background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
                                    backgroundClip: 'text',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    textAlign: { xs: 'center', md: 'left' },
                                    mb: 3
                                }}
                            >
                                {t('landing.hero.title')}
                            </Typography>
                            <Typography 
                                variant='h5' 
                                sx={{ 
                                    color: 'rgba(255, 255, 255, 0.8)',
                                    fontWeight: 400,
                                    lineHeight: 1.6,
                                    textAlign: { xs: 'center', md: 'left' },
                                    mb: 5,
                                    maxWidth: '500px'
                                }}
                            >
                                {t('landing.hero.subtitle')}
                            </Typography>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ justifyContent: { xs: 'center', md: 'flex-start' } }}>
                                <Button 
                                    size='large' 
                                    variant='contained'
                                    sx={{
                                        px: 4,
                                        py: 1.5,
                                        borderRadius: '50px',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        boxShadow: '0 8px 25px rgba(102, 126, 234, 0.4)',
                                        fontSize: '1.1rem',
                                        fontWeight: 600,
                                        textTransform: 'none',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        '&:hover': {
                                            background: 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)',
                                            transform: 'translateY(-2px)',
                                            boxShadow: '0 12px 35px rgba(102, 126, 234, 0.6)'
                                        },
                                        '&:active': {
                                            transform: 'translateY(0px)'
                                        }
                                    }}
                                    endIcon={
                                        <ArrowForwardIcon
                                            sx={{
                                                color: 'white',
                                                background: 'transparent',
                                                transition: 'transform 0.3s ease'
                                            }}
                                        />
                                    } 
                                    onClick={() => navigate('/signin')}
                                >
                                    {t('landing.hero.ctaGetStarted')}
                                </Button>
                                <Button 
                                    size='large' 
                                    variant='outlined' 
                                    sx={{
                                        px: 4,
                                        py: 1.5,
                                        borderRadius: '50px',
                                        border: '2px solid rgba(255, 255, 255, 0.3)',
                                        color: 'rgba(255, 255, 255, 0.9)',
                                        fontSize: '1.1rem',
                                        fontWeight: 600,
                                        textTransform: 'none',
                                        backdropFilter: 'blur(10px)',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        '&:hover': {
                                            border: '2px solid rgba(255, 255, 255, 0.5)',
                                            background: 'rgba(255, 255, 255, 0.2)',
                                            transform: 'translateY(-2px)',
                                            boxShadow: '0 8px 25px rgba(255, 255, 255, 0.1)'
                                        },
                                        '&:active': {
                                            transform: 'translateY(0px)'
                                        }
                                    }}
                                    onClick={() => navigate('/register')}
                                >
                                    {t('landing.hero.ctaCreateAccount')}
                                </Button>
                            </Stack>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Box
                                sx={{
                                    position: 'relative',
                                    width: '100%',
                                    height: { xs: 350, md: 450 },
                                    borderRadius: '24px',
                                    overflow: 'hidden',
                                    background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                                    backdropFilter: 'blur(20px)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    '&:hover': {
                                        transform: 'translateY(-8px)',
                                        boxShadow: '0 30px 60px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                                    }
                                }}
                            >
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        p: 4
                                    }}
                                >
                                    <Box
                                        component="img"
                                        src="/assets/Demo.png"
                                        alt="Demo"
                                        sx={{
                                            width: '100%',
                                            maxWidth: 400,
                                            height: 'auto',
                                            borderRadius: 2,
                                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
                                            mb: 2
                                        }}
                                    />
                                </Box>
                            </Box>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* Features Section */}
            <Box
                sx={{
                    position: 'relative',
                    py: 10,
                    background: customization?.isDarkMode 
                        ? 'linear-gradient(180deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.6) 100%)'
                        : 'linear-gradient(180deg, rgba(248, 250, 252, 0.8) 0%, rgba(241, 245, 249, 0.6) 100%)',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'radial-gradient(circle at 50% 50%, rgba(102, 126, 234, 0.1) 0%, transparent 70%)',
                        pointerEvents: 'none'
                    }
                }}
            >
                <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
                    <Box sx={{ textAlign: 'center', mb: 8 }}>
                        <Typography 
                            variant="h3" 
                            sx={{ 
                                fontWeight: 700,
                                background: customization?.isDarkMode 
                                    ? 'linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%)'
                                    : 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                mb: 3
                            }}
                        >
                            {t('landing.features.title')}
                        </Typography>
                        <Typography 
                            variant="h6" 
                            sx={{ 
                                color: customization?.isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
                                maxWidth: 600,
                                mx: 'auto',
                                lineHeight: 1.6
                            }}
                        >
                            Discover powerful features designed to transform your workflow
                        </Typography>
                    </Box>
                    <Grid container spacing={6}>
                        <Grid item xs={12} md={4}>
                            <Feature icon="🔗" title={t('landing.features.visualChatflows.title')} description={t('landing.features.visualChatflows.desc')} />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Feature icon="🤖" title={t('landing.features.agentsTools.title')} description={t('landing.features.agentsTools.desc')} />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Feature icon="📊" title={t('landing.features.datasetsEvals.title')} description={t('landing.features.datasetsEvals.desc')} />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Feature icon="🗄️" title={t('landing.features.vectorStores.title')} description={t('landing.features.vectorStores.desc')} />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Feature icon="🔐" title={t('landing.features.secureAuth.title')} description={t('landing.features.secureAuth.desc')} />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Feature icon="🚀" title={t('landing.features.deployAnywhere.title')} description={t('landing.features.deployAnywhere.desc')} />
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* CTA */}
            <Box sx={{ py: 10 }}>
                <Container maxWidth='lg'>
                    <Stack spacing={2} alignItems='center'>
                        <Typography variant='h4' fontWeight={800} align='center'>
                            {t('landing.cta.title')}
                        </Typography>
                        <Typography variant='subtitle1' color='text.secondary' align='center' sx={{ maxWidth: 720 }}>
                            {t('landing.cta.subtitle')}
                        </Typography>
                        <Button 
                            size='large' 
                            variant='contained'
                            sx={{
                                px: 4,
                                py: 1.5,
                                borderRadius: '50px',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                boxShadow: '0 8px 25px rgba(102, 126, 234, 0.4)',
                                fontSize: '1.1rem',
                                fontWeight: 600,
                                textTransform: 'none',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)',
                                    transform: 'translateY(-2px)',
                                    boxShadow: '0 12px 35px rgba(102, 126, 234, 0.6)'
                                },
                                '&:active': {
                                    transform: 'translateY(0px)'
                                }
                            }}
                            endIcon={
                                <ArrowForwardIcon
                                    sx={{
                                        color: 'white',
                                        background: 'transparent',
                                        transition: 'transform 0.3s ease'
                                    }}
                                />
                            } 
                            onClick={() => navigate('/signin')}
                        >
                            {t('landing.cta.goToSignin')}
                        </Button>
                    </Stack>
                </Container>
            </Box>
        </Box>
    )
}

export default LandingPage