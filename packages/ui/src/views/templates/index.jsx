import { useEffect, useState } from 'react'
import { Box, Button, Card, CardContent, CardMedia, Container, Grid, Stack, Typography, alpha } from '@mui/material'
import { useNavigate } from 'react-router-dom'

const LandingTemplates = () => {
    const navigate = useNavigate()
    const [templates, setTemplates] = useState([])
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                setLoading(true)
                setError('')
                const res = await fetch('/api/v1/templates', {
                    credentials: 'include'
                })
                if (!res.ok) throw new Error('No se pudieron cargar las templates')
                const data = await res.json()
                const list = Array.isArray(data?.templates) ? data.templates : []
                setTemplates(list)
            } catch (err) {
                setError(err.message || 'Error al obtener templates')
            } finally {
                setLoading(false)
            }
        }
        fetchTemplates()
    }, [])

    const fallbackImage = '/assets/Demo.png'

    return (
        <Box sx={{ py: { xs: 4, md: 6 } }}>
            <Container maxWidth='lg'>
                <Stack spacing={1.5} sx={{ mb: 3 }}>
                    <Typography variant='h4' fontWeight={800}>
                        Templates de Landing
                    </Typography>
                    <Typography variant='body1' color='text.secondary'>
                        Accede a las landing autorizadas (hotel, gomerías, retail) y abre la demo asociada por slug.
                    </Typography>
                </Stack>

                {error && (
                    <Typography color='error' sx={{ mb: 2 }}>
                        {error}
                    </Typography>
                )}

                {loading ? (
                    <Typography>Cargando templates...</Typography>
                ) : templates.length === 0 ? (
                    <Typography>No hay templates asignadas a tu usuario o workspace.</Typography>
                ) : (
                    <Grid container spacing={3}>
                        {templates.map((tpl) => (
                            <Grid item xs={12} sm={6} md={4} key={tpl.slug}>
                                <Card
                                    sx={{
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        borderRadius: 3,
                                        border: (theme) => `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
                                        boxShadow: (theme) => `0 12px 40px ${alpha(theme.palette.primary.main, 0.12)}`
                                    }}
                                >
                                    <CardMedia
                                        component='img'
                                        height='180'
                                        image={tpl.image || fallbackImage}
                                        alt={tpl.name || tpl.slug}
                                        loading='lazy'
                                        sx={{ objectFit: 'cover' }}
                                    />
                                    <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <Typography variant='h6' fontWeight={800}>
                                            {tpl.name || tpl.slug}
                                        </Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {tpl.vertical || 'Template disponible'}
                                        </Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            Slug: {tpl.slug}
                                        </Typography>
                                        <Box sx={{ flexGrow: 1 }} />
                                        <Button variant='contained' onClick={() => navigate(`/demo/${tpl.slug}`)}>
                                            Abrir demo
                                        </Button>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                )}
            </Container>
        </Box>
    )
}

export default LandingTemplates
