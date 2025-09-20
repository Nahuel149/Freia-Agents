import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
    IconButton,
    Tooltip,
    Chip,
    TextField,
    Tab,
    Tabs,
    Alert,
    LinearProgress,
    Avatar,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    ListItemSecondaryAction,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Breadcrumbs,
    Link
} from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@/ErrorBoundary'
import { BackdropLoader } from '@/ui-component/loading/BackdropLoader'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs'

// API
import codeAgentOrchestrationApi from '@/api/codeAgentOrchestration'

// Hooks
import useApi from '@/hooks/useApi'
import useNotifier from '@/utils/useNotifier'

// store
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'

// icons
import {
    IconArrowLeft,
    IconCode,
    IconDownload,
    IconCopy,
    IconCheck,
    IconX,
    IconClock,
    IconBrain,
    IconBug,
    IconRefresh,
    IconSend,
    IconChevronDown,
    IconFileText,
    IconAlertCircle,
    IconCheckCircle,
    IconPlay,
    IconPlayerPause,
    IconSettings,
    IconAnalyze,
    IconBulb
} from '@tabler/icons-react'

// ==============================|| CODEAGENT SESSION VIEW ||============================== //

const CodeAgentSessionView = () => {
    const theme = useTheme()
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { sessionId } = useParams()
    const { t } = useTranslation()

    useNotifier()
    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    // State management
    const [activeTab, setActiveTab] = useState(0)
    const [session, setSession] = useState(null)
    const [tasks, setTasks] = useState([])
    const [followUps, setFollowUps] = useState([])
    const [analysisResults, setAnalysisResults] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [showFollowUpDialog, setShowFollowUpDialog] = useState(false)
    const [followUpMessage, setFollowUpMessage] = useState('')
    const [isProcessingFollowUp, setIsProcessingFollowUp] = useState(false)
    const [copiedCode, setCopiedCode] = useState(null)

    // API hooks
    const getSessionApi = useApi(codeAgentOrchestrationApi.getSession)
    const getSessionTasksApi = useApi(codeAgentOrchestrationApi.getSessionTasks)
    const getSessionFollowUpsApi = useApi(codeAgentOrchestrationApi.getSessionFollowUps)
    const getCodeAnalysisApi = useApi(codeAgentOrchestrationApi.getCodeAnalysis)
    const scheduleFollowUpApi = useApi(codeAgentOrchestrationApi.scheduleFollowUp)
    const processFollowUpApi = useApi(codeAgentOrchestrationApi.processFollowUp)

    // Load session data
    useEffect(() => {
        if (sessionId) {
            loadSessionData()
        }
    }, [sessionId])

    const loadSessionData = async () => {
        try {
            setIsLoading(true)
            await Promise.all([
                loadSession(),
                loadSessionTasks(),
                loadSessionFollowUps(),
                loadCodeAnalysis()
            ])
        } catch (error) {
            console.error('Error loading session data:', error)
            enqueueSnackbar({
                message: 'Failed to load session data',
                options: {
                    variant: 'error'
                }
            })
        } finally {
            setIsLoading(false)
        }
    }

    const loadSession = async () => {
        try {
            const response = await getSessionApi.request(sessionId)
            setSession(response.data)
        } catch (error) {
            console.error('Error loading session:', error)
        }
    }

    const loadSessionTasks = async () => {
        try {
            const response = await getSessionTasksApi.request(sessionId)
            setTasks(response.data || [])
        } catch (error) {
            console.error('Error loading session tasks:', error)
        }
    }

    const loadSessionFollowUps = async () => {
        try {
            const response = await getSessionFollowUpsApi.request(sessionId)
            setFollowUps(response.data || [])
        } catch (error) {
            console.error('Error loading session follow-ups:', error)
        }
    }

    const loadCodeAnalysis = async () => {
        try {
            const response = await getCodeAnalysisApi.request(sessionId)
            setAnalysisResults(response.data || [])
        } catch (error) {
            console.error('Error loading code analysis:', error)
        }
    }

    // Handlers
    const handleCopyCode = async (code, taskId) => {
        try {
            await navigator.clipboard.writeText(code)
            setCopiedCode(taskId)
            setTimeout(() => setCopiedCode(null), 2000)
            enqueueSnackbar({
                message: 'Code copied to clipboard',
                options: {
                    variant: 'success'
                }
            })
        } catch (error) {
            console.error('Error copying code:', error)
            enqueueSnackbar({
                message: 'Failed to copy code',
                options: {
                    variant: 'error'
                }
            })
        }
    }

    const handleDownloadCode = (code, filename) => {
        const blob = new Blob([code], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename || 'generated_code.txt'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const handleScheduleFollowUp = async () => {
        if (!followUpMessage.trim()) {
            enqueueSnackbar({
                message: 'Please enter a follow-up message',
                options: {
                    variant: 'warning'
                }
            })
            return
        }

        setIsProcessingFollowUp(true)
        try {
            await scheduleFollowUpApi.request({
                sessionId,
                message: followUpMessage,
                type: 'user_request',
                priority: 'medium'
            })

            enqueueSnackbar({
                message: 'Follow-up scheduled successfully',
                options: {
                    variant: 'success'
                }
            })

            setFollowUpMessage('')
            setShowFollowUpDialog(false)
            loadSessionFollowUps()
        } catch (error) {
            console.error('Error scheduling follow-up:', error)
            enqueueSnackbar({
                message: 'Failed to schedule follow-up',
                options: {
                    variant: 'error'
                }
            })
        } finally {
            setIsProcessingFollowUp(false)
        }
    }

    const handleProcessFollowUp = async (followUpId) => {
        try {
            await processFollowUpApi.request(followUpId)
            enqueueSnackbar({
                message: 'Follow-up processed successfully',
                options: {
                    variant: 'success'
                }
            })
            loadSessionFollowUps()
            loadSessionTasks()
        } catch (error) {
            console.error('Error processing follow-up:', error)
            enqueueSnackbar({
                message: 'Failed to process follow-up',
                options: {
                    variant: 'error'
                }
            })
        }
    }

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue)
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed':
                return 'success'
            case 'active':
            case 'in_progress':
                return 'primary'
            case 'failed':
            case 'error':
                return 'error'
            case 'pending':
                return 'warning'
            default:
                return 'default'
        }
    }

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed':
                return <IconCheckCircle size={16} />
            case 'active':
            case 'in_progress':
                return <IconClock size={16} />
            case 'failed':
            case 'error':
                return <IconAlertCircle size={16} />
            case 'pending':
                return <IconPlayerPause size={16} />
            default:
                return <IconClock size={16} />
        }
    }

    // Render session header
    const renderSessionHeader = () => (
        <Box sx={{ mb: 3 }}>
            <Breadcrumbs sx={{ mb: 2 }}>
                <Link
                    component="button"
                    variant="body1"
                    onClick={() => navigate('/codeagent')}
                    sx={{ textDecoration: 'none' }}
                >
                    CodeAgent
                </Link>
                <Typography color="text.primary">
                    Session {sessionId}
                </Typography>
            </Breadcrumbs>
            
            <Card>
                <CardContent>
                    <Stack spacing={2}>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Box display="flex" alignItems="center" gap={2}>
                                <IconBrain size={24} color={theme.palette.primary.main} />
                                <Typography variant="h5">
                                    {session?.context?.description || `Session ${sessionId}`}
                                </Typography>
                            </Box>
                            <Chip
                                icon={getStatusIcon(session?.status)}
                                label={session?.status || 'Unknown'}
                                color={getStatusColor(session?.status)}
                            />
                        </Box>
                        
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6} md={3}>
                                <Typography variant="body2" color="text.secondary">
                                    Language
                                </Typography>
                                <Typography variant="body1">
                                    {session?.language || 'N/A'}
                                </Typography>
                            </Grid>
                            
                            <Grid item xs={12} sm={6} md={3}>
                                <Typography variant="body2" color="text.secondary">
                                    Framework
                                </Typography>
                                <Typography variant="body1">
                                    {session?.framework || 'None'}
                                </Typography>
                            </Grid>
                            
                            <Grid item xs={12} sm={6} md={3}>
                                <Typography variant="body2" color="text.secondary">
                                    Created
                                </Typography>
                                <Typography variant="body1">
                                    {session?.created_at ? new Date(session.created_at).toLocaleString() : 'N/A'}
                                </Typography>
                            </Grid>
                            
                            <Grid item xs={12} sm={6} md={3}>
                                <Typography variant="body2" color="text.secondary">
                                    Tasks
                                </Typography>
                                <Typography variant="body1">
                                    {tasks.length} tasks
                                </Typography>
                            </Grid>
                        </Grid>
                        
                        {session?.context?.prompt && (
                            <Box>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    Original Prompt
                                </Typography>
                                <Paper sx={{ p: 2, bgcolor: theme.palette.grey[50] }}>
                                    <Typography variant="body2">
                                        {session.context.prompt}
                                    </Typography>
                                </Paper>
                            </Box>
                        )}
                    </Stack>
                </CardContent>
            </Card>
        </Box>
    )

    // Render tasks tab
    const renderTasksTab = () => (
        <Stack spacing={3}>
            {tasks.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <IconCode size={48} color={theme.palette.text.secondary} />
                    <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                        No Tasks Found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        This session doesn't have any tasks yet.
                    </Typography>
                </Paper>
            ) : (
                tasks.map((task, index) => (
                    <Card key={task.id}>
                        <CardContent>
                            <Stack spacing={2}>
                                <Box display="flex" alignItems="center" justifyContent="space-between">
                                    <Box display="flex" alignItems="center" gap={2}>
                                        <Typography variant="h6">
                                            Task {index + 1}: {task.agent_type}
                                        </Typography>
                                        <Chip
                                            icon={getStatusIcon(task.status)}
                                            label={task.status}
                                            size="small"
                                            color={getStatusColor(task.status)}
                                        />
                                    </Box>
                                    <Typography variant="caption" color="text.secondary">
                                        {new Date(task.created_at).toLocaleString()}
                                    </Typography>
                                </Box>
                                
                                {task.input_data && (
                                    <Box>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                            Input
                                        </Typography>
                                        <Paper sx={{ p: 2, bgcolor: theme.palette.grey[50] }}>
                                            <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                                                {typeof task.input_data === 'string' ? task.input_data : JSON.stringify(task.input_data, null, 2)}
                                            </Typography>
                                        </Paper>
                                    </Box>
                                )}
                                
                                {task.output_data && (
                                    <Box>
                                        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                Generated Code
                                            </Typography>
                                            <Stack direction="row" spacing={1}>
                                                <Tooltip title="Copy Code">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleCopyCode(task.output_data.code || task.output_data, task.id)}
                                                    >
                                                        {copiedCode === task.id ? <IconCheck size={16} /> : <IconCopy size={16} />}
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Download Code">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleDownloadCode(
                                                            task.output_data.code || task.output_data,
                                                            `task_${index + 1}_${task.agent_type}.${session?.language === 'python' ? 'py' : 'js'}`
                                                        )}
                                                    >
                                                        <IconDownload size={16} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </Box>
                                        <SyntaxHighlighter
                                            language={session?.language || 'javascript'}
                                            style={docco}
                                            customStyle={{
                                                borderRadius: theme.shape.borderRadius,
                                                fontSize: '0.875rem'
                                            }}
                                        >
                                            {task.output_data.code || task.output_data}
                                        </SyntaxHighlighter>
                                    </Box>
                                )}
                                
                                {task.error_message && (
                                    <Alert severity="error">
                                        <Typography variant="body2">
                                            {task.error_message}
                                        </Typography>
                                    </Alert>
                                )}
                            </Stack>
                        </CardContent>
                    </Card>
                ))
            )}
        </Stack>
    )

    // Render follow-ups tab
    const renderFollowUpsTab = () => (
        <Stack spacing={3}>
            <Box display="flex" justifyContent="flex-end">
                <Button
                    variant="contained"
                    startIcon={<IconSend />}
                    onClick={() => setShowFollowUpDialog(true)}
                >
                    Request Follow-up
                </Button>
            </Box>
            
            {followUps.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <IconBulb size={48} color={theme.palette.text.secondary} />
                    <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                        No Follow-ups Yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Request improvements, bug fixes, or additional features.
                    </Typography>
                </Paper>
            ) : (
                followUps.map((followUp) => (
                    <Card key={followUp.id}>
                        <CardContent>
                            <Stack spacing={2}>
                                <Box display="flex" alignItems="center" justifyContent="space-between">
                                    <Box display="flex" alignItems="center" gap={2}>
                                        <Typography variant="h6">
                                            {followUp.type.replace('_', ' ').toUpperCase()}
                                        </Typography>
                                        <Chip
                                            label={followUp.status}
                                            size="small"
                                            color={getStatusColor(followUp.status)}
                                        />
                                        <Chip
                                            label={followUp.priority}
                                            size="small"
                                            variant="outlined"
                                        />
                                    </Box>
                                    {followUp.status === 'pending' && (
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<IconPlay />}
                                            onClick={() => handleProcessFollowUp(followUp.id)}
                                        >
                                            Process
                                        </Button>
                                    )}
                                </Box>
                                
                                <Typography variant="body2">
                                    {followUp.message}
                                </Typography>
                                
                                <Typography variant="caption" color="text.secondary">
                                    Scheduled: {new Date(followUp.scheduled_for).toLocaleString()}
                                </Typography>
                                
                                {followUp.result && (
                                    <Box>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                            Result
                                        </Typography>
                                        <Paper sx={{ p: 2, bgcolor: theme.palette.grey[50] }}>
                                            <Typography variant="body2">
                                                {followUp.result}
                                            </Typography>
                                        </Paper>
                                    </Box>
                                )}
                            </Stack>
                        </CardContent>
                    </Card>
                ))
            )}
        </Stack>
    )

    // Render analysis tab
    const renderAnalysisTab = () => (
        <Stack spacing={3}>
            {analysisResults.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <IconAnalyze size={48} color={theme.palette.text.secondary} />
                    <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                        No Analysis Available
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Code analysis will appear here once available.
                    </Typography>
                </Paper>
            ) : (
                analysisResults.map((analysis) => (
                    <Card key={analysis.id}>
                        <CardContent>
                            <Stack spacing={2}>
                                <Box display="flex" alignItems="center" justifyContent="space-between">
                                    <Typography variant="h6">
                                        Code Analysis
                                    </Typography>
                                    <Chip
                                        label={`Score: ${analysis.overall_score}%`}
                                        color={analysis.overall_score >= 80 ? 'success' : analysis.overall_score >= 60 ? 'warning' : 'error'}
                                    />
                                </Box>
                                
                                {analysis.suggestions && analysis.suggestions.length > 0 && (
                                    <Box>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                            Suggestions
                                        </Typography>
                                        <List>
                                            {analysis.suggestions.map((suggestion, index) => (
                                                <ListItem key={index}>
                                                    <ListItemIcon>
                                                        <IconBulb size={16} />
                                                    </ListItemIcon>
                                                    <ListItemText primary={suggestion} />
                                                </ListItem>
                                            ))}
                                        </List>
                                    </Box>
                                )}
                                
                                {analysis.metrics && (
                                    <Box>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                            Metrics
                                        </Typography>
                                        <Grid container spacing={2}>
                                            {Object.entries(analysis.metrics).map(([key, value]) => (
                                                <Grid item xs={6} sm={4} md={3} key={key}>
                                                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                                                        <Typography variant="h6">{value}</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {key.replace('_', ' ').toUpperCase()}
                                                        </Typography>
                                                    </Paper>
                                                </Grid>
                                            ))}
                                        </Grid>
                                    </Box>
                                )}
                            </Stack>
                        </CardContent>
                    </Card>
                ))
            )}
        </Stack>
    )

    if (isLoading) {
        return <BackdropLoader open={isLoading} />
    }

    if (!session) {
        return (
            <MainCard>
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <IconAlertCircle size={48} color={theme.palette.error.main} />
                    <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                        Session Not Found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        The requested session could not be found.
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<IconArrowLeft />}
                        onClick={() => navigate('/codeagent')}
                    >
                        Back to CodeAgent
                    </Button>
                </Box>
            </MainCard>
        )
    }

    return (
        <>
            <MainCard>
                <Stack spacing={3}>
                    {renderSessionHeader()}
                    
                    {/* Tabs */}
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs value={activeTab} onChange={handleTabChange}>
                            <Tab label="Tasks" icon={<IconCode />} />
                            <Tab label="Follow-ups" icon={<IconBulb />} />
                            <Tab label="Analysis" icon={<IconAnalyze />} />
                        </Tabs>
                    </Box>
                    
                    {/* Tab Content */}
                    <Box sx={{ mt: 3 }}>
                        {activeTab === 0 && renderTasksTab()}
                        {activeTab === 1 && renderFollowUpsTab()}
                        {activeTab === 2 && renderAnalysisTab()}
                    </Box>
                </Stack>
            </MainCard>
            
            {/* Follow-up Dialog */}
            <Dialog
                open={showFollowUpDialog}
                onClose={() => setShowFollowUpDialog(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Request Follow-up</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Describe what you need"
                        placeholder="e.g., Add error handling, optimize performance, fix a bug, add new feature..."
                        value={followUpMessage}
                        onChange={(e) => setFollowUpMessage(e.target.value)}
                        sx={{ mt: 2 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowFollowUpDialog(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleScheduleFollowUp}
                        disabled={isProcessingFollowUp || !followUpMessage.trim()}
                    >
                        {isProcessingFollowUp ? 'Scheduling...' : 'Schedule Follow-up'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    )
}

export default CodeAgentSessionView