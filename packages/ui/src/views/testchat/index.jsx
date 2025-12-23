import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'

// material-ui
import {
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Fade,
    FormControl,
    IconButton,
    InputAdornment,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Slide,
    Stack,
    TextField,
    Typography,
    alpha
} from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import { BackdropLoader } from '@/ui-component/loading/BackdropLoader'

// API
import codeAgentApi from '@/api/codeAgent'

// hooks
import useApi from '@/hooks/useApi'
import useNotifier from '@/utils/useNotifier'

// store
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'

// icons
import { IconSend, IconRobot, IconUser, IconSparkles, IconClearAll } from '@tabler/icons-react'

// ==============================|| TEST CHAT (CodeAgent) ||============================== //

const TestChat = () => {
    const theme = useTheme()
    const dispatch = useDispatch()
    const { t } = useTranslation()
    const messagesEndRef = useRef(null)

    useNotifier()
    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    // Available AI models
    const availableModels = [
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
        { id: 'gpt-5-mini', name: 'GPT 5 mini', provider: 'OpenAI' }
    ]

    // data + state
    const [codeAgents, setCodeAgents] = useState([])
    const [selectedAgentId, setSelectedAgentId] = useState('')
    const [selectedModel, setSelectedModel] = useState('gpt-4o-mini')
    const selectedAgent = useMemo(() => codeAgents.find((a) => a.id === selectedAgentId) || null, [codeAgents, selectedAgentId])

    const [messages, setMessages] = useState([])
    const [inputMessage, setInputMessage] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isExecuting, setIsExecuting] = useState(false)
    const [executionStatus, setExecutionStatus] = useState('idle') // idle, running, success, error

    // APIs
    const getAllCodeAgentsApi = useApi(codeAgentApi.getAllCodeAgents)
    const executeCodeAgentApi = useApi(codeAgentApi.executeCodeAgent)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const loadAgents = async () => {
        try {
            const response = await getAllCodeAgentsApi.request()
            const list = response?.data || []
            setCodeAgents(list)
            // If none selected, try pick first
            if (!selectedAgentId && list.length > 0) {
                const first = list[0]
                setSelectedAgentId(first.id)
                setMessages([
                    {
                        id: 'welcome',
                        type: 'system',
                        content: `Welcome to ${first.name}! Select or start chatting below.`,
                        timestamp: new Date().toISOString()
                    }
                ])
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error fetching code agents:', error)
            enqueueSnackbar({
                message: 'Failed to fetch CodeAgents',
                options: { key: new Date().getTime() + Math.random(), variant: 'error' }
            })
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadAgents()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const onSelectAgent = (e) => {
        const id = e.target.value
        setSelectedAgentId(id)
        const agent = codeAgents.find((a) => a.id === id)
        setMessages([
            {
                id: 'welcome',
                type: 'system',
                content: `Welcome to ${agent?.name || 'CodeAgent'}! You can now interact with your CodeAgent.`,
                timestamp: new Date().toISOString()
            }
        ])
        setExecutionStatus('idle')
        setInputMessage('')
    }

    const onSelectModel = (event) => {
        setSelectedModel(event.target.value)
    }

    const handleSendMessage = async () => {
        if (!selectedAgentId || !inputMessage.trim() || isExecuting) return

        const userMessage = {
            id: Date.now().toString(),
            type: 'user',
            content: inputMessage,
            timestamp: new Date().toISOString()
        }

        setMessages((prev) => [...prev, userMessage])
        setInputMessage('')
        setIsExecuting(true)
        setExecutionStatus('running')

        try {
            const response = await executeCodeAgentApi.request(selectedAgentId, {
                input: userMessage.content,
                context: {
                    chatHistory: messages,
                    sessionId: `testchat_${Date.now()}`,
                    user: 'current_user'
                },
                model: selectedModel
            })

            // Prefer server-provided message; else parse output JSON { reply }
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

            setMessages((prev) => [...prev, agentMessage])
            setExecutionStatus('success')
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error executing code agent:', error)
            const errorMessage = {
                id: (Date.now() + 1).toString(),
                type: 'error',
                content: error?.response?.data?.message || 'An error occurred while executing the code',
                error: error?.response?.data?.error,
                timestamp: new Date().toISOString()
            }
            setMessages((prev) => [...prev, errorMessage])
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
        setMessages([
            {
                id: 'welcome',
                type: 'system',
                content: `Welcome to ${selectedAgent?.name || 'CodeAgent'}! You can now interact with your CodeAgent.`,
                timestamp: new Date().toISOString()
            }
        ])
        setExecutionStatus('idle')
    }

    const renderMessage = (message) => {
        const isUser = message.type === 'user'
        const isSystem = message.type === 'system'
        const isError = message.type === 'error'
        const isAgent = message.type === 'agent'

        return (
            <Fade in={true} timeout={300} key={message.id}>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: isUser ? 'flex-end' : 'flex-start',
                        mb: 1.5,
                        alignItems: 'flex-start',
                        gap: 1
                    }}
                >
                    {!isUser && (
                        <Avatar
                            sx={{
                                width: 32,
                                height: 32,
                                bgcolor: isSystem
                                    ? theme.palette.info.main
                                    : isError
                                    ? theme.palette.error.main
                                    : theme.palette.secondary.main,
                                mt: 0.5
                            }}
                        >
                            {isSystem ? <IconSparkles size={18} /> : isError ? '!' : <IconRobot size={18} />}
                        </Avatar>
                    )}

                    <Box sx={{ maxWidth: '75%', minWidth: '200px' }}>
                        <Paper
                            elevation={isUser ? 8 : 2}
                            sx={{
                                p: 1.5,
                                borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                                background: isUser
                                    ? `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`
                                    : isError
                                    ? `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.1)} 0%, ${alpha(
                                          theme.palette.error.main,
                                          0.05
                                      )} 100%)`
                                    : isSystem
                                    ? `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(
                                          theme.palette.info.main,
                                          0.05
                                      )} 100%)`
                                    : theme.palette.background.paper,
                                color: isUser ? theme.palette.primary.contrastText : 'inherit',
                                border: isUser ? 'none' : `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                boxShadow: isUser
                                    ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.3)}`
                                    : `0 2px 12px ${alpha(theme.palette.common.black, 0.08)}`,
                                position: 'relative',
                                '&::before': isUser
                                    ? {}
                                    : {
                                          content: '""',
                                          position: 'absolute',
                                          top: 12,
                                          left: -6,
                                          width: 12,
                                          height: 12,
                                          background: 'inherit',
                                          border: 'inherit',
                                          borderRight: 'none',
                                          borderBottom: 'none',
                                          transform: 'rotate(45deg)',
                                          borderRadius: '2px 0 0 0'
                                      },
                                '&::after': isUser
                                    ? {
                                          content: '""',
                                          position: 'absolute',
                                          top: 12,
                                          right: -6,
                                          width: 12,
                                          height: 12,
                                          background: 'inherit',
                                          transform: 'rotate(45deg)',
                                          borderRadius: '0 2px 0 0'
                                      }
                                    : {}
                            }}
                        >
                            <Typography
                                variant='body1'
                                sx={{
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: 1.6,
                                    fontSize: '0.95rem'
                                }}
                            >
                                {message.content}
                            </Typography>

                            {message.data && (
                                <Card sx={{ mt: 2, bgcolor: alpha(theme.palette.background.default, 0.7) }}>
                                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600 }}>
                                            📊 Data Output
                                        </Typography>
                                        <Box
                                            component='pre'
                                            sx={{
                                                mt: 1,
                                                p: 1.5,
                                                backgroundColor: theme.palette.background.default,
                                                borderRadius: 2,
                                                fontSize: '0.8rem',
                                                overflow: 'auto',
                                                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                                            }}
                                        >
                                            {JSON.stringify(message.data, null, 2)}
                                        </Box>
                                    </CardContent>
                                </Card>
                            )}

                            {message.logs && message.logs.length > 0 && (
                                <Card sx={{ mt: 2, bgcolor: alpha(theme.palette.info.main, 0.05) }}>
                                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        <Typography variant='caption' color='info.main' sx={{ fontWeight: 600 }}>
                                            📝 Execution Logs
                                        </Typography>
                                        <Box
                                            component='pre'
                                            sx={{
                                                mt: 1,
                                                p: 1.5,
                                                backgroundColor: alpha(theme.palette.info.main, 0.02),
                                                borderRadius: 2,
                                                fontSize: '0.8rem',
                                                overflow: 'auto',
                                                border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`
                                            }}
                                        >
                                            {message.logs.join('\n')}
                                        </Box>
                                    </CardContent>
                                </Card>
                            )}

                            {message.stderr && (
                                <Card sx={{ mt: 2, bgcolor: alpha(theme.palette.error.main, 0.05) }}>
                                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        <Typography variant='caption' color='error.main' sx={{ fontWeight: 600 }}>
                                            ⚠️ Error Details
                                        </Typography>
                                        <Box
                                            component='pre'
                                            sx={{
                                                mt: 1,
                                                p: 1.5,
                                                backgroundColor: alpha(theme.palette.error.main, 0.02),
                                                borderRadius: 2,
                                                fontSize: '0.8rem',
                                                overflow: 'auto',
                                                color: theme.palette.error.dark,
                                                border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`
                                            }}
                                        >
                                            {message.stderr}
                                        </Box>
                                    </CardContent>
                                </Card>
                            )}

                            <Typography
                                variant='caption'
                                color={isUser ? alpha(theme.palette.primary.contrastText, 0.7) : 'text.secondary'}
                                sx={{
                                    mt: 1.5,
                                    display: 'block',
                                    textAlign: isUser ? 'right' : 'left',
                                    fontSize: '0.75rem'
                                }}
                            >
                                {new Date(message.timestamp).toLocaleTimeString()}
                            </Typography>
                        </Paper>
                    </Box>

                    {isUser && (
                        <Avatar
                            sx={{
                                width: 32,
                                height: 32,
                                bgcolor: theme.palette.primary.main,
                                mt: 0.5
                            }}
                        >
                            <IconUser size={18} />
                        </Avatar>
                    )}
                </Box>
            </Fade>
        )
    }

    if (isLoading) return <BackdropLoader open={isLoading} />

    return (
        <Box
            sx={{
                height: 'calc(100vh - 64px)',
                display: 'flex',
                flexDirection: 'column',
                bgcolor: theme.palette.background.default,
                maxHeight: 'calc(100vh - 64px)',
                overflow: 'hidden'
            }}
        >
            {/* Modern Header */}
            <Paper
                elevation={0}
                sx={{
                    p: 1,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(
                        theme.palette.secondary.main,
                        0.02
                    )} 100%)`,
                    backdropFilter: 'blur(10px)',
                    flexShrink: 0
                }}
            >
                <Stack direction='row' alignItems='center' justifyContent='space-between' mb={1}>
                    <Box>
                        <Typography variant='h5' sx={{ fontWeight: 700, color: theme.palette.text.primary, mb: 0.25 }}>
                            🤖 Test Chat
                        </Typography>
                        <Typography variant='body2' color='text.secondary'>
                            Interactive testing environment for your CodeAgents
                        </Typography>
                    </Box>

                    <Stack direction='row' spacing={1} alignItems='center'>
                        <Chip
                            label={`🤖 ${availableModels.find((m) => m.id === selectedModel)?.name || 'No Model'}`}
                            color='secondary'
                            variant='outlined'
                            size='small'
                            sx={{
                                fontWeight: 600,
                                fontSize: '0.75rem'
                            }}
                        />

                        <Chip
                            icon={executionStatus === 'running' ? <CircularProgress size={16} /> : undefined}
                            label={executionStatus === 'idle' ? 'Ready' : executionStatus}
                            color={
                                executionStatus === 'success'
                                    ? 'success'
                                    : executionStatus === 'error'
                                    ? 'error'
                                    : executionStatus === 'running'
                                    ? 'warning'
                                    : 'default'
                            }
                            variant={executionStatus === 'idle' ? 'outlined' : 'filled'}
                            sx={{
                                fontWeight: 600,
                                '& .MuiChip-icon': { ml: 0.5 }
                            }}
                        />

                        <IconButton
                            onClick={clearChat}
                            disabled={!selectedAgentId}
                            sx={{
                                bgcolor: alpha(theme.palette.error.main, 0.1),
                                '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) },
                                '&:disabled': { bgcolor: 'transparent' }
                            }}
                        >
                            <IconClearAll size={20} />
                        </IconButton>
                    </Stack>
                </Stack>

                <Stack direction='row' spacing={1.5} alignItems='center'>
                    <FormControl size='medium' sx={{ minWidth: 300 }}>
                        <InputLabel id='testchat-agent-select-label' sx={{ fontWeight: 600 }}>
                            Select CodeAgent
                        </InputLabel>
                        <Select
                            labelId='testchat-agent-select-label'
                            value={selectedAgentId}
                            label='Select CodeAgent'
                            onChange={onSelectAgent}
                            sx={{
                                borderRadius: 3,
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: alpha(theme.palette.primary.main, 0.2)
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: alpha(theme.palette.primary.main, 0.4)
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderColor: theme.palette.primary.main
                                }
                            }}
                        >
                            {codeAgents.map((agent) => (
                                <MenuItem key={agent.id} value={agent.id} sx={{ py: 1.5 }}>
                                    <Stack direction='row' alignItems='center' spacing={1}>
                                        <Avatar sx={{ width: 24, height: 24, bgcolor: theme.palette.secondary.main }}>
                                            <IconRobot size={14} />
                                        </Avatar>
                                        <Typography variant='body2' sx={{ fontWeight: 500 }}>
                                            {agent.name}
                                        </Typography>
                                    </Stack>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl size='medium' sx={{ minWidth: 200 }}>
                        <InputLabel id='testchat-model-select-label' sx={{ fontWeight: 600 }}>
                            AI Model
                        </InputLabel>
                        <Select
                            labelId='testchat-model-select-label'
                            value={selectedModel}
                            label='AI Model'
                            onChange={onSelectModel}
                            sx={{
                                borderRadius: 3,
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: alpha(theme.palette.secondary.main, 0.2)
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: alpha(theme.palette.secondary.main, 0.4)
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderColor: theme.palette.secondary.main
                                }
                            }}
                        >
                            {availableModels.map((model) => (
                                <MenuItem key={model.id} value={model.id} sx={{ py: 1.5 }}>
                                    <Stack direction='column' spacing={0.25}>
                                        <Typography variant='body2' sx={{ fontWeight: 500 }}>
                                            {model.name}
                                        </Typography>
                                        <Typography variant='caption' color='text.secondary'>
                                            {model.provider}
                                        </Typography>
                                    </Stack>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {selectedAgent && selectedAgent.description && (
                        <Card
                            sx={{
                                flex: 1,
                                bgcolor: alpha(theme.palette.info.main, 0.05),
                                border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`
                            }}
                        >
                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                <Typography variant='body2' color='info.main' sx={{ fontWeight: 500 }}>
                                    💡 {selectedAgent.description}
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Stack>
            </Paper>

            {/* Chat Messages Area */}
            <Box
                sx={{
                    flexGrow: 1,
                    overflow: 'auto',
                    p: 0.5,
                    background: `linear-gradient(180deg, ${alpha(theme.palette.background.default, 0.8)} 0%, ${
                        theme.palette.background.default
                    } 100%)`,
                    position: 'relative',
                    minHeight: 0
                }}
            >
                {!selectedAgentId ? (
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            textAlign: 'center'
                        }}
                    >
                        <Avatar sx={{ width: 48, height: 48, bgcolor: alpha(theme.palette.primary.main, 0.1), mb: 1 }}>
                            <IconRobot size={24} color={theme.palette.primary.main} />
                        </Avatar>
                        <Typography variant='h6' color='text.primary' sx={{ mb: 0.5, fontWeight: 600 }}>
                            Welcome to CodeAgent Test Chat
                        </Typography>
                        <Typography variant='body1' color='text.secondary' sx={{ maxWidth: 400 }}>
                            Select a CodeAgent from the dropdown above to start an interactive conversation and test its capabilities.
                        </Typography>
                    </Box>
                ) : (
                    <>
                        {messages.map(renderMessage)}
                        {isExecuting && (
                            <Slide direction='up' in={isExecuting} timeout={300}>
                                <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1, alignItems: 'flex-start', gap: 1 }}>
                                    <Avatar sx={{ width: 32, height: 32, bgcolor: theme.palette.secondary.main, mt: 0.5 }}>
                                        <IconRobot size={18} />
                                    </Avatar>
                                    <Paper
                                        sx={{
                                            p: 1.5,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 2,
                                            borderRadius: '20px 20px 20px 4px',
                                            background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.1)} 0%, ${alpha(
                                                theme.palette.secondary.main,
                                                0.05
                                            )} 100%)`,
                                            border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`,
                                            position: 'relative',
                                            '&::before': {
                                                content: '""',
                                                position: 'absolute',
                                                top: 12,
                                                left: -6,
                                                width: 12,
                                                height: 12,
                                                background: 'inherit',
                                                border: 'inherit',
                                                borderRight: 'none',
                                                borderBottom: 'none',
                                                transform: 'rotate(45deg)',
                                                borderRadius: '2px 0 0 0'
                                            }
                                        }}
                                    >
                                        <CircularProgress size={20} thickness={4} />
                                        <Typography variant='body2' color='text.secondary' sx={{ fontWeight: 500 }}>
                                            CodeAgent is thinking...
                                        </Typography>
                                    </Paper>
                                </Box>
                            </Slide>
                        )}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </Box>

            {/* Modern Input Area */}
            <Paper
                elevation={8}
                sx={{
                    p: 1,
                    borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    background: theme.palette.background.paper,
                    backdropFilter: 'blur(10px)',
                    flexShrink: 0
                }}
            >
                <Stack direction='row' spacing={1} alignItems='flex-end'>
                    <TextField
                        fullWidth
                        multiline
                        maxRows={4}
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={
                            selectedAgentId
                                ? `💬 Ask your CodeAgent anything... (using ${availableModels.find((m) => m.id === selectedModel)?.name})`
                                : '👆 Select a CodeAgent first to start chatting'
                        }
                        disabled={isExecuting || !selectedAgentId}
                        variant='outlined'
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 4,
                                bgcolor: alpha(theme.palette.background.default, 0.5),
                                '& fieldset': {
                                    borderColor: alpha(theme.palette.divider, 0.2)
                                },
                                '&:hover fieldset': {
                                    borderColor: alpha(theme.palette.primary.main, 0.3)
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: theme.palette.primary.main,
                                    borderWidth: 2
                                }
                            },
                            '& .MuiInputBase-input': {
                                fontSize: '1rem',
                                lineHeight: 1.5
                            }
                        }}
                        InputProps={{
                            endAdornment: inputMessage.trim() && (
                                <InputAdornment position='end'>
                                    <Typography variant='caption' color='text.secondary' sx={{ fontSize: '0.7rem' }}>
                                        Press Enter to send
                                    </Typography>
                                </InputAdornment>
                            )
                        }}
                    />
                    <Button
                        color='primary'
                        variant='contained'
                        onClick={handleSendMessage}
                        disabled={!inputMessage.trim() || isExecuting || !selectedAgentId}
                        sx={{
                            minWidth: 90,
                            height: 42,
                            borderRadius: 4,
                            fontWeight: 600,
                            fontSize: '1rem',
                            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                            boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
                            '&:hover': {
                                background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                                boxShadow: `0 6px 25px ${alpha(theme.palette.primary.main, 0.4)}`,
                                transform: 'translateY(-1px)'
                            },
                            '&:disabled': {
                                background: alpha(theme.palette.action.disabled, 0.1),
                                boxShadow: 'none'
                            },
                            transition: 'all 0.2s ease-in-out'
                        }}
                        startIcon={<IconSend size={20} />}
                    >
                        Send
                    </Button>
                </Stack>
            </Paper>
        </Box>
    )
}

export default TestChat
