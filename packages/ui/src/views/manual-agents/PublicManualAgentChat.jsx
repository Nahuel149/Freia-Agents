import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Button, Card, CardContent, Divider, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material'
import { IconPaperclip } from '@tabler/icons-react'

import useApi from '@/hooks/useApi'
import manualAgentsApi from '@/api/manualAgents'

const defaultChatbotConfig = {
    title: 'Freia Assistant',
    titleAvatarSrc: '',
    titleBackgroundColor: '#14171a',
    titleTextColor: '#f5f1e8',
    welcomeMessage: 'Hola! Contame fechas y cantidad de personas para chequear disponibilidad.',
    errorMessage: 'Hubo un problema, intentemos de nuevo en un minuto.',
    backgroundColor: '#0f1113',
    fontSize: 16,
    poweredByTextColor: '#8a949c',
    renderHTML: false,
    showAgentMessages: true,
    botMessage: {
        backgroundColor: '#1c2126',
        textColor: '#e7edf3',
        avatarSrc: '',
        showAvatar: false
    },
    userMessage: {
        backgroundColor: '#1a3a2c',
        textColor: '#eef3ee',
        avatarSrc: '',
        showAvatar: false
    },
    textInput: {
        backgroundColor: '#15191e',
        textColor: '#e7edf3',
        placeholder: 'Escribi tu consulta...',
        sendButtonColor: '#1a3a2c'
    }
}

const HoldStatusCard = ({ hold, onConfirm }) => {
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
                    {typeof hold.totalAmount === 'number' && (
                        <Typography variant='body2'>
                            Total: {hold.totalAmount} {hold.currency || 'USD'}
                        </Typography>
                    )}
                    {typeof hold.depositAmount === 'number' && (
                        <Typography variant='body2'>
                            Deposito ({hold.depositPct || 0}%): {hold.depositAmount} {hold.currency || 'USD'}
                        </Typography>
                    )}
                    {hold.holdExpires && (
                        <Typography variant='caption' color='text.secondary'>
                            Expires: {new Date(hold.holdExpires).toLocaleString()}
                        </Typography>
                    )}
                    <Button variant='contained' size='small' onClick={onConfirm}>
                        Adjuntar comprobante
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    )
}

const sanitizeHtml = (value) => {
    if (!value) return ''
    return String(value).replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
}

const PublicManualAgentChat = () => {
    const { token } = useParams()
    const [agentInfo, setAgentInfo] = useState(null)
    const [chatbotConfig, setChatbotConfig] = useState(defaultChatbotConfig)
    const [messages, setMessages] = useState([])
    const [sessionId, setSessionId] = useState('')
    const [input, setInput] = useState('')
    const [uploadingProof, setUploadingProof] = useState(false)
    const fileInputRef = useRef(null)

    const publicChatApi = useApi(manualAgentsApi.publicChat)
    const publicConfirmPaymentApi = useApi(manualAgentsApi.publicConfirmPayment)

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

    const handleSend = async (messageOverride) => {
        const rawContent = typeof messageOverride === 'string' ? messageOverride : input
        const content = rawContent.trim()
        if (!content) return
        const userMessage = { role: 'user', content, timestamp: new Date() }
        setMessages((prev) => [...prev, userMessage])
        setInput('')

        try {
            const response = await publicChatApi.request(token, { message: userMessage.content, sessionId })
            const reply = response?.data?.answer || 'No pude procesar tu consulta.'
            const assistantMessage = { role: 'assistant', content: reply, timestamp: new Date(), metadata: response?.data?.metadata }
            setMessages((prev) => [...prev, assistantMessage])
            if (!sessionId && response?.data?.sessionId) {
                setSessionId(response.data.sessionId)
            }
        } catch (error) {
            const fallbackMessage = chatbotConfig.errorMessage || 'Hubo un error al enviar el mensaje. Probemos de nuevo.'
            setMessages((prev) => [...prev, { role: 'assistant', content: fallbackMessage, timestamp: new Date() }])
        }
    }

    const handleProofUpload = async (event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        if (!sessionId) {
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: 'Primero iniciemos una charla para generar la reserva.', timestamp: new Date() }
            ])
            return
        }
        const latestPayment = getLatestPaymentRequest(messages)
        if (!latestPayment) {
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: 'No encuentro una reserva pendiente de pago para confirmar.', timestamp: new Date() }
            ])
            return
        }
        setUploadingProof(true)
        const userMessage = { role: 'user', content: `Comprobante enviado: ${file.name}`, timestamp: new Date() }
        setMessages((prev) => [...prev, userMessage])
        try {
            if (latestPayment.kind === 'hotel') {
                await publicConfirmPaymentApi.request(token, {
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
                await publicConfirmPaymentApi.request(token, {
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
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: 'Perfecto, recibimos tu comprobante. Ya dejamos confirmada la reserva. Si necesitas algo mas, avisame.',
                    timestamp: new Date()
                }
            ])
        } catch (error) {
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: 'No pude confirmar el comprobante. Probemos de nuevo.', timestamp: new Date() }
            ])
        } finally {
            setUploadingProof(false)
        }
    }

    useEffect(() => {
        if (!sessionId) return undefined

        let isActive = true
        const fetchSession = async () => {
            try {
                const response = await manualAgentsApi.getPublicSession(token, sessionId)
                const sessionMessages = response?.data?.messages || []
                if (isActive) {
                    setMessages(sessionMessages)
                }
            } catch (error) {
                // ignore polling errors
            }
        }

        fetchSession()
        const intervalId = setInterval(fetchSession, 5000)
        return () => {
            isActive = false
            clearInterval(intervalId)
        }
    }, [sessionId, token])

    useEffect(() => {
        if (!token) return undefined
        let isActive = true

        const fetchAgentInfo = async () => {
            try {
                const response = await manualAgentsApi.getPublicAgentInfo(token)
                if (isActive) {
                    const info = response?.data || null
                    setAgentInfo(info)
                    const config = info?.chatbotConfig || {}
                    setChatbotConfig({
                        ...defaultChatbotConfig,
                        ...config,
                        botMessage: { ...defaultChatbotConfig.botMessage, ...(config.botMessage || {}) },
                        userMessage: { ...defaultChatbotConfig.userMessage, ...(config.userMessage || {}) },
                        textInput: { ...defaultChatbotConfig.textInput, ...(config.textInput || {}) }
                    })
                }
            } catch (error) {
                if (isActive) {
                    setAgentInfo(null)
                    setChatbotConfig(defaultChatbotConfig)
                }
            }
        }

        fetchAgentInfo()
        return () => {
            isActive = false
        }
    }, [token])

    const title = chatbotConfig.title || agentInfo?.name || 'Chatbot'
    const placeholder = chatbotConfig.textInput?.placeholder || 'Escribi tu mensaje...'
    const welcomeMessage = chatbotConfig.welcomeMessage || 'Escribi tu consulta para comenzar.'
    const quickPrompts =
        agentInfo?.id === 'gran-sol'
            ? ['Reservar nueva estadia', 'Modificar reserva', 'Cancelar', 'Servicios del hotel', 'Atencion al huesped']
            : []
    const formatMessage = (content) => {
        if (!content) return []
        const normalized = content.replace(/\r\n/g, '\n').trim()
        const spaced = normalized
            .replace(/\.\s+-\s+/g, '.\n\n- ')
            .replace(/:\s+-\s+/g, ':\n\n- ')
            .replace(/\n-\s+/g, '\n\n- ')
            .replace(/\n(\d+)\.\s+/g, '\n\n$1. ')
            .replace(/([^\n])\s-\s(?=[A-Z])/g, '$1\n\n- ')
            .replace(/\.\s+/g, '.\n\n')
        return spaced
            .split(/\n{2,}/)
            .map((block) => block.trim())
            .filter(Boolean)
    }

    return (
        <Box
            sx={{
                minHeight: '100vh',
                padding: { xs: 2, md: 4 },
                background:
                    'radial-gradient(1200px 700px at 20% -10%, rgba(31, 78, 61, 0.35), transparent), radial-gradient(900px 700px at 110% 10%, rgba(148, 94, 32, 0.25), transparent), #0b0f0e'
            }}
        >
            <Card
                variant='outlined'
                sx={{
                    maxWidth: 980,
                    margin: '0 auto',
                    borderRadius: 3,
                    overflow: 'hidden',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 30px 80px rgba(0,0,0,0.45)'
                }}
            >
                <Box sx={{ backgroundColor: chatbotConfig.titleBackgroundColor, padding: 2 }}>
                    <Stack direction='row' spacing={1.5} alignItems='center'>
                        {chatbotConfig.titleAvatarSrc && (
                            <Box
                                component='img'
                                src={chatbotConfig.titleAvatarSrc}
                                alt='chatbot avatar'
                                sx={{ width: 36, height: 36, borderRadius: '50%' }}
                            />
                        )}
                        <Box>
                            <Typography variant='h3' sx={{ color: chatbotConfig.titleTextColor }}>
                                {title}
                            </Typography>
                            {agentInfo?.description && (
                                <Typography variant='body2' sx={{ color: chatbotConfig.titleTextColor }}>
                                    {agentInfo.description}
                                </Typography>
                            )}
                        </Box>
                    </Stack>
                </Box>
                <CardContent sx={{ backgroundColor: chatbotConfig.backgroundColor }}>
                    <Stack spacing={2}>
                        <Stack spacing={1} sx={{ minHeight: 360 }}>
                            {messages.length === 0 && (
                                <Typography variant='body2' color='text.secondary'>
                                    {welcomeMessage}
                                </Typography>
                            )}
                            {messages.map((message, idx) => {
                                const isUser = message.role === 'user'
                                const messageConfig = isUser ? chatbotConfig.userMessage : chatbotConfig.botMessage
                                const showAvatar = messageConfig?.showAvatar && messageConfig?.avatarSrc
                                const content = message.content || ''
                                const paragraphs = formatMessage(content)
                                return (
                                    <Stack
                                        key={`${message.role}-${idx}`}
                                        direction='row'
                                        spacing={1}
                                        justifyContent={isUser ? 'flex-end' : 'flex-start'}
                                        alignItems='flex-start'
                                    >
                                        {!isUser && showAvatar && (
                                            <Box
                                                component='img'
                                                src={messageConfig.avatarSrc}
                                                alt='bot avatar'
                                                sx={{ width: 28, height: 28, borderRadius: '50%', mt: 0.5 }}
                                            />
                                        )}
                                        <Card
                                            variant='outlined'
                                            sx={{
                                                padding: 1.5,
                                                maxWidth: '80%',
                                                backgroundColor: messageConfig?.backgroundColor,
                                                color: messageConfig?.textColor
                                            }}
                                        >
                                            {chatbotConfig.renderHTML && !isUser ? (
                                                <Box
                                                    sx={{ fontSize: chatbotConfig.fontSize }}
                                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
                                                />
                                            ) : (
                                                <Stack spacing={1}>
                                                    {paragraphs.length ? (
                                                        paragraphs.map((paragraph, index) => (
                                                            <Typography key={index} variant='body2' sx={{ fontSize: chatbotConfig.fontSize }}>
                                                                {paragraph}
                                                            </Typography>
                                                        ))
                                                    ) : (
                                                        <Typography variant='body2' sx={{ fontSize: chatbotConfig.fontSize }}>
                                                            {content}
                                                        </Typography>
                                                    )}
                                                </Stack>
                                            )}
                                            {message.metadata?.type === 'holdCard' && (
                                                <HoldStatusCard
                                                    hold={message.metadata.hold}
                                                    onConfirm={() => fileInputRef.current?.click()}
                                                />
                                            )}
                                        </Card>
                                        {isUser && showAvatar && (
                                            <Box
                                                component='img'
                                                src={messageConfig.avatarSrc}
                                                alt='user avatar'
                                                sx={{ width: 28, height: 28, borderRadius: '50%', mt: 0.5 }}
                                            />
                                        )}
                                    </Stack>
                                )
                            })}
                        </Stack>
                        <Divider />
                        {quickPrompts.length > 0 && (
                            <Stack direction='row' spacing={1} sx={{ flexWrap: 'wrap' }}>
                                {quickPrompts.map((prompt) => (
                                    <Button key={prompt} variant='outlined' size='small' onClick={() => handleSend(prompt)}>
                                        {prompt}
                                    </Button>
                                ))}
                            </Stack>
                        )}
                        <Stack direction='row' spacing={1} alignItems='center'>
                            <Tooltip title='Adjuntar comprobante'>
                                <IconButton component='label' disabled={uploadingProof}>
                                    <IconPaperclip size={18} />
                                    <input ref={fileInputRef} type='file' hidden onChange={handleProofUpload} />
                                </IconButton>
                            </Tooltip>
                            <TextField
                                fullWidth
                                placeholder={placeholder}
                                value={input}
                                onChange={(event) => setInput(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault()
                                        handleSend()
                                    }
                                }}
                                sx={{
                                    '& .MuiInputBase-root': {
                                        backgroundColor: chatbotConfig.textInput?.backgroundColor,
                                        color: chatbotConfig.textInput?.textColor
                                    }
                                }}
                            />
                            <Button
                                variant='contained'
                                onClick={handleSend}
                                disabled={!input.trim()}
                                sx={{ backgroundColor: chatbotConfig.textInput?.sendButtonColor }}
                            >
                                Enviar
                            </Button>
                        </Stack>
                        <Typography variant='caption' sx={{ color: chatbotConfig.poweredByTextColor }}>
                            Powered by Freia
                        </Typography>
                    </Stack>
                </CardContent>
            </Card>
        </Box>
    )
}

export default PublicManualAgentChat
