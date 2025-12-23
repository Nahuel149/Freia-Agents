import { useEffect, useMemo, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Container,
    Grid,
    Stack,
    TextField,
    Typography,
    MenuItem,
    Select,
    InputLabel,
    FormControl,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    IconButton,
    CircularProgress
} from '@mui/material'
import { useSelector } from 'react-redux'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

const countries = [
    { code: 'US', label: 'Estados Unidos (dLocal)', provider: 'dLocal' },
    { code: 'AR', label: 'Argentina (Mobbex)', provider: 'Mobbex' }
]

const currencyOptions = ['USD', 'ARS']

const PaymentOptionCard = ({ title, description, priceLabel, actionLabel, onSubmit, children }) => {
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const handleSubmit = async () => {
        setSubmitting(true)
        setError('')
        try {
            await onSubmit()
        } catch (e) {
            setError(e?.message || 'Error al iniciar pago')
        } finally {
            setSubmitting(false)
        }
    }
    return (
        <Card sx={{ minHeight: 280, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <CardContent>
                <Stack spacing={1.5}>
                    <Typography variant='h5'>{title}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                        {description}
                    </Typography>
                    <Typography variant='h6'>{priceLabel}</Typography>
                    {children}
                    {error && <Alert severity='error'>{error}</Alert>}
                </Stack>
            </CardContent>
            <Box sx={{ px: 3, pb: 3 }}>
                <Button
                    variant='contained'
                    onClick={handleSubmit}
                    disabled={submitting}
                    fullWidth
                    sx={{ borderRadius: 2, height: 48, textTransform: 'none' }}
                >
                    {submitting ? 'Procesando...' : actionLabel}
                </Button>
            </Box>
        </Card>
    )
}

const Payments = () => {
    const user = useSelector((state) => state.auth?.user)
    const email = user?.email || ''
    const isAdmin = (user?.role || '').toLowerCase() === 'super-admin'

    const [countryCode, setCountryCode] = useState('US')
    const [agentQty, setAgentQty] = useState(1)
    const [customAmount, setCustomAmount] = useState(500)
    const [customCurrency, setCustomCurrency] = useState('USD')
    const [customEmail, setCustomEmail] = useState(email)
    const [customDesc, setCustomDesc] = useState('Pago personalizado')
    const [customQuoteId, setCustomQuoteId] = useState('')
    const [assignedQuoteId, setAssignedQuoteId] = useState('')
    const [quotes, setQuotes] = useState([])
    const [quotesLoading, setQuotesLoading] = useState(false)
    const [quotesError, setQuotesError] = useState('')
    const providerLabel = useMemo(() => countries.find((c) => c.code === countryCode)?.provider || 'dLocal', [countryCode])

    const callCheckout = async ({ orderId, amountCents, currency }) => {
        const effectiveEmail = customEmail || email
        if (!effectiveEmail) throw new Error('No se encontró email del usuario')
        const res = await fetch('/api/v1/payments/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amountCents,
                currency,
                countryCode,
                orderId,
                customerEmail: effectiveEmail
            })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Error en checkout')
        if (data.redirectUrl) {
            window.location.href = data.redirectUrl
        } else if (data.checkoutId) {
            window.location.href = `https://mobbex.com/p/${data.checkoutId}`
        } else {
            throw new Error('No se recibió redirectUrl ni checkoutId')
        }
    }

    useEffect(() => {
        if (!isAdmin) return
        const fetchQuotes = async () => {
            setQuotesLoading(true)
            setQuotesError('')
            try {
                const res = await fetch('/api/v1/payments/quotes')
                const data = await res.json()
                if (!res.ok) throw new Error(data?.message || data?.error || 'No se pudieron obtener los quotes')
                setQuotes(Array.isArray(data.quotes) ? data.quotes : [])
            } catch (err) {
                setQuotesError(err?.message || 'Error cargando quotes')
            } finally {
                setQuotesLoading(false)
            }
        }
        fetchQuotes()
    }, [isAdmin])

    return (
        <Container maxWidth='lg' sx={{ py: 2, pb: 1, overflow: 'hidden' }}>
            <Stack spacing={2} mb={2}>
                <Typography variant='h4'>Payments</Typography>
                <Typography variant='body1' color='text.secondary'>
                    Elige una opción y se generará un checkout seguro ({providerLabel}).
                </Typography>
            </Stack>
            <Card
                sx={{
                    mb: 3,
                    borderRadius: 3,
                    px: 3,
                    py: 2,
                    background: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#f5f5f5')
                }}
            >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems='center'>
                    <FormControl sx={{ minWidth: 240 }} size='small'>
                        <InputLabel id='country-select-label'>País</InputLabel>
                        <Select
                            labelId='country-select-label'
                            value={countryCode}
                            label='País'
                            onChange={(e) => setCountryCode(e.target.value)}
                        >
                            {countries.map((c) => (
                                <MenuItem key={c.code} value={c.code}>
                                    {c.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Typography variant='body2' color='text.secondary'>
                        Pagos procesados en {providerLabel}
                    </Typography>
                </Stack>
            </Card>
            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <PaymentOptionCard
                        title='Suscripción mensual'
                        description='Mantenimiento 1 mes'
                        priceLabel='$500 USD'
                        actionLabel='Pagar suscripción'
                        onSubmit={() =>
                            callCheckout({ orderId: `subscription-monthly-${Date.now()}`, amountCents: 50000, currency: 'USD' })
                        }
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <PaymentOptionCard
                        title='Agregar agentes'
                        description='Compra agentes adicionales'
                        priceLabel={`$200 USD c/u (${agentQty} uds = $${(agentQty * 200).toLocaleString()} USD)`}
                        actionLabel='Comprar agentes'
                        onSubmit={() => {
                            if (agentQty < 1) throw new Error('Cantidad inválida')
                            return callCheckout({
                                orderId: `add-agent-${agentQty}-${Date.now()}`,
                                amountCents: agentQty * 20000,
                                currency: 'USD'
                            })
                        }}
                    >
                        <TextField
                            label='Cantidad de agentes'
                            type='number'
                            size='small'
                            value={agentQty}
                            onChange={(e) => setAgentQty(Math.max(1, Number(e.target.value) || 1))}
                            inputProps={{ min: 1 }}
                        />
                    </PaymentOptionCard>
                </Grid>
                {isAdmin && (
                    <Grid item xs={12}>
                        <PaymentOptionCard
                            title='Pago personalizado'
                            description='Define monto y moneda; genera un quote y paga.'
                            priceLabel={`Monto actual: ${customAmount} ${customCurrency}`}
                            actionLabel='Generar y pagar'
                            onSubmit={async () => {
                                const payload = {
                                    amountCents: Math.round(customAmount * 100),
                                    currency: customCurrency,
                                    userEmail: customEmail || email,
                                    description: customDesc
                                }
                                const res = await fetch('/api/v1/payments/quotes', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(payload)
                                })
                                const data = await res.json()
                                if (!res.ok) throw new Error(data?.message || data?.error || 'No se pudo crear el pago')
                                const quoteId = data?.quoteId
                                if (!quoteId) throw new Error('Quote no generado')
                                setCustomQuoteId(quoteId)
                                return callCheckout({
                                    orderId: `quote:${quoteId}`,
                                    amountCents: payload.amountCents,
                                    currency: payload.currency
                                })
                            }}
                        >
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                <TextField
                                    label='Monto'
                                    type='number'
                                    size='small'
                                    value={customAmount}
                                    onChange={(e) => setCustomAmount(Math.max(1, Number(e.target.value) || 1))}
                                    inputProps={{ min: 1, step: 10 }}
                                />
                                <FormControl size='small'>
                                    <InputLabel id='currency-select-label'>Moneda</InputLabel>
                                    <Select
                                        labelId='currency-select-label'
                                        value={customCurrency}
                                        label='Moneda'
                                        onChange={(e) => setCustomCurrency(e.target.value)}
                                    >
                                        {currencyOptions.map((c) => (
                                            <MenuItem key={c} value={c}>
                                                {c}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <TextField
                                    label='Email asignado'
                                    size='small'
                                    value={customEmail}
                                    onChange={(e) => setCustomEmail(e.target.value)}
                                />
                            </Stack>
                            <TextField
                                label='Descripción'
                                fullWidth
                                size='small'
                                sx={{ mt: 1 }}
                                value={customDesc}
                                onChange={(e) => setCustomDesc(e.target.value)}
                            />
                            {customQuoteId && <Alert severity='info'>Quote generado: {customQuoteId}</Alert>}
                        </PaymentOptionCard>
                    </Grid>
                )}
                <Grid item xs={12}>
                    <PaymentOptionCard
                        title='Pagar un código asignado'
                        description='Si recibiste un código de pago (quote), insértalo aquí.'
                        priceLabel='Usará el monto/moneda del código.'
                        actionLabel='Pagar código'
                        onSubmit={async () => {
                            if (!assignedQuoteId) throw new Error('Ingresa un código de pago')
                            const res = await fetch(`/api/v1/payments/quotes/${assignedQuoteId}`)
                            const data = await res.json()
                            if (!res.ok) throw new Error(data?.message || data?.error || 'Quote inválido')
                            const q = data?.quote
                            if (!q) throw new Error('Quote no encontrado')
                            return callCheckout({
                                orderId: `quote:${assignedQuoteId}`,
                                amountCents: q.amount_cents,
                                currency: q.currency
                            })
                        }}
                    >
                        <TextField
                            label='Código de pago (quote)'
                            fullWidth
                            size='small'
                            value={assignedQuoteId}
                            onChange={(e) => setAssignedQuoteId(e.target.value)}
                        />
                    </PaymentOptionCard>
                </Grid>
            </Grid>
            {isAdmin && (
                <Box sx={{ mt: 4 }}>
                    <Typography variant='h5' gutterBottom>
                        Códigos generados
                    </Typography>
                    {quotesLoading && (
                        <Stack direction='row' spacing={1} alignItems='center' sx={{ mb: 2 }}>
                            <CircularProgress size={20} />
                            <Typography variant='body2'>Cargando...</Typography>
                        </Stack>
                    )}
                    {quotesError && <Alert severity='error'>{quotesError}</Alert>}
                    {!quotesLoading && quotes.length === 0 && <Alert severity='info'>No hay quotes creados.</Alert>}
                    {!quotesLoading && quotes.length > 0 && (
                        <Table size='small'>
                            <TableHead>
                                <TableRow>
                                    <TableCell>ID</TableCell>
                                    <TableCell>Monto</TableCell>
                                    <TableCell>Moneda</TableCell>
                                    <TableCell>Email asignado</TableCell>
                                    <TableCell>Descripción</TableCell>
                                    <TableCell>Acciones</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {quotes.map((q) => (
                                    <TableRow key={q.id}>
                                        <TableCell>{q.id}</TableCell>
                                        <TableCell>{(q.amountCents || q.amount_cents) / 100}</TableCell>
                                        <TableCell>{q.currency}</TableCell>
                                        <TableCell>{q.userEmail || q.user_email || '—'}</TableCell>
                                        <TableCell>{q.description || '—'}</TableCell>
                                        <TableCell>
                                            <IconButton size='small' onClick={() => setAssignedQuoteId(q.id)} title='Usar este código'>
                                                <ContentCopyIcon fontSize='small' />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </Box>
            )}
        </Container>
    )
}

export default Payments
