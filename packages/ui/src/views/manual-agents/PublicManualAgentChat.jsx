import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Button, Card, CardContent, Divider, Stack, TextField, Typography } from '@mui/material'

import useApi from '@/hooks/useApi'
import manualAgentsApi from '@/api/manualAgents'

const defaultChatbotConfig = {
    title: 'Freia Assistant',
    titleAvatarSrc: '',
    titleBackgroundColor: '#3B81F6',
    titleTextColor: '#ffffff',
    welcomeMessage: 'Hello! This is custom welcome message',
    errorMessage: 'This is custom error message',
    backgroundColor: '#ffffff',
    fontSize: 16,
    poweredByTextColor: '#ffffff',
    renderHTML: false,
    showAgentMessages: true,
    botMessage: {
        backgroundColor: '#f7f8ff',
        textColor: '#111827',
        avatarSrc: '',
        showAvatar: false
    },
    userMessage: {
        backgroundColor: '#3B81F6',
        textColor: '#ffffff',
        avatarSrc: '',
        showAvatar: false
    },
    textInput: {
        backgroundColor: '#ffffff',
        textColor: '#111827',
        placeholder: 'Type question..',
        sendButtonColor: '#3B81F6'
    }
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

    const publicChatApi = useApi(manualAgentsApi.publicChat)

    const handleSend = async () => {
        if (!input.trim()) return
        const userMessage = { role: 'user', content: input, timestamp: new Date() }
        setMessages((prev) => [...prev, userMessage])
        setInput('')

        try {
            const response = await publicChatApi.request(token, { message: userMessage.content, sessionId })
            const reply = response?.data?.answer || 'No pude procesar tu consulta.'
            const assistantMessage = { role: 'assistant', content: reply, timestamp: new Date() }
            setMessages((prev) => [...prev, assistantMessage])
            if (!sessionId && response?.data?.sessionId) {
                setSessionId(response.data.sessionId)
            }
        } catch (error) {
            const fallbackMessage = chatbotConfig.errorMessage || 'Hubo un error al enviar el mensaje. Probemos de nuevo.'
            setMessages((prev) => [...prev, { role: 'assistant', content: fallbackMessage, timestamp: new Date() }])
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

    return (
        <Box sx={{ maxWidth: 980, margin: '0 auto', padding: 3 }}>
            <Card variant='outlined' sx={{ borderRadius: 2, overflow: 'hidden' }}>
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
                                                <Typography variant='body2' sx={{ fontSize: chatbotConfig.fontSize }}>
                                                    {content}
                                                </Typography>
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
                        <Stack direction='row' spacing={1}>
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
