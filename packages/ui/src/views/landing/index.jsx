import { useEffect, useMemo, useState } from 'react'
import { alpha, keyframes } from '@mui/system'
import { Box, Button, Card, CardContent, Container, Grid, IconButton, Stack, Typography, useTheme } from '@mui/material'
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded'
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded'
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded'
import TouchAppRoundedIcon from '@mui/icons-material/TouchAppRounded'
import DeviceHubIcon from '@mui/icons-material/DeviceHub'
import StorageIcon from '@mui/icons-material/Storage'
import AssessmentIcon from '@mui/icons-material/Assessment'
import FlightTakeoffRoundedIcon from '@mui/icons-material/FlightTakeoffRounded'
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { SET_DARKMODE } from '@/store/actions'
import { useNavigate } from 'react-router-dom'

const gradientPulse = keyframes`
  0% { transform: translateY(0px) scale(1); opacity: 0.9; }
  50% { transform: translateY(-6px) scale(1.01); opacity: 1; }
  100% { transform: translateY(0px) scale(1); opacity: 0.9; }
`

const LandingPage = () => {
    const navigate = useNavigate()
    const [useCaseIndex, setUseCaseIndex] = useState(0)
    const theme = useTheme()
    const dispatch = useDispatch()
    const customization = useSelector((state) => state.customization)
    const { i18n } = useTranslation()
    const isDark = customization?.isDarkMode

    const colors = useMemo(
        () => ({
            orange: '#FF7A18',
            blue: '#0A56F0',
            dark: '#0B1021',
            light: '#F6F8FF'
        }),
        []
    )

    const features = [
        {
            title: 'Chatflows visuales',
            desc: 'Diseña flujos de IA complejos con nodos y conectores de arrastrar y soltar.',
            badge: 'Chatflows',
            icon: <TouchAppRoundedIcon fontSize='small' />,
            highlight: 'Builder visual, rápido y claro'
        },
        {
            title: 'Agentes y herramientas',
            desc: 'Compón agentes con múltiples herramientas y gestiona trazas de ejecución.',
            badge: 'Agentes',
            icon: <DeviceHubIcon fontSize='small' />,
            highlight: 'Orquestación con control total'
        },
        {
            title: 'Datasets y evaluaciones',
            desc: 'Crea datasets y ejecuta evaluaciones para medir calidad y rendimiento.',
            badge: 'Evaluaciones',
            icon: <AssessmentIcon fontSize='small' />,
            highlight: 'Métricas y scoring integrados'
        },
        {
            title: 'Almacenes vectoriales',
            desc: 'Indexa y consulta documentos usando backends vectoriales conectables.',
            badge: 'RAG',
            icon: <StorageIcon fontSize='small' />,
            highlight: 'Conectores vectoriales flexibles'
        },
        {
            title: 'Autenticación segura',
            desc: 'Roles, SSO, claves API y auditorías para organizaciones.',
            badge: 'Seguridad',
            icon: <VpnKeyRoundedIcon fontSize='small' />,
            highlight: 'Seguridad lista para enterprise'
        },
        {
            title: 'Implementa en cualquier lugar',
            desc: 'Ejecuta localmente o en la nube. Arquitectura amigable con el código abierto.',
            badge: 'Deploy',
            icon: <FlightTakeoffRoundedIcon fontSize='small' />,
            highlight: 'Libre y portable'
        }
    ]

    const useCases = [
        {
            title: 'Hoteles',
            desc: 'Landing con reserva asistida, chat contextual y cobro de suscripción o extras.',
            slug: 'hotel-gran-sol',
            image: '/assets/Demo.png'
        },
        {
            title: 'Gomerías',
            desc: 'Agente de ventas con lookup de histórico (sales) y cotización inmediata.',
            slug: 'gomerias-arg',
            image: '/assets/Demo.png'
        },
        {
            title: 'Retail',
            desc: 'Catálogo guiado, asesor virtual y cobro de add-ons por agente.',
            slug: 'retail',
            image: '/assets/Demo.png'
        }
    ]

    const steps = [
        {
            title: 'Elige o crea un template',
            desc: 'Selecciona hotel/gomerías/retail o arma uno nuevo con slug autorizado desde backend.'
        },
        {
            title: 'Configura agentes y pagos',
            desc: 'Define flujos, credenciales, roles y activa checkout seguro con Mobbex/dLocal.'
        },
        {
            title: 'Publica y cobra',
            desc: 'Despliega la landing, monitorea webhooks, y cobra suscripciones o add-ons con idempotencia.'
        }
    ]

    const metrics = [
        { label: 'HMAC webhooks', value: '100%' },
        { label: 'Rate limit checkout/webhooks', value: 'ON' },
        { label: 'Workspaces uuid', value: 'OK' },
        { label: 'Uptime objetivo', value: '99.9%' }
    ]

    const plans = [
        {
            name: 'Suscripción',
            price: '$500',
            period: '/mes',
            includes: ['Mantenimiento y soporte', 'Agente base', 'Plantillas activas', 'Acceso seguro con login'],
            cta: 'Iniciar suscripción',
            orderId: 'subscription-monthly'
        },
        {
            name: 'Agentes extra',
            price: '$200',
            period: 'c/u',
            includes: ['Agente adicional', 'Permisos por workspace', 'Logs y métricas básicas'],
            cta: 'Agregar agentes',
            orderId: 'add-agent'
        },
        {
            name: 'Pago custom/quote',
            price: 'A medida',
            period: '',
            includes: ['Quote asignable por super-admin', 'Moneda USD/ARS', 'Notificación por email (SMTP)'],
            cta: 'Solicitar quote',
            orderId: 'quote:custom'
        }
    ]

    useEffect(() => {
        const id = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? null
            : setInterval(() => setUseCaseIndex((prev) => (prev + 1) % useCases.length), 5000)
        return () => {
            if (id) clearInterval(id)
        }
    }, [useCases.length])

    const goToUseCase = (direction) => {
        setUseCaseIndex((prev) => {
            if (direction === 'next') return (prev + 1) % useCases.length
            return prev === 0 ? useCases.length - 1 : prev - 1
        })
    }

    const handleCTA = (type) => {
        if (type === 'demo') {
            navigate(`/demo/${useCases[useCaseIndex].slug}`)
            return
        }
        if (type === 'register') {
            navigate('/register')
            return
        }
        navigate('/signin')
    }

    const heroBackground = isDark
        ? `radial-gradient(circle at 20% 20%, ${alpha(colors.orange, 0.25)} 0, transparent 35%),
           radial-gradient(circle at 80% 0%, ${alpha(colors.blue, 0.2)} 0, transparent 40%),
           linear-gradient(135deg, ${alpha(colors.dark, 0.95)}, ${alpha('#0F1833', 0.95)})`
        : 'linear-gradient(135deg, #F8FAFF 0%, #EAF2FF 50%, #FFFFFF 100%)'

    const sectionBg = (dark, light) => (isDark ? dark : light)

    return (
        <Box sx={{ bgcolor: isDark ? colors.dark : '#F8FAFF', color: isDark ? '#EAF0FF' : '#0B1021' }}>
            {/* Top navigation */}
            <Box
                sx={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    backdropFilter: 'blur(12px)',
                    background: isDark ? alpha('#0A0E1C', 0.8) : alpha('#FFFFFF', 0.9),
                    borderBottom: `1px solid ${alpha(isDark ? '#fff' : '#000', 0.06)}`
                }}
            >
                <Container
                    maxWidth='lg'
                    sx={{
                        py: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}
                >
                    <Box component='img' src='/assets/Freia.png' alt='Freia logo' sx={{ height: 36 }} />
                    <Stack direction='row' spacing={1} alignItems='center'>
                        <Button
                            variant='text'
                            sx={{ color: isDark ? '#EAF0FF' : '#0B1021' }}
                            onClick={() => navigate('/demo/hotel-gran-sol')}
                        >
                            Demos
                        </Button>
                        <Button variant='text' sx={{ color: isDark ? '#EAF0FF' : '#0B1021' }} onClick={() => navigate('/signin')}>
                            Iniciar sesión
                        </Button>
                        <Button
                            variant='contained'
                            onClick={() => navigate('/register')}
                            sx={{ background: `linear-gradient(120deg, ${colors.orange}, ${colors.blue})`, fontWeight: 700, color: '#fff' }}
                        >
                            Crear cuenta
                        </Button>
                        <Button
                            variant='outlined'
                            size='small'
                            onClick={() => {
                                const next = !customization.isDarkMode
                                dispatch({ type: SET_DARKMODE, isDarkMode: next })
                                localStorage.setItem('isDarkMode', String(next))
                            }}
                            sx={{
                                color: isDark ? '#EAF0FF' : '#0B1021',
                                borderColor: alpha(isDark ? '#EAF0FF' : '#0B1021', 0.4)
                            }}
                        >
                            {isDark ? 'Light' : 'Dark'}
                        </Button>
                        <Button
                            variant='outlined'
                            size='small'
                            onClick={() => {
                                const nextLng = i18n.language === 'es' ? 'en' : 'es'
                                i18n.changeLanguage(nextLng)
                                localStorage.setItem('app_lang', nextLng)
                            }}
                            sx={{
                                color: isDark ? '#EAF0FF' : '#0B1021',
                                borderColor: alpha(isDark ? '#EAF0FF' : '#0B1021', 0.4)
                            }}
                        >
                            {i18n.language === 'es' ? 'EN' : 'ES'}
                        </Button>
                    </Stack>
                </Container>
            </Box>
            {/* Hero */}
            <Box
                sx={{
                    position: 'relative',
                    overflow: 'hidden',
                    pb: { xs: 8, md: 12 },
                    pt: { xs: 8, md: 12 },
                    background: heroBackground
                }}
            >
                <Container maxWidth='lg'>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={6} alignItems='center'>
                        <Box sx={{ flex: 1, position: 'relative' }}>
                            <Typography
                                variant='subtitle1'
                                sx={{
                                    color: colors.orange,
                                    mb: 1,
                                    fontWeight: 800,
                                    letterSpacing: 0.5,
                                    textTransform: 'uppercase'
                                }}
                            >
                                Crea, evalúa y despliega agentes de IA de forma visual
                            </Typography>
                            <Typography
                                variant='h2'
                                sx={{
                                    fontWeight: 800,
                                    lineHeight: 1.1,
                                    fontSize: { xs: '2.4rem', md: '3.2rem' },
                                    fontFamily: '"Space Grotesk","Sora","Manrope",sans-serif'
                                }}
                            >
                                Freia reúne chatflows, agentes, datasets y evaluaciones en una sola interfaz.
                            </Typography>
                            <Typography variant='h6' sx={{ mt: 2, color: alpha('#EAF0FF', 0.8), maxWidth: 640 }}>
                                Diseña y orquesta chatflows visuales, agentes con múltiples herramientas, datasets y evaluaciones, todo en una experiencia unificada.
                            </Typography>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 4 }}>
                                <Button
                                    variant='contained'
                                    color='primary'
                                    size='large'
                                    onClick={() => handleCTA('demo')}
                                    sx={{
                                        px: 3.5,
                                        py: 1.2,
                                        background: `linear-gradient(120deg, ${colors.orange}, ${colors.blue})`,
                                        fontWeight: 700,
                                        boxShadow: `0 14px 40px ${alpha(colors.orange, 0.35)}`
                                    }}
                                >
                                    Ver demo ahora
                                </Button>
                                <Button
                                    variant='outlined'
                                    size='large'
                                    onClick={() => handleCTA('register')}
                                    sx={{
                                        borderColor: alpha('#EAF0FF', 0.4),
                                        color: '#EAF0FF',
                                        '&:hover': { borderColor: colors.orange, color: colors.orange }
                                    }}
                                >
                                    Crear cuenta
                                </Button>
                            </Stack>
                            <Box sx={{ mt: 3 }} />
                        </Box>
                        <Box sx={{ flex: 1, position: 'relative', width: '100%' }}>
                            <Box
                                sx={{
                                    position: 'absolute',
                                    inset: '-10% -20% -20% -10%',
                                    background: `radial-gradient(circle at 30% 30%, ${alpha(colors.orange, 0.35)}, transparent 45%),
                                                 radial-gradient(circle at 70% 20%, ${alpha(colors.blue, 0.35)}, transparent 50%)`,
                                    filter: 'blur(48px)',
                                    opacity: 0.8,
                                    pointerEvents: 'none',
                                    animation: `${gradientPulse} 8s ease-in-out infinite`
                                }}
                            />
                            <Card
                                sx={{
                                    position: 'relative',
                                    borderRadius: 4,
                                    overflow: 'hidden',
                                    bgcolor: isDark ? alpha('#0E1529', 0.8) : '#FFFFFF',
                                    border: `1px solid ${alpha(isDark ? '#ffffff' : '#000000', 0.08)}`,
                                    boxShadow: `0 25px 80px ${alpha(colors.blue, 0.25)}`
                                }}
                                elevation={0}
                            >
                                <Box
                                    component='img'
                                    src='/assets/Freia.png'
                                    alt='Freia preview'
                                    loading='lazy'
                                    sx={{
                                        width: '100%',
                                        display: 'block',
                                        objectFit: 'cover',
                                        maxHeight: { xs: 360, md: 460 }
                                    }}
                                />
                                <CardContent
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'flex-end',
                                        gap: 2,
                                        flexWrap: 'wrap',
                                        bgcolor: alpha('#0E1529', 0.9),
                                        borderTop: `1px solid ${alpha('#fff', 0.08)}`
                                    }}
                                >
                                    <Button variant='text' sx={{ color: colors.orange, fontWeight: 700 }} onClick={() => handleCTA('login')}>
                                        Acceder
                                    </Button>
                                </CardContent>
                            </Card>
                        </Box>
                    </Stack>
                </Container>
            </Box>

            {/* Narrativa */}
            <Box sx={{ py: { xs: 6, md: 8 }, background: sectionBg('#0E1529', '#F8FAFF') }}>
                <Container maxWidth='lg'>
                    <Grid container spacing={4} alignItems='center'>
                        <Grid item xs={12} md={5}>
                            <Typography variant='h4' fontWeight={800} sx={{ mb: 2, fontFamily: '"Space Grotesk",sans-serif' }}>
                                Características poderosas
                            </Typography>
                            <Typography sx={{ color: alpha('#EAF0FF', 0.78) }}>
                                Descubre capacidades diseñadas para transformar tu flujo de trabajo: chatflows visuales, agentes con herramientas, datasets, evaluaciones y despliegues portables.
                            </Typography>
                            <Box sx={{ mt: 3 }} />
                        </Grid>
                        <Grid item xs={12} md={7}>
                            <Grid container spacing={3}>
                                {features.map((feature) => (
                                    <Grid item xs={12} sm={6} key={feature.title}>
                                        <Card
                                            sx={{
                                                height: '100%',
                                                bgcolor: alpha('#10182F', 0.9),
                                                border: `1px solid ${alpha('#fff', 0.07)}`,
                                                borderRadius: 3,
                                                transition: 'transform 200ms ease, border-color 200ms ease',
                                                '&:hover': {
                                                    transform: 'translateY(-6px)',
                                                    borderColor: alpha(colors.orange, 0.5)
                                                },
                                                '@media (prefers-reduced-motion: reduce)': {
                                                    transition: 'none',
                                                    '&:hover': { transform: 'none' }
                                                }
                                            }}
                                            elevation={0}
                                        >
                                            <CardContent>
                                                <Stack direction='row' spacing={1} alignItems='center' sx={{ mb: 1 }}>
                                                    {feature.icon}
                                                    <Typography variant='subtitle2' sx={{ color: alpha('#EAF0FF', 0.7), fontWeight: 700 }}>
                                                        {feature.badge}
                                                    </Typography>
                                                </Stack>
                                                <Typography variant='h6' fontWeight={800} gutterBottom>
                                                    {feature.title}
                                                </Typography>
                                                <Typography variant='body2' sx={{ color: alpha('#EAF0FF', 0.7), mb: 1.5 }}>
                                                    {feature.desc}
                                                </Typography>
                                                <Typography variant='body2' sx={{ color: alpha('#EAF0FF', 0.7), fontWeight: 700 }}>
                                                    {feature.highlight}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* Vista previa */}
            <Box sx={{ py: { xs: 6, md: 8 }, background: sectionBg('#0B1021', '#F0F4FF') }}>
                <Container maxWidth='lg'>
                    <Grid container spacing={4} alignItems='center'>
                        <Grid item xs={12} md={6}>
                            <Typography variant='h4' fontWeight={800} sx={{ mb: 2, fontFamily: '"Space Grotesk",sans-serif' }}>
                                Tu panel en acción
                            </Typography>
                            <Typography sx={{ color: isDark ? alpha('#EAF0FF', 0.78) : alpha('#0B1021', 0.78), mb: 2 }}>
                                Vista previa del flujo en Freia: chatflows, agentes y datasets en una sola interfaz para que configures y despliegues rápido.
                            </Typography>
                            <Stack direction='row' spacing={1} sx={{ flexWrap: 'wrap' }}>
                                <Button
                                    variant='contained'
                                    onClick={() => handleCTA('demo')}
                                    sx={{
                                        background: `linear-gradient(120deg, ${colors.orange}, ${colors.blue})`,
                                        fontWeight: 700,
                                        color: '#fff'
                                    }}
                                >
                                    Ver demo
                                </Button>
                                <Button variant='text' sx={{ color: isDark ? '#EAF0FF' : '#0B1021' }} onClick={() => navigate('/signin')}>
                                    Iniciar sesión
                                </Button>
                            </Stack>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Card
                                sx={{
                                    borderRadius: 4,
                                    overflow: 'hidden',
                                    bgcolor: isDark ? alpha('#0E1529', 0.9) : '#FFFFFF',
                                    border: `1px solid ${alpha(isDark ? '#ffffff' : '#000000', 0.06)}`,
                                    boxShadow: `0 25px 80px ${alpha(colors.blue, 0.2)}`
                                }}
                                elevation={0}
                            >
                                <Box component='img' src='/assets/Demo.png' alt='Demo Freia' loading='lazy' sx={{ width: '100%', display: 'block' }} />
                            </Card>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* Cómo funciona */}
            <Box sx={{ py: { xs: 6, md: 8 }, background: sectionBg('#0B1021', '#F0F4FF') }}>
                <Container maxWidth='lg'>
                    <Typography
                        variant='h4'
                        fontWeight={800}
                        textAlign='center'
                        sx={{ mb: 4, fontFamily: '"Space Grotesk",sans-serif' }}
                    >
                        Cómo funciona
                    </Typography>
                    <Grid container spacing={3}>
                        {steps.map((step, idx) => (
                        <Grid item xs={12} md={4} key={step.title}>
                            <Card
                                sx={{
                                    height: '100%',
                                    bgcolor: alpha('#10182F', 0.9),
                                        border: `1px solid ${alpha('#fff', 0.08)}`,
                                        borderRadius: 3,
                                        p: 2
                                    }}
                                >
                                    <Stack direction='row' spacing={2} alignItems='flex-start'>
                                        <Typography
                                            variant='subtitle1'
                                            sx={{
                                                color: colors.orange,
                                                fontWeight: 800,
                                                minWidth: 32
                                            }}
                                        >
                                            0{idx + 1}
                                        </Typography>
                                        <Box>
                                            <Typography variant='h6' fontWeight={800} gutterBottom>
                                                {step.title}
                                            </Typography>
                                            <Typography variant='body2' sx={{ color: alpha('#EAF0FF', 0.72) }}>
                                                {step.desc}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </Container>
            </Box>

            {/* Casos de uso */}
            <Box sx={{ py: { xs: 6, md: 8 }, background: sectionBg('#0E1529', '#F8FAFF') }}>
                <Container maxWidth='lg'>
                    <Stack direction='row' alignItems='center' justifyContent='space-between' sx={{ mb: 3 }}>
                        <Typography variant='h4' fontWeight={800} sx={{ fontFamily: '"Space Grotesk",sans-serif' }}>
                            Casos de uso
                        </Typography>
                        <Stack direction='row' spacing={1}>
                            <IconButton onClick={() => goToUseCase('prev')} sx={{ color: '#EAF0FF' }} aria-label='Anterior'>
                                <ArrowBackIosNewRoundedIcon />
                            </IconButton>
                            <IconButton onClick={() => goToUseCase('next')} sx={{ color: '#EAF0FF' }} aria-label='Siguiente'>
                                <ArrowForwardIosRoundedIcon />
                            </IconButton>
                        </Stack>
                    </Stack>
                    <Grid container spacing={3} alignItems='center'>
                            <Grid item xs={12} md={6}>
                                <Card
                                    sx={{
                                        bgcolor: alpha('#10182F', 0.9),
                                        border: `1px solid ${alpha('#fff', 0.08)}`,
                                        borderRadius: 3,
                                        overflow: 'hidden'
                                    }}
                                >
                                    <Box
                                        component='img'
                                        src={useCases[useCaseIndex].image}
                                        alt={useCases[useCaseIndex].title}
                                        loading='lazy'
                                        sx={{ width: '100%', display: 'block' }}
                                    />
                                </Card>
                            </Grid>
                        <Grid item xs={12} md={6}>
                            <Typography variant='h5' fontWeight={800} gutterBottom>
                                {useCases[useCaseIndex].title}
                            </Typography>
                            <Typography sx={{ color: alpha('#EAF0FF', 0.72), mb: 2 }}>
                                {useCases[useCaseIndex].desc}
                            </Typography>
                            <Stack direction='row' spacing={1} sx={{ mb: 3, flexWrap: 'wrap' }}>
                                <Typography variant='body2' sx={{ color: alpha('#EAF0FF', 0.75), fontWeight: 700 }}>
                                    CTA via /api/templates — slug autorizado
                                </Typography>
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                <Button
                                    variant='contained'
                                    onClick={() => navigate(`/demo/${useCases[useCaseIndex].slug}`)}
                                    sx={{
                                        background: `linear-gradient(120deg, ${colors.orange}, ${colors.blue})`,
                                        fontWeight: 700
                                    }}
                                >
                                    Ver demo de {useCases[useCaseIndex].title.toLowerCase()}
                                </Button>
                                <Button variant='outlined' onClick={() => handleCTA('register')} sx={{ color: '#EAF0FF' }}>
                                    Crear cuenta
                                </Button>
                            </Stack>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* Pricing */}
            <Box sx={{ py: { xs: 6, md: 8 }, background: sectionBg('#0E1529', '#F8FAFF') }}>
                <Container maxWidth='lg'>
                    <Typography
                        variant='h4'
                        fontWeight={800}
                        textAlign='center'
                        sx={{ mb: 3, fontFamily: '"Space Grotesk",sans-serif' }}
                    >
                        Pricing simple y directo
                    </Typography>
                    <Typography textAlign='center' sx={{ color: alpha('#EAF0FF', 0.7), mb: 4 }}>
                        Suscripción base, agentes adicionales y pagos custom vía quote. Checkout protegido (login) y
                        soporte incluido.
                    </Typography>
                    <Grid container spacing={3}>
                        {plans.map((plan) => (
                            <Grid item xs={12} md={4} key={plan.name}>
                                <Card
                                    sx={{
                                        height: '100%',
                                        bgcolor: alpha('#10182F', 0.9),
                                        border: `1px solid ${alpha('#fff', 0.08)}`,
                                        borderRadius: 3,
                                        p: 3,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 2,
                                        transition: 'transform 200ms ease, border-color 200ms ease',
                                        '&:hover': {
                                            transform: 'translateY(-6px)',
                                            borderColor: alpha(colors.orange, 0.5)
                                        },
                                        '@media (prefers-reduced-motion: reduce)': {
                                            transition: 'none',
                                            '&:hover': { transform: 'none' }
                                        }
                                    }}
                                >
                                    <Stack direction='row' justifyContent='space-between' alignItems='center'>
                                        <Typography variant='h6' fontWeight={800}>
                                            {plan.name}
                                        </Typography>
                                        <Typography variant='body2' sx={{ color: alpha('#EAF0FF', 0.7) }}>
                                            {plan.orderId.startsWith('quote') ? 'Custom' : 'Checkout'}
                                        </Typography>
                                    </Stack>
                                    <Box>
                                        <Typography variant='h4' fontWeight={900}>
                                            {plan.price}{' '}
                                            <Typography component='span' variant='subtitle1' color={alpha('#EAF0FF', 0.7)}>
                                                {plan.period}
                                            </Typography>
                                        </Typography>
                                    </Box>
                                    <Stack spacing={1}>
                                        {plan.includes.map((item) => (
                                            <Stack direction='row' spacing={1} alignItems='center' key={item}>
                                                <CheckRoundedIcon sx={{ color: colors.orange, fontSize: 18 }} />
                                                <Typography variant='body2' sx={{ color: alpha('#EAF0FF', 0.75) }}>
                                                    {item}
                                                </Typography>
                                            </Stack>
                                        ))}
                                    </Stack>
                                    <Box sx={{ flexGrow: 1 }} />
                                    <Button
                                        variant='contained'
                                        onClick={() => navigate('/signin')}
                                        sx={{
                                            background: `linear-gradient(120deg, ${colors.orange}, ${colors.blue})`,
                                            fontWeight: 700
                                        }}
                                    >
                                        {plan.cta}
                                    </Button>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </Container>
            </Box>

            {/* CTA final */}
            <Box sx={{ py: { xs: 6, md: 8 }, background: sectionBg('#0B1021', '#F0F4FF') }}>
                <Container maxWidth='lg'>
                    <Card
                        sx={{
                            borderRadius: 4,
                            overflow: 'hidden',
                            border: `1px solid ${alpha('#fff', 0.08)}`,
                            background: `linear-gradient(120deg, ${alpha('#FFFFFF', 0.08)}, ${alpha('#FFFFFF', 0.06)})`
                        }}
                        elevation={0}
                    >
                        <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={3}
                            alignItems='center'
                            justifyContent='space-between'
                            sx={{ p: { xs: 3, md: 4 } }}
                        >
                            <Box>
                                <Typography variant='h5' fontWeight={800} gutterBottom sx={{ color: isDark ? '#FFFFFF' : '#0B1021' }}>
                                    ¿Listo para explorar Freia?
                                </Typography>
                                <Typography sx={{ color: isDark ? alpha('#FFFFFF', 0.85) : alpha('#0B1021', 0.78) }}>
                                    Inicia sesión para empezar a crear chatflows, conectar herramientas y evaluar tus casos de uso de IA.
                                </Typography>
                            </Box>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                <Button
                                    variant='contained'
                                    onClick={() => handleCTA('demo')}
                                    sx={{
                                        background: colors.dark,
                                        color: '#fff',
                                        fontWeight: 700,
                                        px: 3
                                    }}
                                >
                                    Ver demos
                                </Button>
                                <Button
                                    variant='outlined'
                                    onClick={() => handleCTA('register')}
                                    sx={{
                                        borderColor: colors.dark,
                                        color: colors.dark,
                                        fontWeight: 700,
                                        background: alpha('#fff', 0.9)
                                    }}
                                >
                                    Crear cuenta
                                </Button>
                            </Stack>
                        </Stack>
                    </Card>
                </Container>
            </Box>

        </Box>
    )
}

export default LandingPage
