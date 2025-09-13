import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'

// material-ui
import {
    Box,
    Button,
    Card,
    CardContent,
    Grid,
    Typography,
    Stack,
    Divider,
    Paper,
    TextField,
    IconButton,
    Chip,
    Alert,
    CircularProgress,
    FormControlLabel,
    Switch,
    Tooltip
} from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import { BackdropLoader } from '@/ui-component/loading/BackdropLoader'

// API
import codeAgentApi from '@/api/codeAgent'

// Hooks
import useApi from '@/hooks/useApi'
import useNotifier from '@/utils/useNotifier'

// store
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'

// icons
import { IconCode, IconSend, IconArrowLeft, IconPlayerPlay, IconRefresh } from '@tabler/icons-react'

// ==============================|| CODEAGENT EXECUTION ||============================== //

const CodeAgentExecution = () => {
    const theme = useTheme()
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { t } = useTranslation()
    const { id } = useParams()
    const location = useLocation()
    const messagesEndRef = useRef(null)

    useNotifier()
    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const [codeAgent, setCodeAgent] = useState(null)
    const [messages, setMessages] = useState([])
    const [inputMessage, setInputMessage] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isExecuting, setIsExecuting] = useState(false)
    const [executionStatus, setExecutionStatus] = useState('idle') // idle, running, success, error
    const DEFAULT_V2_STORE_IDS = ['productosgomerias', 'clientesgomeria', 'ventasgomeria', 'manualgomeria']
    const effectiveSelectedDocIds = (location?.state?.selectedDocIds && location.state.selectedDocIds.length > 0)
        ? location.state.selectedDocIds
        : DEFAULT_V2_STORE_IDS
    const [autoloadOn, setAutoloadOn] = useState(() => {
        const preset = location?.state?.autoload
        if (typeof preset === 'boolean') return preset
        // Default ON when we have default IDs to make direct-route usage smooth
        return true
    })

    const getCodeAgentApi = useApi(codeAgentApi.getSpecificCodeAgent)
    const executeCodeAgentApi = useApi(codeAgentApi.executeCodeAgent)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const getCodeAgent = async () => {
        try {
            const response = await getCodeAgentApi.request(id)
            setCodeAgent(response.data)
            // Add welcome message
            setMessages([{
                id: 'welcome',
                type: 'system',
                content: `Welcome to ${response.data.name}! You can now interact with your CodeAgent.`,
                timestamp: new Date().toISOString()
            }])
        } catch (error) {
            console.error('Error fetching code agent:', error)
            enqueueSnackbar({
                message: 'Failed to fetch CodeAgent',
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error'
                }
            })
            navigate('/codeagent')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (id) {
            getCodeAgent()
        }
    }, [id])

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || isExecuting) return

        const userMessage = {
            id: Date.now().toString(),
            type: 'user',
            content: inputMessage,
            timestamp: new Date().toISOString()
        }

        setMessages(prev => [...prev, userMessage])
        setInputMessage('')
        setIsExecuting(true)
        setExecutionStatus('running')

        try {
            const autoload = autoloadOn && !!(effectiveSelectedDocIds?.length || location?.state?.selectedDocuments)
            const response = await executeCodeAgentApi.request(id, {
                input: inputMessage,
                context: {
                    chatHistory: messages,
                    sessionId: `session_${Date.now()}`,
                    user: 'current_user',
                    autoload,
                    // v2: prefer IDs for server-side resolution
                    selectedDocIds: effectiveSelectedDocIds || null,
                    // legacy fallback: pass inline selected documents if present
                    selectedDocuments: location?.state?.selectedDocuments || null
                }
            })

            // Client-side debug logging
            try {
                // eslint-disable-next-line no-console
                console.debug('[CodeAgent] HTTP', response.status, 'keys=', Object.keys(response.data || {}))
                if (response.data?.status || response.data?.error) {
                    // eslint-disable-next-line no-console
                    console.debug('[CodeAgent] exec status=', response.data.status, 'error=', response.data.error)
                }
                if (Array.isArray(response.data?.logs)) {
                    // eslint-disable-next-line no-console
                    console.debug('[CodeAgent] server logs:\n' + (response.data.logs || []).join('\n'))
                }
            } catch {}

            // Prefer server-provided message; else try to parse output JSON { reply }
            let content = response.data?.message || ''
            if (!content) {
                const raw = response.data?.output
                if (typeof raw === 'string' && raw.trim()) {
                    try {
                        const parsed = JSON.parse(raw)
                        content = parsed?.reply || raw
                    } catch {
                        content = raw
                    }
                }
            }
            if (!content && response?.data?.status === 'failed' && response?.data?.error) {
                content = `Error: ${String(response.data.error).slice(0, 800)}`
            }

            const agentMessage = {
                id: (Date.now() + 1).toString(),
                type: 'agent',
                content: content || 'Code executed successfully',
                data: response.data.data,
                logs: response.data.logs,
                stderr: response.data.status === 'failed' && response.data.error ? String(response.data.error) : undefined,
                timestamp: new Date().toISOString()
            }

            setMessages(prev => [...prev, agentMessage])
            setExecutionStatus('success')

            // Optional banner about autoload
            if (response?.data?.autoloadSummary) {
                const summary = response.data.autoloadSummary
                enqueueSnackbar({
                    message: `Loaded ${summary.stores} store(s) · ${(summary.bytes/1024/1024).toFixed(1)} MB`,
                    options: { key: new Date().getTime() + Math.random(), variant: 'info' }
                })
            }
        } catch (error) {
            console.error('Error executing code agent:', error)
            const errorMessage = {
                id: (Date.now() + 1).toString(),
                type: 'error',
                content: error.response?.data?.message || 'An error occurred while executing the code',
                error: error.response?.data?.error,
                timestamp: new Date().toISOString()
            }
            setMessages(prev => [...prev, errorMessage])
            setExecutionStatus('error')
        } finally {
            setIsExecuting(false)
        }
    }

    const handleKeyPress = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            handleSendMessage()
        }
    }

    const clearChat = () => {
        setMessages([{
            id: 'welcome',
            type: 'system',
            content: `Welcome to ${codeAgent.name}! You can now interact with your CodeAgent.`,
            timestamp: new Date().toISOString()
        }])
        setExecutionStatus('idle')
    }

    const renderMessage = (message) => {
        const isUser = message.type === 'user'
        const isSystem = message.type === 'system'
        const isError = message.type === 'error'

        return (
            <Box
                key={message.id}
                sx={{
                    display: 'flex',
                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                    mb: 2
                }}
            >
                <Paper
                    sx={{
                        p: 2,
                        maxWidth: '70%',
                        backgroundColor: isUser
                            ? theme.palette.primary.main
                            : isError
                            ? theme.palette.error.light
                            : isSystem
                            ? theme.palette.info.light
                            : theme.palette.background.paper,
                        color: isUser ? theme.palette.primary.contrastText : 'inherit'
                    }}
                >
                    <Typography variant='body1' sx={{ whiteSpace: 'pre-wrap' }}>
                        {message.content}
                    </Typography>
                    
                    {message.data && (
                        <Box sx={{ mt: 1 }}>
                            <Divider sx={{ my: 1 }} />
                            <Typography variant='caption' color='text.secondary'>
                                Data:
                            </Typography>
                            <Box
                                component='pre'
                                sx={{
                                    mt: 1,
                                    p: 1,
                                    backgroundColor: theme.palette.action.hover,
                                    borderRadius: 1,
                                    fontSize: '0.8rem',
                                    overflow: 'auto'
                                }}
                            >
                                {JSON.stringify(message.data, null, 2)}
                            </Box>
                        </Box>
                    )}
                    
                    {message.logs && message.logs.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                            <Divider sx={{ my: 1 }} />
                            <Typography variant='caption' color='text.secondary'>
                                Logs:
                            </Typography>
                            <Box
                                component='pre'
                                sx={{
                                    mt: 1,
                                    p: 1,
                                    backgroundColor: theme.palette.action.hover,
                                    borderRadius: 1,
                                    fontSize: '0.8rem',
                                    overflow: 'auto'
                                }}
                            >
                                {message.logs.join('\n')}
                            </Box>
                        </Box>
                    )}

                    {message.stderr && (
                        <Box sx={{ mt: 1 }}>
                            <Divider sx={{ my: 1 }} />
                            <Typography variant='caption' color='error.main'>
                                Error (stderr):
                            </Typography>
                            <Box
                                component='pre'
                                sx={{
                                    mt: 1,
                                    p: 1,
                                    backgroundColor: theme.palette.error.lighter || theme.palette.action.hover,
                                    borderRadius: 1,
                                    fontSize: '0.8rem',
                                    overflow: 'auto',
                                    color: theme.palette.error.dark
                                }}
                            >
                                {message.stderr}
                            </Box>
                        </Box>
                    )}
                    
                    <Typography variant='caption' color='text.secondary' sx={{ mt: 1, display: 'block' }}>
                        {new Date(message.timestamp).toLocaleTimeString()}
                    </Typography>
                </Paper>
            </Box>
        )
    }

    if (isLoading) {
        return <BackdropLoader open={isLoading} />
    }

    return (
        <MainCard>
            <Stack flexDirection='column' sx={{ height: '80vh' }}>
                <ViewHeader
                    title={codeAgent?.name || 'CodeAgent Execution'}
                    description={codeAgent?.description || 'Execute and interact with your CodeAgent'}
                    onBack={() => navigate('/codeagent')}
                >
                    <Stack direction='row' spacing={1}>
                        <Tooltip title='Use preselected root JSON datasets (v2) on first turn'>
                            <FormControlLabel
                                control={<Switch checked={autoloadOn} onChange={(e) => setAutoloadOn(e.target.checked)} />}
                                label='Autoload selected docs'
                            />
                        </Tooltip>
                        <Chip
                            label={codeAgent?.language || 'JavaScript'}
                            color='primary'
                            variant='outlined'
                            size='small'
                        />
                        <Chip
                            label={executionStatus}
                            color={
                                executionStatus === 'success'
                                    ? 'success'
                                    : executionStatus === 'error'
                                    ? 'error'
                                    : executionStatus === 'running'
                                    ? 'warning'
                                    : 'default'
                            }
                            size='small'
                        />
                        <Button
                            size='small'
                            startIcon={<IconRefresh />}
                            onClick={clearChat}
                        >
                            Clear Chat
                        </Button>
                    </Stack>
                </ViewHeader>
                
                {/* Chat Messages */}
                <Box
                    sx={{
                        flexGrow: 1,
                        overflow: 'auto',
                        p: 2,
                        backgroundColor: theme.palette.background.default,
                        borderRadius: 1,
                        mb: 2
                    }}
                >
                    {messages.map(renderMessage)}
                    {isExecuting && (
                        <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
                            <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CircularProgress size={16} />
                                <Typography variant='body2' color='text.secondary'>
                                    Executing code...
                                </Typography>
                            </Paper>
                        </Box>
                    )}
                    <div ref={messagesEndRef} />
                </Box>
                
                {/* Input Area */}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                    <TextField
                        fullWidth
                        multiline
                        maxRows={4}
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder='Type your message here...'
                        disabled={isExecuting}
                        variant='outlined'
                    />
                    <IconButton
                        color='primary'
                        onClick={handleSendMessage}
                        disabled={!inputMessage.trim() || isExecuting}
                        sx={{ mb: 0.5 }}
                    >
                        <IconSend />
                    </IconButton>
                </Box>
            </Stack>
        </MainCard>
    )
}

export default CodeAgentExecution
