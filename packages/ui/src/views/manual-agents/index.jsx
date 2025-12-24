import { useEffect, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormControlLabel,
    Grid,
    IconButton,
    InputLabel,
    List,
    ListItemButton,
    ListItemText,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography
} from '@mui/material'
import { IconCopy, IconPaperclip, IconRefresh, IconSend, IconShare, IconTrash } from '@tabler/icons-react'

import MainCard from '@/ui-component/cards/MainCard'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import { BackdropLoader } from '@/ui-component/loading/BackdropLoader'
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'
import TablePagination, { DEFAULT_ITEMS_PER_PAGE } from '@/ui-component/pagination/TablePagination'
import useConfirm from '@/hooks/useConfirm'
import useNotifier from '@/utils/useNotifier'
import useApi from '@/hooks/useApi'
import manualAgentsApi from '@/api/manualAgents'
import { enqueueSnackbar as enqueueSnackbarAction } from '@/store/actions'
import { useAuth } from '@/hooks/useAuth'
import { baseURL, uiBaseURL } from '@/store/constant'

const defaultShareConfig = {
    title: 'Freia Assistant',
    titleAvatarSrc: 'https://freia-agents.onrender.com/assets/Freia.png',
    titleBackgroundColor: '#3B81F6',
    titleTextColor: '#ffffff',
    welcomeMessage: 'Hola! Contame fechas y cantidad de personas para chequear disponibilidad.',
    errorMessage: 'Hubo un problema, intentemos de nuevo en un minuto.',
    backgroundColor: '#f7f3ec',
    fontSize: 16,
    poweredByTextColor: '#6f7b74',
    renderHTML: false,
    showAgentMessages: true,
    botMessage: {
        backgroundColor: '#e7efe8',
        textColor: '#1b1d1f',
        avatarSrc: 'https://raw.githubusercontent.com/zahidkhawaja/langchain-chat-nextjs/main/public/parroticon.png',
        showAvatar: true
    },
    userMessage: {
        backgroundColor: '#1f4e3d',
        textColor: '#f5f1e8',
        avatarSrc: 'https://raw.githubusercontent.com/zahidkhawaja/langchain-chat-nextjs/main/public/usericon.png',
        showAvatar: true
    },
    textInput: {
        backgroundColor: '#fffaf2',
        textColor: '#1b1d1f',
        placeholder: 'Escribi tu consulta...',
        sendButtonColor: '#1f4e3d'
    }
}

const HoldStatusCard = ({ hold, onConfirm, disabled }) => {
    if (!hold) return null

    return (
        <Card variant='outlined' sx={{ mt: 1, backgroundColor: 'action.hover' }}>
            <CardContent>
                <Stack spacing={1}>
                    <Typography variant='subtitle2'>Reserva con deposito/anticipo creada</Typography>
                    <Typography variant='body2'>Property: {hold.propertyId}</Typography>
                    <Typography variant='body2'>
                        Dates: {hold.start} to {hold.end}
                    </Typography>
                    {hold.holdExpires && (
                        <Typography variant='caption' color='text.secondary'>
                            Expires: {new Date(hold.holdExpires).toLocaleString()}
                        </Typography>
                    )}
                    <Button variant='contained' size='small' onClick={() => onConfirm(hold)} disabled={disabled}>
                        Confirmar deposito/anticipo
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    )
}

const ReservationStatusCard = ({ reservation, onConfirm, disabled }) => {
    if (!reservation) return null

    return (
        <Card variant='outlined' sx={{ mt: 1, backgroundColor: 'action.hover' }}>
            <CardContent>
                <Stack spacing={1}>
                    <Typography variant='subtitle2'>Reserva de hotel generada</Typography>
                    <Typography variant='body2'>Reserva: {reservation.id}</Typography>
                    <Typography variant='body2'>
                        Hotel: {reservation.hotelName} ({reservation.sede})
                    </Typography>
                    <Typography variant='body2'>
                        Fechas: {reservation.checkIn} a {reservation.checkOut}
                    </Typography>
                    <Typography variant='body2'>
                        Total: {reservation.precioTotal} {reservation.moneda || 'USD'}
                    </Typography>
                    <Button variant='contained' size='small' onClick={onConfirm} disabled={disabled}>
                        Confirmar pago
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    )
}

const ManualAgents = () => {
    const dispatch = useDispatch()
    const { confirm } = useConfirm()
    const { hasPermission } = useAuth()
    useNotifier()

    const canUpdate = hasPermission('chatflows:update')
    const canDelete = hasPermission('chatflows:delete')

    const enqueueSnackbar = (message, variant) => {
        dispatch(
            enqueueSnackbarAction({
                message,
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant
                }
            })
        )
    }

    const [search, setSearch] = useState('')
    const [agents, setAgents] = useState([])
    const [currentPage, setCurrentPage] = useState(1)
    const [pageLimit, setPageLimit] = useState(DEFAULT_ITEMS_PER_PAGE)
    const [totalAgents, setTotalAgents] = useState(0)
    const [selectedAgentId, setSelectedAgentId] = useState('')
    const [selectedAgent, setSelectedAgent] = useState(null)
    const [messages, setMessages] = useState([])
    const [isReplying, setIsReplying] = useState(false)
    const [sessionId, setSessionId] = useState('')
    const [sessions, setSessions] = useState([])
    const [selectedSessionId, setSelectedSessionId] = useState('')
    const [input, setInput] = useState('')
    const [shareDialogOpen, setShareDialogOpen] = useState(false)
    const [shareTokens, setShareTokens] = useState([])
    const [shareUrl, setShareUrl] = useState('')
    const [shareToken, setShareToken] = useState('')
    const [shareConfig, setShareConfig] = useState(defaultShareConfig)
    const [kpi, setKpi] = useState(null)
    const [outbound, setOutbound] = useState(null)
    const [outboundTemplateId, setOutboundTemplateId] = useState('')
    const [zoneFilter, setZoneFilter] = useState('')
    const [kpiDate, setKpiDate] = useState('')
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [pendingHold, setPendingHold] = useState(null)
    const [paymentRef, setPaymentRef] = useState('')
    const [amount, setAmount] = useState('')
    const [currency, setCurrency] = useState('USD')
    const [followUpMessage, setFollowUpMessage] = useState('')
    const [depositBaseUsd, setDepositBaseUsd] = useState(null)
    const [uploadingProof, setUploadingProof] = useState(false)

    const USD_TO_ARS = 1500

    const getAllManualAgentsApi = useApi(manualAgentsApi.getAllManualAgents)
    const getManualAgentApi = useApi(manualAgentsApi.getManualAgent)
    const getManualAgentSessionsApi = useApi(manualAgentsApi.getManualAgentSessions)
    const getManualAgentSessionApi = useApi(manualAgentsApi.getManualAgentSession)
    const chatManualAgentApi = useApi(manualAgentsApi.chatManualAgent)
    const createShareTokenApi = useApi(manualAgentsApi.createShareToken)
    const getShareTokensApi = useApi(manualAgentsApi.getShareTokens)
    const revokeShareTokenApi = useApi(manualAgentsApi.revokeShareToken)
    const confirmPaymentApi = useApi(manualAgentsApi.confirmPayment)
    const getKpiApi = useApi(manualAgentsApi.getKpi)
    const getOutboundApi = useApi(manualAgentsApi.getOutbound)
    const sendOutboundApi = useApi(manualAgentsApi.sendOutbound)
    const archiveManualAgentApi = useApi(manualAgentsApi.archiveManualAgent)

    const filteredAgents = useMemo(() => {
        const term = search.toLowerCase()
        return agents.filter((agent) => {
            if (!term) return true
            return (
                agent.name?.toLowerCase().includes(term) ||
                agent.description?.toLowerCase().includes(term) ||
                agent.id?.toLowerCase().includes(term)
            )
        })
    }, [agents, search])

    const loadAgents = async (page = currentPage, limit = pageLimit) => {
        try {
            const response = await getAllManualAgentsApi.request({ page, limit })
            const payload = response?.data || {}
            const list = Array.isArray(payload) ? payload : payload.data || []
            setAgents(list)
            setTotalAgents(payload.total || list.length)
            if (!selectedAgentId && list.length) {
                setSelectedAgentId(list[0].id)
            }
        } catch (error) {
            enqueueSnackbar('Failed to load manual agents', 'error')
        }
    }

    const loadAgentDetails = async (agentId) => {
        try {
            const response = await getManualAgentApi.request(agentId)
            setSelectedAgent(response.data || null)
        } catch (error) {
            enqueueSnackbar('Failed to load manual agent details', 'error')
        }
    }

    const loadShareTokens = async (agentId) => {
        try {
            const response = await getShareTokensApi.request(agentId)
            setShareTokens(response.data || [])
        } catch (error) {
            enqueueSnackbar('Failed to load share tokens', 'error')
        }
    }

    const loadSessions = async (agentId) => {
        try {
            const response = await getManualAgentSessionsApi.request(agentId, { limit: 25 })
            setSessions(response?.data?.data || [])
        } catch (error) {
            enqueueSnackbar('Failed to load chat sessions', 'error')
        }
    }

    const loadSessionMessages = async (agentId, newSessionId) => {
        try {
            const response = await getManualAgentSessionApi.request(agentId, newSessionId)
            setMessages(response?.data?.messages || [])
            setSessionId(newSessionId)
        } catch (error) {
            enqueueSnackbar('Failed to load chat history', 'error')
        }
    }

    const loadKpi = async (agentId) => {
        try {
            const response = await getKpiApi.request(agentId, { zone: zoneFilter, date: kpiDate || undefined })
            setKpi(response.data || null)
        } catch (error) {
            enqueueSnackbar('Failed to load KPI metrics', 'error')
        }
    }

    const loadOutbound = async (agentId) => {
        try {
            const response = await getOutboundApi.request(agentId)
            setOutbound(response.data || null)
            const templateId = response.data?.templates?.[0]?.id || ''
            setOutboundTemplateId((prev) => prev || templateId)
        } catch (error) {
            enqueueSnackbar('Failed to load outbound suggestions', 'error')
        }
    }

    const getLatestPaymentRequest = (messageList) => {
        if (!messageList?.length) return null
        for (let i = messageList.length - 1; i >= 0; i -= 1) {
            const metadata = messageList[i]?.metadata
            if (metadata?.type === 'holdCard' && metadata.hold) {
                return { kind: 'quintas', ...metadata.hold }
            }
            if (metadata?.type === 'reservationCard' && metadata.reservation) {
                const reservation = metadata.reservation
                return {
                    kind: 'hotel',
                    reservationId: reservation.id,
                    hotelName: reservation.hotelName,
                    start: reservation.checkIn,
                    end: reservation.checkOut,
                    amount: reservation.precioTotal,
                    currency: reservation.moneda || 'USD'
                }
            }
        }
        return null
    }

    useEffect(() => {
        loadAgents()
    }, [currentPage, pageLimit])

    useEffect(() => {
        if (!selectedAgentId) return
        loadAgentDetails(selectedAgentId)
        loadShareTokens(selectedAgentId)
        loadOutbound(selectedAgentId)
        loadSessions(selectedAgentId)
        setMessages([])
        setSessionId('')
        setSelectedSessionId('')
    }, [selectedAgentId])

    useEffect(() => {
        if (!selectedAgentId) return
        loadKpi(selectedAgentId)
    }, [selectedAgentId, zoneFilter, kpiDate])

    const handleSend = async (messageOverride) => {
        const raw = typeof messageOverride === 'string' ? messageOverride : input
        const content = typeof raw === 'string' ? raw.trim() : ''
        if (!content || !selectedAgentId) return
        const userMessage = { role: 'user', content, timestamp: new Date() }
        setMessages((prev) => [...prev, userMessage])
        setInput('')
        setIsReplying(true)

        try {
            const response = await chatManualAgentApi.request(selectedAgentId, { message: userMessage.content, sessionId })
            const answer = response?.data?.answer || 'No pude procesar tu consulta.'
            const assistantMessage = {
                role: 'assistant',
                content: answer,
                timestamp: new Date(),
                metadata: response?.data?.metadata
            }
            setMessages((prev) => [...prev, assistantMessage])
            if (!sessionId && response?.data?.sessionId) {
                setSessionId(response.data.sessionId)
                setSelectedSessionId(response.data.sessionId)
            }
            loadSessions(selectedAgentId)
        } catch (error) {
            enqueueSnackbar('Failed to send message', 'error')
        } finally {
            setIsReplying(false)
        }
    }

    const formatMessage = (content) => {
        if (!content) return []
        const normalized = content.replace(/\r\n/g, '\n').trim()
        const spaced = normalized
            .replace(/\.\s+-\s+/g, '.\n\n- ')
            .replace(/:\s+-\s+/g, ':\n\n- ')
            .replace(/([^\n])\s-\s(?=[A-ZÁÉÍÓÚÑ])/g, '$1\n\n- ')
            .replace(/\.\s+/g, '.\n\n')
        return spaced
            .split(/\n{2,}/)
            .map((block) => block.trim())
            .filter(Boolean)
    }

    const handlePaginationChange = (page, limit) => {
        setCurrentPage(page)
        setPageLimit(limit)
    }

    const handleCreateShare = async (agentId = selectedAgentId) => {
        if (!agentId) return
        try {
            const response = await createShareTokenApi.request(agentId, { chatbotConfig: shareConfig })
            const tokenValue = response?.data?.token || ''
            const uiShareUrl = tokenValue ? `${uiBaseURL}/manual-agent/${tokenValue}` : ''
            setShareUrl(uiShareUrl || response?.data?.url || '')
            setShareToken(tokenValue)
            setShareDialogOpen(true)
            loadShareTokens(agentId)
        } catch (error) {
            enqueueSnackbar('Failed to create share link', 'error')
        }
    }

    const handleRevokeToken = async (tokenId) => {
        if (!selectedAgentId) return
        const confirmed = await confirm({
            title: 'Revoke share link?',
            description: 'This link will stop working immediately.',
            confirmButtonName: 'Revoke',
            cancelButtonName: 'Cancel'
        })
        if (!confirmed) return

        try {
            await revokeShareTokenApi.request(selectedAgentId, tokenId)
            enqueueSnackbar('Share link revoked', 'success')
            loadShareTokens(selectedAgentId)
        } catch (error) {
            enqueueSnackbar('Failed to revoke link', 'error')
        }
    }

    const handleArchiveAgent = async (agentId = selectedAgentId) => {
        if (!agentId) return
        const confirmed = await confirm({
            title: 'Archive manual agent?',
            description: 'This agent will no longer appear in the list.',
            confirmButtonName: 'Archive',
            cancelButtonName: 'Cancel'
        })
        if (!confirmed) return

        try {
            await archiveManualAgentApi.request(agentId)
            enqueueSnackbar('Manual agent archived', 'success')
            if (agentId === selectedAgentId) {
                setSelectedAgentId('')
                setSelectedAgent(null)
            }
            loadAgents()
        } catch (error) {
            enqueueSnackbar('Failed to archive agent', 'error')
        }
    }

    const openPaymentDialog = (hold) => {
        const normalized = hold?.kind ? hold : { ...hold, kind: 'quintas' }
        setPendingHold(normalized)
        setPaymentRef('')
        const holdCurrency = normalized?.currency || 'USD'
        const depositAmount = normalized?.depositAmount ?? normalized?.amount
        let baseUsd = null
        if (typeof depositAmount === 'number') {
            baseUsd = holdCurrency === 'ARS' ? depositAmount / USD_TO_ARS : depositAmount
        }
        setDepositBaseUsd(baseUsd)
        setCurrency(holdCurrency)
        if (typeof depositAmount === 'number') {
            const initialAmount = holdCurrency === 'ARS' ? depositAmount : depositAmount
            setAmount(String(initialAmount))
        } else {
            setAmount('')
        }
        setFollowUpMessage('')
        setConfirmOpen(true)
    }

    const handleConfirmPayment = async () => {
        if (!pendingHold || !selectedAgentId) return
        if (!paymentRef.trim()) {
            enqueueSnackbar('Payment reference is required', 'warning')
            return
        }

        const numericAmount = amount ? Number(amount) : undefined
        if (amount && Number.isNaN(numericAmount)) {
            enqueueSnackbar('Amount must be a number', 'warning')
            return
        }

        try {
            if (pendingHold.kind === 'hotel') {
                await confirmPaymentApi.request(selectedAgentId, {
                    reservationId: pendingHold.reservationId || pendingHold.propertyId,
                    paymentRef: paymentRef.trim(),
                    amount: numericAmount,
                    currency: currency || 'USD',
                    sessionId,
                    followUpMessage: followUpMessage.trim() || undefined
                })
            } else {
                await confirmPaymentApi.request(selectedAgentId, {
                    propertyId: pendingHold.propertyId,
                    start: pendingHold.start,
                    end: pendingHold.end,
                    leadId: pendingHold.leadId,
                    paymentRef: paymentRef.trim(),
                    amount: numericAmount,
                    currency: currency || 'USD',
                    sessionId,
                    followUpMessage: followUpMessage.trim() || undefined
                })
            }
            enqueueSnackbar('Payment confirmed', 'success')
            setConfirmOpen(false)
        } catch (error) {
            enqueueSnackbar('Failed to confirm payment', 'error')
        }
    }

    const handleProofUpload = async (event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file || !selectedAgentId) return
        if (!sessionId) {
            enqueueSnackbar('Start a session before uploading a proof', 'warning')
            return
        }
        const latestPayment = getLatestPaymentRequest(messages)
        if (!latestPayment) {
            enqueueSnackbar('No payment request found to confirm', 'warning')
            return
        }
        if (!canUpdate) {
            enqueueSnackbar('You do not have permission to confirm payments', 'error')
            return
        }
        setUploadingProof(true)
        const userMessage = {
            role: 'user',
            content: `Comprobante enviado: ${file.name}`,
            timestamp: new Date()
        }
        setMessages((prev) => [...prev, userMessage])
        try {
            if (latestPayment.kind === 'hotel') {
                await confirmPaymentApi.request(selectedAgentId, {
                    reservationId: latestPayment.reservationId,
                    paymentRef: `archivo:${file.name}`,
                    amount: latestPayment.amount,
                    currency: latestPayment.currency || 'USD',
                    sessionId,
                    followUpMessage:
                        'Perfecto, recibimos tu comprobante. Ya dejamos confirmada la reserva. Si necesitas algo mas, avisame.',
                    followUpType: 'paymentConfirmed'
                })
            } else {
                await confirmPaymentApi.request(selectedAgentId, {
                    propertyId: latestPayment.propertyId,
                    start: latestPayment.start,
                    end: latestPayment.end,
                    leadId: latestPayment.leadId,
                    paymentRef: `archivo:${file.name}`,
                    amount: latestPayment.depositAmount,
                    currency: latestPayment.currency || 'USD',
                    sessionId,
                    followUpMessage:
                        'Perfecto, recibimos tu comprobante. Ya dejamos confirmada la reserva. Si necesitas algo mas, avisame.',
                    followUpType: 'paymentConfirmed'
                })
            }
            const assistantMessage = {
                role: 'assistant',
                content: 'Perfecto, recibimos tu comprobante. Ya dejamos confirmada la reserva. Si necesitas algo mas, avisame.',
                timestamp: new Date(),
                metadata: { type: 'paymentConfirmed' }
            }
            setMessages((prev) => [...prev, assistantMessage])
        } catch (error) {
            enqueueSnackbar('Failed to confirm payment from upload', 'error')
        } finally {
            setUploadingProof(false)
        }
    }

    const handleSendOutbound = async (leadId) => {
        if (!selectedAgentId || !outboundTemplateId) return
        try {
            await sendOutboundApi.request(selectedAgentId, { leadId, templateId: outboundTemplateId })
            enqueueSnackbar('Outbound message sent', 'success')
            loadOutbound(selectedAgentId)
        } catch (error) {
            enqueueSnackbar('Failed to send outbound message', 'error')
        }
    }

    const isLoading = getAllManualAgentsApi.loading || getManualAgentApi.loading
    const publicApiUrl = shareToken ? `${baseURL}/api/v1/manual-agents/public/${shareToken}/chat` : ''
    const quickPrompts =
        selectedAgentId === 'gran-sol'
            ? ['Reservar nueva estadia', 'Modificar reserva', 'Cancelar', 'Servicios del hotel', 'Atencion al huesped']
            : []

    return (
        <>
            <MainCard>
                <Stack flexDirection='column' sx={{ gap: 3 }}>
                    <ViewHeader
                        title='Manual Agents'
                        description='Run and share code-built agents'
                        search={true}
                        searchPlaceholder='Search manual agents'
                        onSearchChange={(event) => setSearch(event.target.value)}
                    >
                        <Button variant='outlined' startIcon={<IconRefresh />} onClick={loadAgents}>
                            Refresh
                        </Button>
                    </ViewHeader>

                    <Grid container spacing={3}>
                        <Grid item xs={12} md={3}>
                            <Card>
                                <CardContent>
                                    <Stack spacing={2}>
                                        <Stack direction='row' justifyContent='space-between' alignItems='center'>
                                            <Typography variant='h4'>Agents</Typography>
                                            <Chip label={totalAgents || agents.length} size='small' />
                                        </Stack>
                                        <Divider />
                                        <List dense>
                                            {filteredAgents.map((agent) => {
                                                const updatedLabel = agent.updatedAt ? new Date(agent.updatedAt).toLocaleString() : 'N/A'
                                                return (
                                                    <ListItemButton
                                                        key={agent.id}
                                                        selected={agent.id === selectedAgentId}
                                                        onClick={() => setSelectedAgentId(agent.id)}
                                                        sx={{ alignItems: 'flex-start' }}
                                                    >
                                                        <ListItemText
                                                            primary={agent.name}
                                                            secondary={
                                                                <Stack spacing={0.5}>
                                                                    <Typography variant='caption' color='text.secondary'>
                                                                        {agent.description || agent.id}
                                                                    </Typography>
                                                                    <Typography variant='caption' color='text.secondary'>
                                                                        Updated: {updatedLabel}
                                                                    </Typography>
                                                                </Stack>
                                                            }
                                                            secondaryTypographyProps={{ component: 'div' }}
                                                        />
                                                        <Stack direction='row' spacing={1} alignItems='center'>
                                                            <Chip
                                                                size='small'
                                                                label={agent.status || 'active'}
                                                                color={agent.status === 'archived' ? 'default' : 'success'}
                                                            />
                                                            <Tooltip title='Share'>
                                                                <span>
                                                                    <IconButton
                                                                        size='small'
                                                                        onClick={(event) => {
                                                                            event.stopPropagation()
                                                                            handleCreateShare(agent.id)
                                                                            setSelectedAgentId(agent.id)
                                                                        }}
                                                                        disabled={!canUpdate}
                                                                    >
                                                                        <IconShare size={16} />
                                                                    </IconButton>
                                                                </span>
                                                            </Tooltip>
                                                            <Tooltip title='Archive'>
                                                                <span>
                                                                    <IconButton
                                                                        size='small'
                                                                        onClick={(event) => {
                                                                            event.stopPropagation()
                                                                            handleArchiveAgent(agent.id)
                                                                        }}
                                                                        disabled={!canDelete}
                                                                    >
                                                                        <IconTrash size={16} />
                                                                    </IconButton>
                                                                </span>
                                                            </Tooltip>
                                                        </Stack>
                                                    </ListItemButton>
                                                )
                                            })}
                                            {!filteredAgents.length && (
                                                <Typography variant='body2' color='text.secondary'>
                                                    No manual agents found.
                                                </Typography>
                                            )}
                                        </List>
                                        <TablePagination
                                            currentPage={currentPage}
                                            limit={pageLimit}
                                            total={totalAgents}
                                            onChange={handlePaginationChange}
                                        />
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} md={9}>
                            {!selectedAgent ? (
                                <Card>
                                    <CardContent>
                                        <Typography variant='body2' color='text.secondary'>
                                            Select a manual agent to view details.
                                        </Typography>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Grid container spacing={3}>
                                    <Grid item xs={12} md={8}>
                                        <Stack spacing={3}>
                                            <Card>
                                                <CardContent>
                                                    <Stack spacing={2}>
                                                        <Stack direction='row' justifyContent='space-between' alignItems='center'>
                                                            <Box>
                                                                <Typography variant='h3'>{selectedAgent.name}</Typography>
                                                                <Typography variant='body2' color='text.secondary'>
                                                                    {selectedAgent.description}
                                                                </Typography>
                                                            </Box>
                                                            <Stack direction='row' spacing={1}>
                                                                <Button
                                                                    variant='outlined'
                                                                    startIcon={<IconShare />}
                                                                    onClick={() => handleCreateShare()}
                                                                    disabled={!canUpdate}
                                                                >
                                                                    Share
                                                                </Button>
                                                                <Button
                                                                    variant='outlined'
                                                                    color='error'
                                                                    startIcon={<IconTrash />}
                                                                    onClick={handleArchiveAgent}
                                                                    disabled={!canDelete}
                                                                >
                                                                    Archive
                                                                </Button>
                                                            </Stack>
                                                        </Stack>
                                                        <Divider />
                                                        <Grid container spacing={2}>
                                                            <Grid item xs={12} md={6}>
                                                                <Typography variant='subtitle2'>Status</Typography>
                                                                <Typography variant='body2'>{selectedAgent.status || 'active'}</Typography>
                                                            </Grid>
                                                            <Grid item xs={12} md={6}>
                                                                <Typography variant='subtitle2'>Version</Typography>
                                                                <Typography variant='body2'>{selectedAgent.version || 'v1'}</Typography>
                                                            </Grid>
                                                            <Grid item xs={12} md={6}>
                                                                <Typography variant='subtitle2'>LLM model</Typography>
                                                                <Typography variant='body2'>
                                                                    {selectedAgent.llmModel || 'gpt-4.1-mini'}
                                                                </Typography>
                                                            </Grid>
                                                            <Grid item xs={12} md={6}>
                                                                <Typography variant='subtitle2'>Allowed operations</Typography>
                                                                <Typography variant='body2'>
                                                                    {(selectedAgent.allowedOps || []).join(', ') || 'read'}
                                                                </Typography>
                                                            </Grid>
                                                            <Grid item xs={12} md={6}>
                                                                <Typography variant='subtitle2'>Allowed collections</Typography>
                                                                <Typography variant='body2'>
                                                                    {(selectedAgent.allowedCollections || []).join(', ') || 'none'}
                                                                </Typography>
                                                            </Grid>
                                                            <Grid item xs={12}>
                                                                <Typography variant='subtitle2'>Supported tools</Typography>
                                                                <Stack direction='row' spacing={1} flexWrap='wrap' sx={{ mt: 1 }}>
                                                                    {(selectedAgent.tools || []).length ? (
                                                                        selectedAgent.tools.map((tool) => (
                                                                            <Tooltip key={tool.name} title={tool.description || ''}>
                                                                                <Chip label={tool.name} size='small' sx={{ mb: 1 }} />
                                                                            </Tooltip>
                                                                        ))
                                                                    ) : (
                                                                        <Typography variant='body2' color='text.secondary'>
                                                                            No tools configured.
                                                                        </Typography>
                                                                    )}
                                                                </Stack>
                                                            </Grid>
                                                        </Grid>
                                                    </Stack>
                                                </CardContent>
                                            </Card>

                                            <Card>
                                                <CardContent>
                                                    <Stack spacing={2}>
                                                        <Stack
                                                            direction='row'
                                                            justifyContent='space-between'
                                                            alignItems='center'
                                                            spacing={2}
                                                        >
                                                            <Typography variant='h4'>Chat</Typography>
                                                            <Stack direction='row' spacing={1} alignItems='center'>
                                                                <Select
                                                                    size='small'
                                                                    value={selectedSessionId}
                                                                    displayEmpty
                                                                    onChange={(event) => {
                                                                        const newSessionId = event.target.value
                                                                        setSelectedSessionId(newSessionId)
                                                                        if (newSessionId) {
                                                                            loadSessionMessages(selectedAgentId, newSessionId)
                                                                        } else {
                                                                            setMessages([])
                                                                            setSessionId('')
                                                                        }
                                                                    }}
                                                                    sx={{ minWidth: 200 }}
                                                                >
                                                                    <MenuItem value=''>
                                                                        <em>New session</em>
                                                                    </MenuItem>
                                                                    {sessions.map((session) => {
                                                                        const snippet = session.lastMessage?.content
                                                                            ? session.lastMessage.content.slice(0, 40)
                                                                            : ''
                                                                        return (
                                                                            <MenuItem key={session.sessionId} value={session.sessionId}>
                                                                                {session.sessionId.slice(0, 8)}
                                                                                {snippet ? ` - ${snippet}` : ''}
                                                                            </MenuItem>
                                                                        )
                                                                    })}
                                                                </Select>
                                                                <Button
                                                                    variant='outlined'
                                                                    size='small'
                                                                    onClick={() => {
                                                                        setSelectedSessionId('')
                                                                        setMessages([])
                                                                        setSessionId('')
                                                                    }}
                                                                >
                                                                    New
                                                                </Button>
                                                            </Stack>
                                                        </Stack>
                                                        <Divider />
                                                        {quickPrompts.length > 0 && (
                                                            <Stack direction='row' spacing={1} sx={{ flexWrap: 'wrap' }}>
                                                                {quickPrompts.map((prompt) => (
                                                                    <Button
                                                                        key={prompt}
                                                                        variant='outlined'
                                                                        size='small'
                                                                        onClick={() => handleSend(prompt)}
                                                                        disabled={isReplying}
                                                                    >
                                                                        {prompt}
                                                                    </Button>
                                                                ))}
                                                            </Stack>
                                                        )}
                                                        <Stack spacing={1} sx={{ minHeight: 260 }}>
                                                            {messages.length === 0 && (
                                                                <Typography variant='body2' color='text.secondary'>
                                                                    Start a conversation with the agent.
                                                                </Typography>
                                                            )}
                                                            {messages.map((message, idx) => {
                                                                const isUser = message.role === 'user'
                                                                const paragraphs = formatMessage(message.content)
                                                                return (
                                                                    <Box
                                                                        key={`${message.role}-${idx}`}
                                                                        sx={{
                                                                            alignSelf: isUser ? 'flex-end' : 'flex-start',
                                                                            maxWidth: '85%'
                                                                        }}
                                                                    >
                                                                        <Card variant='outlined' sx={{ padding: 1.5 }}>
                                                                            <Stack spacing={1}>
                                                                                {paragraphs.length ? (
                                                                                    paragraphs.map((paragraph, index) => (
                                                                                        <Typography key={index} variant='body2'>
                                                                                            {paragraph}
                                                                                        </Typography>
                                                                                    ))
                                                                                ) : (
                                                                                    <Typography variant='body2'>
                                                                                        {message.content}
                                                                                    </Typography>
                                                                                )}
                                                                            </Stack>
                                                                            {message.metadata?.type === 'holdCard' && (
                                                                                <HoldStatusCard
                                                                                    hold={message.metadata.hold}
                                                                                    onConfirm={openPaymentDialog}
                                                                                    disabled={!canUpdate}
                                                                                />
                                                                            )}
                                                                            {message.metadata?.type === 'reservationCard' && (
                                                                                <ReservationStatusCard
                                                                                    reservation={message.metadata.reservation}
                                                                                    onConfirm={() =>
                                                                                        openPaymentDialog(
                                                                                            getLatestPaymentRequest([message]) || {
                                                                                                kind: 'hotel',
                                                                                                reservationId: message.metadata.reservation?.id,
                                                                                                start: message.metadata.reservation?.checkIn,
                                                                                                end: message.metadata.reservation?.checkOut,
                                                                                                amount: message.metadata.reservation?.precioTotal,
                                                                                                currency: message.metadata.reservation?.moneda || 'USD'
                                                                                            }
                                                                                        )
                                                                                    }
                                                                                    disabled={!canUpdate}
                                                                                />
                                                                            )}
                                                                        </Card>
                                                                    </Box>
                                                                )
                                                            })}
                                                            {isReplying && (
                                                                <Box sx={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                                                                    <Card variant='outlined' sx={{ padding: 1.5 }}>
                                                                        <Stack direction='row' spacing={1} alignItems='center'>
                                                                            <CircularProgress size={18} />
                                                                            <Typography variant='body2' color='text.secondary'>
                                                                                Escribiendo...
                                                                            </Typography>
                                                                        </Stack>
                                                                    </Card>
                                                                </Box>
                                                            )}
                                                        </Stack>
                                                        <Divider />
                                                        <Stack direction='row' spacing={1} alignItems='center'>
                                                            <Tooltip title='Adjuntar comprobante'>
                                                                <IconButton component='label' disabled={!canUpdate || uploadingProof}>
                                                                    <IconPaperclip size={18} />
                                                                    <input type='file' hidden onChange={handleProofUpload} />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <TextField
                                                                fullWidth
                                                                placeholder='Escribi tu mensaje...'
                                                                value={input}
                                                                onChange={(event) => setInput(event.target.value)}
                                                                onKeyDown={(event) => {
                                                                    if (event.key === 'Enter') {
                                                                        event.preventDefault()
                                                                        handleSend()
                                                                    }
                                                                }}
                                                            />
                                                            <Button variant='contained' onClick={handleSend} disabled={!input.trim()}>
                                                                <IconSend size={16} />
                                                            </Button>
                                                        </Stack>
                                                    </Stack>
                                                </CardContent>
                                            </Card>
                                        </Stack>
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <Stack spacing={3}>
                                            <Card>
                                                <CardContent>
                                                    <Stack spacing={2}>
                                                        <Stack direction='row' justifyContent='space-between' alignItems='center'>
                                                            <Typography variant='h4'>Share links</Typography>
                                                            <Button
                                                                variant='outlined'
                                                                size='small'
                                                                startIcon={<IconShare />}
                                                                onClick={() => handleCreateShare()}
                                                                disabled={!canUpdate}
                                                            >
                                                                New link
                                                            </Button>
                                                        </Stack>
                                                        <Divider />
                                                        {shareTokens.length === 0 ? (
                                                            <Typography variant='body2' color='text.secondary'>
                                                                No share links yet.
                                                            </Typography>
                                                        ) : (
                                                            <Stack spacing={1.5}>
                                                                {shareTokens.map((token) => {
                                                                    const createdAt = token.createdAt
                                                                        ? new Date(token.createdAt).toLocaleString()
                                                                        : ''
                                                                    const lastUsedAt = token.lastUsedAt
                                                                        ? new Date(token.lastUsedAt).toLocaleString()
                                                                        : 'Never'
                                                                    return (
                                                                        <Card key={token._id} variant='outlined'>
                                                                            <CardContent
                                                                                sx={{
                                                                                    padding: 1.5,
                                                                                    '&:last-child': { paddingBottom: 1.5 }
                                                                                }}
                                                                            >
                                                                                <Stack spacing={1}>
                                                                                    <Stack
                                                                                        direction='row'
                                                                                        justifyContent='space-between'
                                                                                        alignItems='center'
                                                                                    >
                                                                                        <Typography variant='subtitle2'>
                                                                                            Token {String(token._id).slice(-6)}
                                                                                        </Typography>
                                                                                        <Stack
                                                                                            direction='row'
                                                                                            spacing={1}
                                                                                            alignItems='center'
                                                                                        >
                                                                                            <Chip
                                                                                                size='small'
                                                                                                label={token.status || 'active'}
                                                                                                color={
                                                                                                    token.status === 'active'
                                                                                                        ? 'success'
                                                                                                        : 'default'
                                                                                                }
                                                                                            />
                                                                                            {token.status === 'active' && (
                                                                                                <Button
                                                                                                    size='small'
                                                                                                    color='error'
                                                                                                    onClick={() =>
                                                                                                        handleRevokeToken(token._id)
                                                                                                    }
                                                                                                    disabled={!canUpdate}
                                                                                                >
                                                                                                    Revoke
                                                                                                </Button>
                                                                                            )}
                                                                                        </Stack>
                                                                                    </Stack>
                                                                                    <Stack
                                                                                        direction='row'
                                                                                        spacing={2}
                                                                                        justifyContent='space-between'
                                                                                    >
                                                                                        <Stack spacing={0.5}>
                                                                                            <Typography
                                                                                                variant='caption'
                                                                                                color='text.secondary'
                                                                                            >
                                                                                                Created: {createdAt || 'N/A'}
                                                                                            </Typography>
                                                                                            <Typography
                                                                                                variant='caption'
                                                                                                color='text.secondary'
                                                                                            >
                                                                                                Last used: {lastUsedAt}
                                                                                            </Typography>
                                                                                        </Stack>
                                                                                        <Stack spacing={0.5} alignItems='flex-end'>
                                                                                            <Typography
                                                                                                variant='caption'
                                                                                                color='text.secondary'
                                                                                            >
                                                                                                Usage: {token.usageCount || 0}
                                                                                            </Typography>
                                                                                        </Stack>
                                                                                    </Stack>
                                                                                </Stack>
                                                                            </CardContent>
                                                                        </Card>
                                                                    )
                                                                })}
                                                            </Stack>
                                                        )}
                                                    </Stack>
                                                </CardContent>
                                            </Card>

                                            <Card>
                                                <CardContent>
                                                    <Stack spacing={2}>
                                                        <Typography variant='h4'>KPI</Typography>
                                                        <Stack spacing={1}>
                                                            <TextField
                                                                size='small'
                                                                label='Zone filter'
                                                                value={zoneFilter}
                                                                onChange={(event) => setZoneFilter(event.target.value)}
                                                            />
                                                            <TextField
                                                                size='small'
                                                                label='Date'
                                                                type='date'
                                                                value={kpiDate}
                                                                onChange={(event) => setKpiDate(event.target.value)}
                                                                InputLabelProps={{ shrink: true }}
                                                            />
                                                        </Stack>
                                                        <Divider />
                                                        {kpi ? (
                                                            <Stack spacing={1}>
                                                                <Typography variant='body2'>
                                                                    Avg competitor price: {kpi.avgCompetitorPrice?.toFixed?.(0) || 0}{' '}
                                                                    {kpi.currency || 'USD'}
                                                                </Typography>
                                                                <Typography variant='body2'>
                                                                    Avg our price: {kpi.avgOurPrice?.toFixed?.(0) || 0}{' '}
                                                                    {kpi.currency || 'USD'}
                                                                </Typography>
                                                                <Typography variant='body2'>
                                                                    Delta pct: {kpi.deltaPct?.toFixed?.(1) || 0}%
                                                                </Typography>
                                                                <Typography variant='caption' color='text.secondary'>
                                                                    Reference date: {kpi.referenceDate || 'N/A'}
                                                                    {kpi.dataStale ? ' (stale for selected date)' : ''}
                                                                </Typography>
                                                            </Stack>
                                                        ) : (
                                                            <Typography variant='body2' color='text.secondary'>
                                                                KPI data not available yet.
                                                            </Typography>
                                                        )}
                                                    </Stack>
                                                </CardContent>
                                            </Card>

                                            <Card>
                                                <CardContent>
                                                    <Stack spacing={2}>
                                                        <Stack direction='row' justifyContent='space-between' alignItems='center'>
                                                            <Typography variant='h4'>Outbound</Typography>
                                                            <Tooltip title='Refresh outbound list'>
                                                                <IconButton onClick={() => loadOutbound(selectedAgentId)}>
                                                                    <IconRefresh size={18} />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Stack>
                                                        <Divider />
                                                        {outbound ? (
                                                            <Stack spacing={2}>
                                                                <Stack direction='row' spacing={2} alignItems='center'>
                                                                    <Typography variant='body2'>
                                                                        Occupancy: {outbound.occupancyPct?.toFixed?.(0) || 0}%
                                                                    </Typography>
                                                                    <Chip
                                                                        size='small'
                                                                        color={outbound.shouldOutbound ? 'warning' : 'success'}
                                                                        label={
                                                                            outbound.shouldOutbound ? 'Outbound suggested' : 'Occupancy ok'
                                                                        }
                                                                    />
                                                                </Stack>
                                                                <Stack direction='row' spacing={1} alignItems='center'>
                                                                    <Typography variant='subtitle2'>Template</Typography>
                                                                    <Select
                                                                        size='small'
                                                                        value={outboundTemplateId}
                                                                        onChange={(event) => setOutboundTemplateId(event.target.value)}
                                                                    >
                                                                        {(outbound.templates || []).map((template) => (
                                                                            <MenuItem key={template.id} value={template.id}>
                                                                                {template.id}
                                                                            </MenuItem>
                                                                        ))}
                                                                    </Select>
                                                                </Stack>
                                                                {outbound.leads?.length ? (
                                                                    <List dense>
                                                                        {outbound.leads.map((lead) => (
                                                                            <ListItemButton key={lead.id} disableRipple>
                                                                                <ListItemText
                                                                                    primary={`${lead.name || 'Lead'} (${
                                                                                        lead.status || 'open'
                                                                                    })`}
                                                                                    secondary={lead.phone || ''}
                                                                                />
                                                                                <Button
                                                                                    size='small'
                                                                                    variant='outlined'
                                                                                    onClick={() => handleSendOutbound(lead.id)}
                                                                                    disabled={!canUpdate}
                                                                                >
                                                                                    Send
                                                                                </Button>
                                                                            </ListItemButton>
                                                                        ))}
                                                                    </List>
                                                                ) : (
                                                                    <Typography variant='body2' color='text.secondary'>
                                                                        No outbound leads at the moment.
                                                                    </Typography>
                                                                )}
                                                            </Stack>
                                                        ) : (
                                                            <Typography variant='body2' color='text.secondary'>
                                                                Outbound data not available yet.
                                                            </Typography>
                                                        )}
                                                    </Stack>
                                                </CardContent>
                                            </Card>
                                        </Stack>
                                    </Grid>
                                </Grid>
                            )}
                        </Grid>
                    </Grid>
                </Stack>
            </MainCard>

            <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth='sm' fullWidth>
                <DialogTitle>Share link created</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField label='Public URL' value={shareUrl} fullWidth InputProps={{ readOnly: true }} />
                        <TextField label='Share token' value={shareToken} fullWidth InputProps={{ readOnly: true }} />
                        <Button
                            variant='outlined'
                            startIcon={<IconCopy size={16} />}
                            onClick={() => {
                                if (shareUrl) navigator.clipboard.writeText(shareUrl)
                            }}
                        >
                            Copy URL
                        </Button>
                        <Typography variant='subtitle1'>Public API</Typography>
                        <TextField label='POST URL' value={publicApiUrl} fullWidth InputProps={{ readOnly: true }} />
                        <TextField
                            label='Payload example'
                            value={`{\n  "message": "Hola! Quiero consultar disponibilidad.",\n  "sessionId": "S-123"\n}`}
                            fullWidth
                            multiline
                            minRows={3}
                            InputProps={{ readOnly: true }}
                        />
                        <Divider />
                        <Typography variant='subtitle1'>Title settings</Typography>
                        <TextField
                            label='Title'
                            value={shareConfig.title}
                            onChange={(event) => setShareConfig((prev) => ({ ...prev, title: event.target.value }))}
                            fullWidth
                        />
                        <TextField
                            label='Title avatar link'
                            value={shareConfig.titleAvatarSrc}
                            onChange={(event) => setShareConfig((prev) => ({ ...prev, titleAvatarSrc: event.target.value }))}
                            fullWidth
                        />
                        <Stack direction='row' spacing={2}>
                            <TextField
                                label='Title background color'
                                type='color'
                                value={shareConfig.titleBackgroundColor}
                                onChange={(event) => setShareConfig((prev) => ({ ...prev, titleBackgroundColor: event.target.value }))}
                                sx={{ maxWidth: 160 }}
                                InputLabelProps={{ shrink: true }}
                            />
                            <TextField
                                label='Title text color'
                                type='color'
                                value={shareConfig.titleTextColor}
                                onChange={(event) => setShareConfig((prev) => ({ ...prev, titleTextColor: event.target.value }))}
                                sx={{ maxWidth: 160 }}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Stack>
                        <Divider />
                        <Typography variant='subtitle1'>General settings</Typography>
                        <TextField
                            label='Welcome message'
                            value={shareConfig.welcomeMessage}
                            onChange={(event) => setShareConfig((prev) => ({ ...prev, welcomeMessage: event.target.value }))}
                            fullWidth
                        />
                        <TextField
                            label='Error message'
                            value={shareConfig.errorMessage}
                            onChange={(event) => setShareConfig((prev) => ({ ...prev, errorMessage: event.target.value }))}
                            fullWidth
                        />
                        <Stack direction='row' spacing={2}>
                            <TextField
                                label='Background color'
                                type='color'
                                value={shareConfig.backgroundColor}
                                onChange={(event) => setShareConfig((prev) => ({ ...prev, backgroundColor: event.target.value }))}
                                sx={{ maxWidth: 160 }}
                                InputLabelProps={{ shrink: true }}
                            />
                            <TextField
                                label='Font size'
                                type='number'
                                value={shareConfig.fontSize}
                                onChange={(event) =>
                                    setShareConfig((prev) => ({
                                        ...prev,
                                        fontSize: Number(event.target.value) || prev.fontSize
                                    }))
                                }
                                sx={{ maxWidth: 160 }}
                            />
                            <TextField
                                label='PoweredBy text color'
                                type='color'
                                value={shareConfig.poweredByTextColor}
                                onChange={(event) => setShareConfig((prev) => ({ ...prev, poweredByTextColor: event.target.value }))}
                                sx={{ maxWidth: 160 }}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Stack>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={shareConfig.showAgentMessages}
                                    onChange={(event) => setShareConfig((prev) => ({ ...prev, showAgentMessages: event.target.checked }))}
                                />
                            }
                            label='Show agent reasonings when using Agentflow'
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={shareConfig.renderHTML}
                                    onChange={(event) => setShareConfig((prev) => ({ ...prev, renderHTML: event.target.checked }))}
                                />
                            }
                            label='Render HTML on the chat'
                        />
                        <Divider />
                        <Typography variant='subtitle1'>Bot message</Typography>
                        <Stack direction='row' spacing={2}>
                            <TextField
                                label='Background color'
                                type='color'
                                value={shareConfig.botMessage.backgroundColor}
                                onChange={(event) =>
                                    setShareConfig((prev) => ({
                                        ...prev,
                                        botMessage: { ...prev.botMessage, backgroundColor: event.target.value }
                                    }))
                                }
                                sx={{ maxWidth: 160 }}
                                InputLabelProps={{ shrink: true }}
                            />
                            <TextField
                                label='Text color'
                                type='color'
                                value={shareConfig.botMessage.textColor}
                                onChange={(event) =>
                                    setShareConfig((prev) => ({
                                        ...prev,
                                        botMessage: { ...prev.botMessage, textColor: event.target.value }
                                    }))
                                }
                                sx={{ maxWidth: 160 }}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Stack>
                        <TextField
                            label='Avatar link'
                            value={shareConfig.botMessage.avatarSrc}
                            onChange={(event) =>
                                setShareConfig((prev) => ({
                                    ...prev,
                                    botMessage: { ...prev.botMessage, avatarSrc: event.target.value }
                                }))
                            }
                            fullWidth
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={shareConfig.botMessage.showAvatar}
                                    onChange={(event) =>
                                        setShareConfig((prev) => ({
                                            ...prev,
                                            botMessage: { ...prev.botMessage, showAvatar: event.target.checked }
                                        }))
                                    }
                                />
                            }
                            label='Show avatar'
                        />
                        <Divider />
                        <Typography variant='subtitle1'>User message</Typography>
                        <Stack direction='row' spacing={2}>
                            <TextField
                                label='Background color'
                                type='color'
                                value={shareConfig.userMessage.backgroundColor}
                                onChange={(event) =>
                                    setShareConfig((prev) => ({
                                        ...prev,
                                        userMessage: { ...prev.userMessage, backgroundColor: event.target.value }
                                    }))
                                }
                                sx={{ maxWidth: 160 }}
                                InputLabelProps={{ shrink: true }}
                            />
                            <TextField
                                label='Text color'
                                type='color'
                                value={shareConfig.userMessage.textColor}
                                onChange={(event) =>
                                    setShareConfig((prev) => ({
                                        ...prev,
                                        userMessage: { ...prev.userMessage, textColor: event.target.value }
                                    }))
                                }
                                sx={{ maxWidth: 160 }}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Stack>
                        <TextField
                            label='Avatar link'
                            value={shareConfig.userMessage.avatarSrc}
                            onChange={(event) =>
                                setShareConfig((prev) => ({
                                    ...prev,
                                    userMessage: { ...prev.userMessage, avatarSrc: event.target.value }
                                }))
                            }
                            fullWidth
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={shareConfig.userMessage.showAvatar}
                                    onChange={(event) =>
                                        setShareConfig((prev) => ({
                                            ...prev,
                                            userMessage: { ...prev.userMessage, showAvatar: event.target.checked }
                                        }))
                                    }
                                />
                            }
                            label='Show avatar'
                        />
                        <Divider />
                        <Typography variant='subtitle1'>Text input</Typography>
                        <Stack direction='row' spacing={2}>
                            <TextField
                                label='Background color'
                                type='color'
                                value={shareConfig.textInput.backgroundColor}
                                onChange={(event) =>
                                    setShareConfig((prev) => ({
                                        ...prev,
                                        textInput: { ...prev.textInput, backgroundColor: event.target.value }
                                    }))
                                }
                                sx={{ maxWidth: 160 }}
                                InputLabelProps={{ shrink: true }}
                            />
                            <TextField
                                label='Text color'
                                type='color'
                                value={shareConfig.textInput.textColor}
                                onChange={(event) =>
                                    setShareConfig((prev) => ({
                                        ...prev,
                                        textInput: { ...prev.textInput, textColor: event.target.value }
                                    }))
                                }
                                sx={{ maxWidth: 160 }}
                                InputLabelProps={{ shrink: true }}
                            />
                            <TextField
                                label='Send button color'
                                type='color'
                                value={shareConfig.textInput.sendButtonColor}
                                onChange={(event) =>
                                    setShareConfig((prev) => ({
                                        ...prev,
                                        textInput: { ...prev.textInput, sendButtonColor: event.target.value }
                                    }))
                                }
                                sx={{ maxWidth: 160 }}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Stack>
                        <TextField
                            label='Text input placeholder'
                            value={shareConfig.textInput.placeholder}
                            onChange={(event) =>
                                setShareConfig((prev) => ({
                                    ...prev,
                                    textInput: { ...prev.textInput, placeholder: event.target.value }
                                }))
                            }
                            fullWidth
                        />
                        <Button variant='contained' onClick={() => handleCreateShare()} disabled={!canUpdate}>
                            Generate link with these settings
                        </Button>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShareDialogOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth='sm' fullWidth>
                <DialogTitle>Confirmar deposito/anticipo</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label={pendingHold?.kind === 'hotel' ? 'Reservation' : 'Property'}
                            value={
                                pendingHold?.kind === 'hotel'
                                    ? pendingHold?.reservationId || pendingHold?.propertyId || ''
                                    : pendingHold?.propertyId || ''
                            }
                            fullWidth
                            InputProps={{ readOnly: true }}
                        />
                        <TextField
                            label='Dates'
                            value={pendingHold ? `${pendingHold.start} to ${pendingHold.end}` : ''}
                            fullWidth
                            InputProps={{ readOnly: true }}
                        />
                        <TextField label='Comprobante/referencia' value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
                        <TextField label='Monto' value={amount} onChange={(e) => setAmount(e.target.value)} type='number' />
                        <FormControl fullWidth>
                            <InputLabel id='currency-label'>Moneda</InputLabel>
                            <Select
                                labelId='currency-label'
                                label='Moneda'
                                value={currency}
                                onChange={(e) => {
                                    const nextCurrency = e.target.value
                                    setCurrency(nextCurrency)
                                    if (depositBaseUsd) {
                                        const computed =
                                            nextCurrency === 'ARS'
                                                ? Math.round(depositBaseUsd * USD_TO_ARS)
                                                : Number(depositBaseUsd.toFixed(2))
                                        setAmount(String(computed))
                                    }
                                }}
                                fullWidth
                            >
                                <MenuItem value='USD'>USD</MenuItem>
                                <MenuItem value='ARS'>ARS</MenuItem>
                            </Select>
                        </FormControl>
                        <TextField
                            label='Follow-up message (optional)'
                            value={followUpMessage}
                            onChange={(e) => setFollowUpMessage(e.target.value)}
                            multiline
                            minRows={2}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
                    <Button variant='contained' onClick={handleConfirmPayment} disabled={!canUpdate}>
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>

            <BackdropLoader open={isLoading} />
            <ConfirmDialog />
        </>
    )
}

export default ManualAgents
