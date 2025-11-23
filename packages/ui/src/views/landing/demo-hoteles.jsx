import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    IconButton,
    MenuItem,
    Select,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography
} from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import CloseIcon from '@mui/icons-material/Close'
import { useNavigate, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTheme, styled } from '@mui/material/styles'
import { SET_DARKMODE } from '@/store/actions'

const MaterialUISwitch = styled((props) => <ToggleButton {...props} />)(({ theme }) => ({
    border: 'none',
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
}))

const TemplateCard = ({ template, active, onSelect, onEdit, isSuperAdmin }) => {
    return (
        <Card
            sx={{
                height: '100%',
                borderRadius: '20px',
                border: active ? '2px solid #667eea' : '1px solid rgba(255,255,255,0.15)',
                background: active ? 'linear-gradient(135deg, rgba(102,126,234,0.1), rgba(118,75,162,0.1))' : 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(12px)',
                transition: 'all 0.25s ease',
                boxShadow: active ? '0 10px 30px rgba(102,126,234,0.25)' : '0 8px 20px rgba(0,0,0,0.08)'
            }}
        >
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Stack direction='row' spacing={1} alignItems='center'>
                    <Chip label={template.vertical || 'Template'} color='primary' size='small' />
                    <Chip label={template.name} variant='outlined' size='small' />
                    {isSuperAdmin && (
                        <Tooltip title='Editar template'>
                            <IconButton
                                size='small'
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onEdit?.(template)
                                }}
                            >
                                <EditIcon fontSize='small' />
                            </IconButton>
                        </Tooltip>
                    )}
                </Stack>
                <Typography variant='h6' fontWeight={700}>
                    {template.hero?.title || template.name}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                    {template.summary}
                </Typography>
                <Stack direction='row' spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                    {(template.features || []).slice(0, 2).map((f) => (
                        <Chip key={f.title} label={f.title} size='small' />
                    ))}
                </Stack>
                <Typography variant='caption' color='text.secondary'>
                    Ruta: /demo/{template.slug}
                </Typography>
                <Button
                    variant={active ? 'contained' : 'outlined'}
                    onClick={() => onSelect(template.slug)}
                    sx={{ alignSelf: 'flex-start', borderRadius: '12px' }}
                >
                    {active ? 'Template activa' : 'Usar esta template'}
                </Button>
            </CardContent>
        </Card>
    )
}

const FeatureCard = ({ icon, title, desc }) => (
    <Card
        sx={{
            height: '100%',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(10px)'
        }}
    >
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant='h4'>{icon}</Typography>
            <Typography variant='h6' fontWeight={700}>
                {title}
            </Typography>
            <Typography variant='body2' color='text.secondary'>
                {desc}
            </Typography>
        </CardContent>
    </Card>
)

const FlowCard = ({ title, bullets }) => (
    <Card
        sx={{
            height: '100%',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(10px)'
        }}
    >
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant='h6' fontWeight={700}>
                {title}
            </Typography>
            {bullets.map((b) => (
                <Stack key={b} direction='row' spacing={1} alignItems='flex-start'>
                    <Typography variant='body2' fontWeight={700}>
                        •
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                        {b}
                    </Typography>
                </Stack>
            ))}
        </CardContent>
    </Card>
)

const TemplateModal = ({ open, onClose, onSubmit, initialData, saving, error }) => {
    const [slug, setSlug] = useState(initialData?.slug || '')
    const [name, setName] = useState(initialData?.name || '')
    const [ownerWorkspaceId, setOwnerWorkspaceId] = useState(initialData?.ownerWorkspaceId || '')
    const [configText, setConfigText] = useState(JSON.stringify(initialData?.config || {}, null, 2))
    const [localError, setLocalError] = useState('')

    useEffect(() => {
        setSlug(initialData?.slug || '')
        setName(initialData?.name || '')
        setOwnerWorkspaceId(initialData?.ownerWorkspaceId || '')
        setConfigText(JSON.stringify(initialData?.config || {}, null, 2))
        setLocalError('')
    }, [initialData, open])

    const handleSave = () => {
        try {
            if (!slug.trim()) {
                setLocalError('El slug es obligatorio')
                return
            }
            const parsedConfig = configText.trim() ? JSON.parse(configText) : {}
            onSubmit({
                slug,
                name,
                ownerWorkspaceId: ownerWorkspaceId || null,
                config: parsedConfig
            })
        } catch (err) {
            setLocalError('El config debe ser JSON válido')
        }
    }

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth='md'>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
                {initialData?.mode === 'edit' ? 'Editar template' : 'Nueva template'}
                <IconButton onClick={onClose} size='small'>
                    <CloseIcon fontSize='small' />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <TextField
                            fullWidth
                            label='Slug'
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            placeholder='hotel-gran-sol'
                        />
                        <TextField
                            fullWidth
                            label='Nombre'
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder='Cadena de Hoteles'
                        />
                    </Stack>
                    <TextField
                        fullWidth
                        label='Workspace (opcional)'
                        value={ownerWorkspaceId || ''}
                        onChange={(e) => setOwnerWorkspaceId(e.target.value)}
                        placeholder='oss-mode'
                    />
                    <TextField
                        fullWidth
                        label='Config JSON'
                        value={configText}
                        onChange={(e) => setConfigText(e.target.value)}
                        minRows={10}
                        multiline
                        placeholder='{"vertical":"..."}'
                    />
                    {(localError || error) && (
                        <Alert severity='error'>{localError || error}</Alert>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose}>Cancelar</Button>
                <Button onClick={handleSave} variant='contained' disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar'}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

const normalizeTemplate = (template = {}) => {
    let config = {}
    if (template.config) {
        if (typeof template.config === 'string') {
            try {
                config = JSON.parse(template.config)
            } catch (err) {
                config = {}
            }
        } else if (typeof template.config === 'object') {
            config = template.config
        }
    }
    const aliases = Array.isArray(config.aliases) ? config.aliases.map((alias) => alias.toString()) : []
    return {
        id: template.slug || config.id || template.id,
        slug: template.slug || config.slug || template.id,
        name: template.name || config.name || template.slug,
        vertical: config.vertical || 'Landing',
        summary: config.summary || '',
        hero: config.hero || {},
        kpis: config.kpis || [],
        features: config.features || [],
        flows: config.flows || [],
        howItWorks: config.howItWorks || [],
        value: config.value || [],
        aliases,
        ownerWorkspaceId: template.ownerWorkspaceId || config.ownerWorkspaceId || null
    }
}

const DemoHoteles = () => {
    const navigate = useNavigate()
    const { landingId } = useParams()
    const theme = useTheme()
    const dispatch = useDispatch()
    const customization = useSelector((state) => state.customization)
    const authUser = useSelector((state) => state.auth?.user)
    const permissions = useSelector((state) => state.auth?.permissions)

    const isSuperAdmin = useMemo(() => {
        const role = authUser?.role
        const perms = Array.isArray(permissions) ? permissions : []
        return role === 'super-admin' || role === 'super_admin' || perms.includes('*')
    }, [authUser?.role, permissions])

    const authHeaders = useMemo(() => {
        const headers = { 'x-request-from': 'internal' }
        if (authUser?.role) headers['x-user-role'] = authUser.role
        if (authUser?.id) headers['x-user-id'] = authUser.id
        return headers
    }, [authUser?.id, authUser?.role])

    const [lang, setLang] = useState(
        (typeof window !== 'undefined' && localStorage.getItem('app_lang')) || 'es'
    )
    const [isDark, setIsDark] = useState(customization.isDarkMode)
    const [templates, setTemplates] = useState([])
    const [activeSlug, setActiveSlug] = useState('')
    const [verticalFilter, setVerticalFilter] = useState('all')
    const [loadingTemplates, setLoadingTemplates] = useState(false)
    const [accessError, setAccessError] = useState('')
    const [fetchError, setFetchError] = useState('')
    const [modalState, setModalState] = useState({ open: false, template: null, mode: 'create' })
    const [modalSaving, setModalSaving] = useState(false)
    const [modalError, setModalError] = useState('')

    const activeTemplate = useMemo(() => {
        if (!templates.length) return null
        return templates.find((tpl) => tpl.slug === activeSlug) || templates[0]
    }, [activeSlug, templates])

    const persistEndpoint =
        typeof import.meta !== 'undefined' && import.meta.env?.VITE_TEMPLATE_SELECTION_ENDPOINT
            ? import.meta.env.VITE_TEMPLATE_SELECTION_ENDPOINT
            : null

    const persistSelection = async (templateSlug, action = 'select') => {
        if (!persistEndpoint) return
        try {
            await fetch(persistEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateId: templateSlug,
                    at: new Date().toISOString(),
                    path: window?.location?.pathname || '',
                    action
                })
            })
        } catch (err) {
            console.warn('No se pudo persistir la selección de landing', err)
        }
    }

    const fetchTemplates = useCallback(async () => {
        setLoadingTemplates(true)
        setAccessError('')
        setFetchError('')
        try {
            const res = await fetch('/api/v1/templates', {
                credentials: 'include',
                headers: authHeaders
            })
            if (res.status === 401 || res.status === 403) {
                setAccessError('No autorizado para ver plantillas asignadas')
                setTemplates([])
                return []
            }
            if (!res.ok) {
                throw new Error('Error al obtener templates')
            }
            const data = await res.json()
            const normalized = Array.isArray(data.templates) ? data.templates.map(normalizeTemplate) : []
            setTemplates(normalized)
            return normalized
        } catch (err) {
            setFetchError('No se pudieron cargar las templates desde el servidor')
            setTemplates([])
            return []
        } finally {
            setLoadingTemplates(false)
        }
    }, [authHeaders])

    const verifyTemplateAccess = useCallback(async (slug) => {
        try {
            const res = await fetch(`/api/v1/templates/${slug}`, {
                credentials: 'include',
                headers: authHeaders
            })
            if (res.status === 401 || res.status === 403) {
                setAccessError('No autorizado para acceder a esta landing')
                return null
            }
            if (res.status === 404) {
                setAccessError('Template no encontrada o sin acceso')
                return null
            }
            if (!res.ok) throw new Error('Error al validar template')
            const data = await res.json()
            return normalizeTemplate(data.template)
        } catch (err) {
            setFetchError('No se pudo validar la template solicitada')
            return null
        }
    }, [authHeaders])

    const mergeTemplates = useCallback((base, maybeTemplate) => {
        if (!maybeTemplate) return base
        const exists = base.some((tpl) => tpl.slug === maybeTemplate.slug)
        if (exists) return base
        return [maybeTemplate, ...base]
    }, [])

    useEffect(() => {
        const bootstrap = async () => {
            const baseTemplates = await fetchTemplates()

            let nextSlug = ''
            const storedPreference =
                typeof window !== 'undefined' ? localStorage.getItem('preferredLandingTemplateSlug') : null

            if (landingId) {
                const verified = await verifyTemplateAccess(landingId)
                if (verified) {
                    setTemplates((current) => mergeTemplates(current.length ? current : baseTemplates, verified))
                    nextSlug = verified.slug
                } else if (baseTemplates.length) {
                    nextSlug = baseTemplates[0].slug
                }
            } else if (storedPreference) {
                nextSlug = storedPreference
            }

            if (!nextSlug && baseTemplates.length) {
                nextSlug = baseTemplates[0].slug
            }

            if (nextSlug) setActiveSlug(nextSlug)
        }
        bootstrap()
    }, [fetchTemplates, landingId, mergeTemplates, verifyTemplateAccess])

    useEffect(() => {
        if (activeTemplate?.hero?.title) {
            document.title = `${activeTemplate.hero.title} · Demo`
        }
    }, [activeTemplate])

    useEffect(() => {
        if (typeof window !== 'undefined' && activeTemplate?.slug) {
            localStorage.setItem('preferredLandingTemplateSlug', activeTemplate.slug)
        }
    }, [activeTemplate?.slug])

    useEffect(() => {
        if (activeTemplate?.slug) {
            persistSelection(activeTemplate.slug)
        }
    }, [activeTemplate?.slug])

    const handleLangToggle = (event, nextLang) => {
        if (!nextLang) return
        setLang(nextLang)
        if (typeof window !== 'undefined') localStorage.setItem('app_lang', nextLang)
    }

    const toggleDark = () => {
        dispatch({ type: SET_DARKMODE, isDarkMode: !isDark })
        setIsDark((prev) => !prev)
        localStorage.setItem('isDarkMode', !isDark)
    }

    const handleTemplateSelect = (slug) => {
        setActiveSlug(slug)
        navigate(`/demo/${slug}`)
        persistSelection(slug)
    }

    const openPrimaryCta = () => {
        if (activeTemplate?.hero?.chatLink) {
            window.open(activeTemplate.hero.chatLink, '_blank', 'noopener,noreferrer')
            persistSelection(activeTemplate.slug, 'cta_chat')
        } else {
            navigate('/signin')
        }
    }

    const openSecondaryCta = () => {
        if (activeTemplate?.hero?.secondaryLink?.startsWith('http')) {
            window.open(activeTemplate.hero.secondaryLink, '_blank', 'noopener,noreferrer')
            persistSelection(activeTemplate.slug, 'cta_api')
        } else if (activeTemplate?.hero?.secondaryLink) {
            navigate(activeTemplate.hero.secondaryLink)
        } else {
            navigate('/api-docs')
        }
    }

    const handleOpenModal = (template, mode = 'edit') => {
        setModalError('')
        setModalState({
            open: true,
            template: template
                ? { ...template, mode }
                : { mode: 'create', config: { hero: {}, kpis: [], features: [], flows: [], howItWorks: [], value: [] } },
            mode
        })
    }

    const handleSaveTemplate = async (payload) => {
        setModalSaving(true)
        setModalError('')
        try {
            const endpoint =
                modalState.mode === 'edit' && modalState.template?.slug
                    ? `/api/v1/templates/${modalState.template.slug}`
                    : '/api/v1/templates'
            const method = modalState.mode === 'edit' ? 'PUT' : 'POST'
            const requestPayload = {
                ...payload,
                slug: payload.slug.trim(),
                name: payload.name?.trim() || payload.slug.trim()
            }
            const res = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                credentials: 'include',
                body: JSON.stringify(requestPayload)
            })

            if (res.status === 401 || res.status === 403) {
                setModalError('Solo un super_admin puede crear o editar templates')
                return
            }

            if (!res.ok) {
                setModalError('No se pudo guardar la template')
                return
            }

            const data = await res.json()
            const savedTemplate = normalizeTemplate(data.template)
            setTemplates((current) => {
                const filtered = current.filter((tpl) => tpl.slug !== savedTemplate.slug)
                return [savedTemplate, ...filtered]
            })
            setActiveSlug(savedTemplate.slug)
            setModalState({ open: false, template: null, mode: 'create' })
        } catch (err) {
            setModalError('Error inesperado al guardar la template')
        } finally {
            setModalSaving(false)
        }
    }

    const filteredTemplates = templates.filter(
        (tpl) => verticalFilter === 'all' || tpl.vertical === verticalFilter
    )
    const availableVerticals = [...new Set(templates.map((t) => t.vertical).filter(Boolean))]

    if (!loadingTemplates && !templates.length && accessError) {
        return (
            <Container maxWidth='md' sx={{ py: 10 }}>
                <Alert severity='error' sx={{ mb: 2 }}>
                    {accessError}
                </Alert>
                {isSuperAdmin && (
                    <Button variant='contained' startIcon={<AddIcon />} onClick={() => handleOpenModal(null, 'create')}>
                        Nueva template
                    </Button>
                )}
            </Container>
        )
    }

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ position: 'fixed', top: 16, right: 24, display: 'flex', gap: 2, zIndex: 1200 }}>
                <ToggleButtonGroup
                    value={lang}
                    exclusive
                    onChange={handleLangToggle}
                    sx={{
                        borderRadius: '12px',
                        maxHeight: 40,
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
                    }}
                >
                    <MaterialUISwitch value='en'>EN</MaterialUISwitch>
                    <MaterialUISwitch value='es'>ES</MaterialUISwitch>
                </ToggleButtonGroup>
                <Button variant='outlined' onClick={toggleDark} sx={{ borderRadius: '12px' }}>
                    {customization.isDarkMode ? 'Light' : 'Dark'}
                </Button>
            </Box>

            {accessError && (
                <Container maxWidth='lg' sx={{ pt: 10 }}>
                    <Alert severity='error' sx={{ mb: 2 }}>
                        {accessError}
                    </Alert>
                </Container>
            )}

            <Box
                sx={{
                    pt: 16,
                    pb: 12,
                    background:
                        theme.palette.mode === 'dark'
                            ? 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 25%, #16213e 50%, #0f3460 75%, #533483 100%)'
                            : 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%)'
                }}
            >
                <Container maxWidth='lg'>
                    {loadingTemplates && (
                        <Stack direction='row' spacing={1} alignItems='center' sx={{ mb: 2 }}>
                            <CircularProgress size={20} color='inherit' />
                            <Typography variant='body2'>Cargando templates...</Typography>
                        </Stack>
                    )}
                    <Grid container spacing={6} alignItems='center'>
                        <Grid item xs={12} md={6}>
                            <Stack spacing={2} mb={3}>
                                <Chip
                                    label={activeTemplate?.hero?.badge || 'Demo Freia'}
                                    color='secondary'
                                    sx={{ alignSelf: 'flex-start' }}
                                />
                                <Typography variant='h2' fontWeight={900} sx={{ lineHeight: 1.1, color: 'white' }}>
                                    {activeTemplate?.hero?.title || 'Selecciona una template'}
                                </Typography>
                                <Typography variant='h6' color='rgba(255,255,255,0.85)' sx={{ maxWidth: 600 }}>
                                    {activeTemplate?.hero?.subtitle || 'Elige una plantilla autorizada para continuar.'}
                                </Typography>
                                <Stack direction='row' spacing={2} flexWrap='wrap'>
                                    {(activeTemplate?.kpis || []).map((kpi) => (
                                        <Chip
                                            key={kpi.label}
                                            label={`${kpi.label}: ${kpi.value}`}
                                            variant='outlined'
                                            sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)' }}
                                        />
                                    ))}
                                </Stack>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mt={2}>
                                    <Button
                                        size='large'
                                        variant='contained'
                                        onClick={openPrimaryCta}
                                        endIcon={<ArrowForwardIcon />}
                                        sx={{ borderRadius: '50px', px: 3 }}
                                        disabled={!activeTemplate}
                                    >
                                        {activeTemplate?.hero?.chatLabel || 'Abrir demo'}
                                    </Button>
                                    <Button
                                        size='large'
                                        variant='outlined'
                                        onClick={openSecondaryCta}
                                        sx={{ borderRadius: '50px', px: 3, color: 'white', borderColor: 'rgba(255,255,255,0.6)' }}
                                        disabled={!activeTemplate}
                                    >
                                        {activeTemplate?.hero?.secondaryLabel || 'Ver API'}
                                    </Button>
                                </Stack>
                                {activeTemplate?.slug && (
                                    <Typography variant='body2' color='rgba(255,255,255,0.7)'>
                                        Ruta de acceso directa: /demo/{activeTemplate.slug}
                                    </Typography>
                                )}
                            </Stack>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Card
                                sx={{
                                    borderRadius: '24px',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    background: 'rgba(255,255,255,0.06)',
                                    backdropFilter: 'blur(14px)',
                                    boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                                }}
                            >
                                <CardContent>
                                    {activeTemplate?.hero?.embedUrl ? (
                                        <Box
                                            component='iframe'
                                            src={activeTemplate.hero.embedUrl}
                                            title='Demo embed'
                                            sx={{ width: '100%', height: 400, border: 'none', borderRadius: 2 }}
                                        />
                                    ) : (
                                        <Box
                                            component='img'
                                            src={activeTemplate?.hero?.image || '/assets/Demo.png'}
                                            alt='Preview'
                                            sx={{ width: '100%', borderRadius: 2, objectFit: 'cover' }}
                                        />
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {!activeTemplate?.hero?.chatLink && (
                <Box sx={{ background: '#fff3cd', color: '#856404' }}>
                    <Container maxWidth='lg' sx={{ py: 2 }}>
                        <Alert severity='warning' sx={{ background: 'transparent', color: 'inherit' }}>
                            Falta configurar el link del chat (`VITE_DEMO_*_CHAT_URL`). El CTA abrirá el login por defecto.
                        </Alert>
                    </Container>
                </Box>
            )}

            <Box sx={{ py: 10 }}>
                <Container maxWidth='lg'>
                    <Stack spacing={2} mb={4} direction='row' alignItems='center' justifyContent='space-between'>
                        <Stack spacing={1}>
                            <Typography variant='h4' fontWeight={800}>
                                Templates disponibles
                            </Typography>
                            <Typography variant='body1' color='text.secondary'>
                                Elige la plantilla autorizada que quieras mostrar; se guarda tu preferencia, no los permisos.
                            </Typography>
                            {fetchError && (
                                <Alert severity='warning' sx={{ mt: 1 }}>
                                    {fetchError}
                                </Alert>
                            )}
                        </Stack>
                        {isSuperAdmin && (
                            <Button
                                variant='contained'
                                startIcon={<AddIcon />}
                                onClick={() => handleOpenModal(null, 'create')}
                                sx={{ borderRadius: '12px' }}
                            >
                                Nueva template
                            </Button>
                        )}
                    </Stack>
                    <Stack direction='row' spacing={2} mb={3} alignItems='center'>
                        <Typography variant='body2'>Filtrar por vertical:</Typography>
                        <Select
                            size='small'
                            value={verticalFilter}
                            onChange={(e) => setVerticalFilter(e.target.value)}
                            sx={{ minWidth: 160 }}
                        >
                            <MenuItem value='all'>Todas</MenuItem>
                            {availableVerticals.map((v) => (
                                <MenuItem value={v} key={v}>
                                    {v}
                                </MenuItem>
                            ))}
                        </Select>
                    </Stack>
                    {!filteredTemplates.length && !loadingTemplates ? (
                        <Alert severity='info'>No hay templates asignadas a tu usuario o workspace.</Alert>
                    ) : (
                        <Grid container spacing={3}>
                            {filteredTemplates.map((tpl) => (
                                <Grid item xs={12} md={6} key={tpl.slug}>
                                    <TemplateCard
                                        template={tpl}
                                        active={tpl.slug === activeTemplate?.slug}
                                        onSelect={handleTemplateSelect}
                                        onEdit={(template) => handleOpenModal(template, 'edit')}
                                        isSuperAdmin={isSuperAdmin}
                                    />
                                </Grid>
                            ))}
                        </Grid>
                    )}
                </Container>
            </Box>

            <Box sx={{ py: 10 }}>
                <Container maxWidth='lg'>
                    <Stack spacing={2} mb={4} alignItems='flex-start'>
                        <Typography variant='h4' fontWeight={800}>
                            Casos clave del agente
                        </Typography>
                        <Typography variant='body1' color='text.secondary'>
                            Preparado para demo con reservas, cambios, cancelaciones, atención y backoffice.
                        </Typography>
                    </Stack>
                    <Grid container spacing={3}>
                        {(activeTemplate?.features || []).map((f) => (
                            <Grid item xs={12} md={4} key={f.title}>
                                <FeatureCard {...f} />
                            </Grid>
                        ))}
                    </Grid>
                </Container>
            </Box>

            <Box sx={{ py: 10, background: customization?.isDarkMode ? 'rgba(15,23,42,0.6)' : 'rgba(248,250,252,0.7)' }}>
                <Container maxWidth='lg'>
                    <Stack spacing={2} mb={4} alignItems='flex-start'>
                        <Typography variant='h4' fontWeight={800}>
                            Flujos demostrables
                        </Typography>
                        <Typography variant='body1' color='text.secondary'>
                            Muestra amplitud y profundidad del agente con estos recorridos.
                        </Typography>
                    </Stack>
                    <Grid container spacing={3}>
                        {(activeTemplate?.flows || []).map((flow) => (
                            <Grid item xs={12} md={3} key={flow.title}>
                                <FlowCard {...flow} />
                            </Grid>
                        ))}
                    </Grid>
                </Container>
            </Box>

            <Box sx={{ py: 10 }}>
                <Container maxWidth='lg'>
                    <Grid container spacing={4}>
                        <Grid item xs={12} md={6}>
                            <Stack spacing={2}>
                                <Typography variant='h5' fontWeight={800}>
                                    Cómo funciona
                                </Typography>
                                {(activeTemplate?.howItWorks || []).map((step) => (
                                    <Stack key={step} direction='row' spacing={1} alignItems='flex-start'>
                                        <Typography variant='body1' fontWeight={700}>
                                            •
                                        </Typography>
                                        <Typography variant='body1' color='text.secondary'>
                                            {step}
                                        </Typography>
                                    </Stack>
                                ))}
                            </Stack>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Stack spacing={2}>
                                <Typography variant='h5' fontWeight={800}>
                                    Valor para la demo
                                </Typography>
                                {(activeTemplate?.value || []).map((val) => (
                                    <Stack key={val} direction='row' spacing={1} alignItems='flex-start'>
                                        <Typography variant='body1' fontWeight={700}>
                                            •
                                        </Typography>
                                        <Typography variant='body1' color='text.secondary'>
                                            {val}
                                        </Typography>
                                    </Stack>
                                ))}
                            </Stack>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            <Box sx={{ py: 10 }}>
                <Container maxWidth='lg'>
                    <Stack spacing={2} alignItems='center'>
                        <Typography variant='h4' fontWeight={800} align='center'>
                            Lista para usar en tu próximo demo
                        </Typography>
                        <Typography variant='body1' color='text.secondary' align='center' sx={{ maxWidth: 720 }}>
                            Usa la plantilla seleccionada, añade tu link de chat y API, y lanza una demo en minutos.
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <Button
                                variant='contained'
                                size='large'
                                endIcon={<ArrowForwardIcon />}
                                onClick={openPrimaryCta}
                                sx={{ borderRadius: '50px' }}
                                disabled={!activeTemplate}
                            >
                                Abrir demo
                            </Button>
                            <Button
                                variant='outlined'
                                size='large'
                                onClick={openSecondaryCta}
                                sx={{ borderRadius: '50px' }}
                                disabled={!activeTemplate}
                            >
                                Ver documentación API
                            </Button>
                        </Stack>
                        {activeTemplate?.slug && (
                            <Typography variant='body2' color='text.secondary'>
                                También puedes acceder directamente: /demo/{activeTemplate.slug}
                            </Typography>
                        )}
                    </Stack>
                </Container>
            </Box>

            <TemplateModal
                open={modalState.open}
                onClose={() => setModalState({ open: false, template: null, mode: 'create' })}
                onSubmit={handleSaveTemplate}
                initialData={modalState.template}
                saving={modalSaving}
                error={modalError}
            />
        </Box>
    )
}

export default DemoHoteles
