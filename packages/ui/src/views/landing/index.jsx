import { useEffect, useMemo, useState } from 'react'
import { alpha, keyframes } from '@mui/system'
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Container,
    Grid,
    IconButton,
    Stack,
    Typography
} from '@mui/material'
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded'
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded'
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded'
import TouchAppRoundedIcon from '@mui/icons-material/TouchAppRounded'
import { useNavigate } from 'react-router-dom'

const gradientPulse = keyframes`
  0% { transform: translateY(0px) scale(1); opacity: 0.9; }
  50% { transform: translateY(-6px) scale(1.01); opacity: 1; }
  100% { transform: translateY(0px) scale(1); opacity: 0.9; }
`

const LandingPage = () => {
    const navigate = useNavigate()
    const [useCaseIndex, setUseCaseIndex] = useState(0)

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
            title: 'Agentes y chatflows seguros',
            desc: 'Crea agentes con permisos por workspace, guarda flows y credenciales en Postgres con ids uuid y auditoría.',
            badge: 'Agentflow',
            icon: <TouchAppRoundedIcon fontSize='small' />,
            highlight: 'Permisos por workspace + guardado seguro'
        },
        {
            title: 'Pagos híbridos y protegidos',
            desc: 'Mobbex/dLocal con HMAC, idempotencia y quotes asignables. Checkout protegido (auth) y webhooks rate-limited.',
            badge: 'Payments',
            icon: <SecurityRoundedIcon fontSize='small' />,
            highlight: 'HMAC + idempotencia + rate limit'
        },
        {
            title: 'Templates por industria',
            desc: 'Hotel, gomerías, retail. Asigna templates por rol/super-admin vía API `/api/templates` y slugs autorizados.',
            badge: 'Templates',
            icon: <SpeedRoundedIcon fontSize='small' />,
            highlight: 'Slugs controlados desde backend'
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
        navigate('/login')
    }

    return (
        <Box sx={{ bgcolor: colors.dark, color: '#EAF0FF' }}>
            {/* Hero */}
            <Box
                sx={{
                    position: 'relative',
                    overflow: 'hidden',
                    pb: { xs: 8, md: 12 },
                    pt: { xs: 8, md: 12 },
                    background: `radial-gradient(circle at 20% 20%, ${alpha(colors.orange, 0.25)} 0, transparent 35%),
                                 radial-gradient(circle at 80% 0%, ${alpha(colors.blue, 0.2)} 0, transparent 40%),
                                 linear-gradient(135deg, ${alpha(colors.dark, 0.95)}, ${alpha('#0F1833', 0.95)})`
                }}
            >
                <Container maxWidth='lg'>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={6} alignItems='center'>
                        <Box sx={{ flex: 1, position: 'relative' }}>
                            <Chip
                                label='Agentes + Pagos seguros'
                                sx={{
                                    bgcolor: alpha(colors.orange, 0.12),
                                    color: colors.orange,
                                    mb: 2,
                                    fontWeight: 700,
                                    letterSpacing: 0.3
                                }}
                            />
                            <Typography
                                variant='h2'
                                sx={{
                                    fontWeight: 800,
                                    lineHeight: 1.1,
                                    fontSize: { xs: '2.4rem', md: '3.2rem' },
                                    fontFamily: '"Space Grotesk","Sora","Manrope",sans-serif'
                                }}
                            >
                                Freia: agentes que cobran por ti, con seguridad de punta
                            </Typography>
                            <Typography variant='h6' sx={{ mt: 2, color: alpha('#EAF0FF', 0.8), maxWidth: 640 }}>
                                Templates por industria, pagos híbridos (Mobbex/dLocal), permisos por workspace y
                                webhooks con HMAC + rate limit. Todo en un flujo moderno y rápido.
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
                            <Stack direction='row' spacing={1.5} sx={{ mt: 3, flexWrap: 'wrap' }}>
                                <Chip
                                    icon={<CheckRoundedIcon />}
                                    label='Checkout protegido (auth)'
                                    sx={{ bgcolor: alpha(colors.blue, 0.16), color: '#EAF0FF' }}
                                />
                                <Chip
                                    icon={<CheckRoundedIcon />}
                                    label='HMAC webhooks + idempotencia'
                                    sx={{ bgcolor: alpha(colors.orange, 0.18), color: '#EAF0FF' }}
                                />
                                <Chip
                                    icon={<CheckRoundedIcon />}
                                    label='Templates hotel/gomerías/retail'
                                    sx={{ bgcolor: alpha('#fff', 0.08), color: '#EAF0FF' }}
                                />
                            </Stack>
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
                                    bgcolor: alpha('#0E1529', 0.8),
                                    border: `1px solid ${alpha('#ffffff', 0.08)}`,
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
                                        justifyContent: 'space-between',
                                        gap: 2,
                                        flexWrap: 'wrap',
                                        bgcolor: alpha('#0E1529', 0.9),
                                        borderTop: `1px solid ${alpha('#fff', 0.08)}`
                                    }}
                                >
                                    <Stack direction='row' spacing={1} alignItems='center'>
                                        <SecurityRoundedIcon sx={{ color: colors.orange }} />
                                        <Typography variant='subtitle1' fontWeight={700}>
                                            HMAC + Rate limit
                                        </Typography>
                                    </Stack>
                                    <Button
                                        variant='text'
                                        sx={{ color: colors.orange, fontWeight: 700 }}
                                        onClick={() => handleCTA('login')}
                                    >
                                        Ver seguridad
                                    </Button>
                                </CardContent>
                            </Card>
                        </Box>
                    </Stack>
                </Container>
            </Box>

            {/* Narrativa */}
            <Box sx={{ py: { xs: 6, md: 8 }, background: '#0E1529' }}>
                <Container maxWidth='lg'>
                    <Grid container spacing={4} alignItems='center'>
                        <Grid item xs={12} md={5}>
                            <Typography variant='h4' fontWeight={800} sx={{ mb: 2, fontFamily: '"Space Grotesk",sans-serif' }}>
                                Hecho para agentes que cobran
                            </Typography>
                            <Typography sx={{ color: alpha('#EAF0FF', 0.78) }}>
                                Freia combina agentes, landing templates y pagos híbridos con control de permisos. Roles
                                super-admin asignan templates y quotes; usuarios finales ven solo lo autorizado.
                            </Typography>
                            <Stack direction='row' spacing={1.5} sx={{ mt: 3, flexWrap: 'wrap' }}>
                                <Chip label='Workspaces uuid' sx={{ bgcolor: alpha(colors.blue, 0.15), color: '#EAF0FF' }} />
                                <Chip label='Pagos seguros' sx={{ bgcolor: alpha(colors.orange, 0.18), color: '#EAF0FF' }} />
                                <Chip label='Templates por rol' sx={{ bgcolor: alpha('#fff', 0.08), color: '#EAF0FF' }} />
                            </Stack>
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
                                                    <Chip
                                                        icon={feature.icon}
                                                        label={feature.badge}
                                                        size='small'
                                                        sx={{ bgcolor: alpha(colors.orange, 0.15), color: '#EAF0FF' }}
                                                    />
                                                </Stack>
                                                <Typography variant='h6' fontWeight={800} gutterBottom>
                                                    {feature.title}
                                                </Typography>
                                                <Typography variant='body2' sx={{ color: alpha('#EAF0FF', 0.7), mb: 1.5 }}>
                                                    {feature.desc}
                                                </Typography>
                                                <Chip
                                                    size='small'
                                                    label={feature.highlight}
                                                    sx={{ bgcolor: alpha(colors.blue, 0.18), color: '#EAF0FF' }}
                                                />
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* Cómo funciona */}
            <Box sx={{ py: { xs: 6, md: 8 }, background: '#0B1021' }}>
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
                                        <Chip
                                            label={`0${idx + 1}`}
                                            sx={{
                                                bgcolor: alpha(colors.orange, 0.18),
                                                color: '#EAF0FF',
                                                fontWeight: 700
                                            }}
                                        />
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
            <Box sx={{ py: { xs: 6, md: 8 }, background: '#0E1529' }}>
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
                                <Chip label='CTA a /api/templates' sx={{ bgcolor: alpha(colors.blue, 0.2), color: '#EAF0FF' }} />
                                <Chip label='Slug autorizado' sx={{ bgcolor: alpha(colors.orange, 0.18), color: '#EAF0FF' }} />
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

            {/* Métricas y confianza */}
            <Box sx={{ py: { xs: 6, md: 8 }, background: '#0B1021' }}>
                <Container maxWidth='lg'>
                    <Typography
                        variant='h4'
                        fontWeight={800}
                        textAlign='center'
                        sx={{ mb: 3, fontFamily: '"Space Grotesk",sans-serif' }}
                    >
                        Seguridad y confiabilidad
                    </Typography>
                    <Stack
                        direction='row'
                        spacing={2}
                        justifyContent='center'
                        sx={{ flexWrap: 'wrap', rowGap: 2, mb: 4 }}
                    >
                        {metrics.map((metric) => (
                            <Chip
                                key={metric.label}
                                label={`${metric.label}: ${metric.value}`}
                                sx={{ bgcolor: alpha(colors.blue, 0.2), color: '#EAF0FF', px: 1.5, py: 1 }}
                            />
                        ))}
                    </Stack>
                    <Card
                        sx={{
                            maxWidth: 960,
                            margin: '0 auto',
                            bgcolor: alpha('#10182F', 0.92),
                            border: `1px solid ${alpha('#fff', 0.08)}`,
                            borderRadius: 4,
                            p: { xs: 3, md: 4 }
                        }}
                    >
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems='center'>
                            <SecurityRoundedIcon sx={{ fontSize: 48, color: colors.orange }} />
                            <Box>
                                <Typography variant='h6' fontWeight={800} gutterBottom>
                                    HMAC + Idempotencia + Rate limit
                                </Typography>
                                <Typography sx={{ color: alpha('#EAF0FF', 0.75) }}>
                                    Webhooks autenticados, reintentos idempotentes y límites de solicitudes en checkout y
                                    webhooks. Roles super-admin asignan quotes y slugs; usuarios acceden solo a lo autorizado.
                                </Typography>
                            </Box>
                        </Stack>
                    </Card>
                </Container>
            </Box>

            {/* Pricing */}
            <Box sx={{ py: { xs: 6, md: 8 }, background: '#0E1529' }}>
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
                                        <Chip
                                            label={plan.orderId.startsWith('quote') ? 'Custom' : 'Checkout'}
                                            size='small'
                                            sx={{ bgcolor: alpha(colors.blue, 0.18), color: '#EAF0FF' }}
                                        />
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
                                        onClick={() => navigate('/login')}
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
            <Box sx={{ py: { xs: 6, md: 8 }, background: '#0B1021' }}>
                <Container maxWidth='lg'>
                    <Card
                        sx={{
                            borderRadius: 4,
                            overflow: 'hidden',
                            border: `1px solid ${alpha('#fff', 0.08)}`,
                            background: `linear-gradient(120deg, ${alpha(colors.orange, 0.18)}, ${alpha(colors.blue, 0.2)})`
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
                                <Typography variant='h5' fontWeight={800} gutterBottom>
                                    ¿Listo para lanzar tu landing de cobros con agentes?
                                </Typography>
                                <Typography sx={{ color: alpha('#0B1021', 0.85) }}>
                                    Prueba las demos, crea tu cuenta y activa pagos seguros con HMAC + rate limit.
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
                                    sx={{ borderColor: colors.dark, color: colors.dark, fontWeight: 700 }}
                                >
                                    Crear cuenta
                                </Button>
                            </Stack>
                        </Stack>
                    </Card>
                </Container>
            </Box>

            {/* Footer */}
            <Box sx={{ py: 4, background: '#0A0E1C', borderTop: `1px solid ${alpha('#fff', 0.08)}` }}>
                <Container maxWidth='lg'>
                    <Grid container spacing={2} alignItems='center'>
                        <Grid item xs={12} md={6}>
                            <Typography variant='h6' fontWeight={800}>
                                Freia
                            </Typography>
                            <Typography variant='body2' sx={{ color: alpha('#EAF0FF', 0.65) }}>
                                Agentes, pagos y templates seguros en un solo flujo.
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Stack
                                direction='row'
                                spacing={3}
                                justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
                                sx={{ flexWrap: 'wrap', rowGap: 1.5 }}
                            >
                                <Button variant='text' sx={{ color: '#EAF0FF' }} onClick={() => navigate('/login')}>
                                    Login
                                </Button>
                                <Button variant='text' sx={{ color: '#EAF0FF' }} onClick={() => navigate('/register')}>
                                    Registro
                                </Button>
                                <Button variant='text' sx={{ color: '#EAF0FF' }} onClick={() => navigate('/demo/hotel-gran-sol')}>
                                    Demos
                                </Button>
                            </Stack>
                        </Grid>
                    </Grid>
                </Container>
            </Box>
        </Box>
    )
}

export default LandingPage
