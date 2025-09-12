import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
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
    Fab,
    IconButton,
    Tooltip,
    Chip,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Tab,
    Tabs,
    Alert,
    LinearProgress,
    Avatar,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    ListItemSecondaryAction
} from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@/ErrorBoundary'
import { BackdropLoader } from '@/ui-component/loading/BackdropLoader'
import CodeAgentDialog from './CodeAgentDialog'

// API
import codeAgentApi from '@/api/codeAgent'
import codeAgentOrchestrationApi from '@/api/codeAgentOrchestration'

// Hooks
import useApi from '@/hooks/useApi'
import useNotifier from '@/utils/useNotifier'

// store
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'

// icons
import {
    IconCode,
    IconPlus,
    IconEdit,
    IconTrash,
    IconPlayerPlay,
    IconRocket,
    IconBrain,
    IconHistory,
    IconChartBar,
    IconSettings,
    IconBulb,
    IconClock,
    IconCheck,
    IconX,
    IconRefresh,
    IconSend,
    IconRobot
} from '@tabler/icons-react'

// ==============================|| CODEAGENT ORCHESTRATED ||============================== //

const CodeAgentOrchestrated = ({ selectedDocuments }) => {
    const theme = useTheme()
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { t } = useTranslation()

    useNotifier()
    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    // State management
    const [activeTab, setActiveTab] = useState(0)
    const [showDialog, setShowDialog] = useState(false)
    const [dialogProps, setDialogProps] = useState({})
    const [codeAgents, setCodeAgents] = useState([])
    const [sessions, setSessions] = useState([])
    const [followUps, setFollowUps] = useState([])
    const [analytics, setAnalytics] = useState(null)
    const [systemMetrics, setSystemMetrics] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    
    // Orchestration state
    const [orchestrationPrompt, setOrchestrationPrompt] = useState('')
    const [selectedLanguage, setSelectedLanguage] = useState('javascript')
    const [selectedComplexity, setSelectedComplexity] = useState('medium')
    const [selectedFramework, setSelectedFramework] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [generationProgress, setGenerationProgress] = useState(0)
    const [currentSession, setCurrentSession] = useState(null)

    // API hooks
    const getAllCodeAgentsApi = useApi(codeAgentApi.getAllCodeAgents)
    const deleteCodeAgentApi = useApi(codeAgentApi.deleteCodeAgent)
    const generateCodeApi = useApi(codeAgentOrchestrationApi.generateCodeWithOrchestration)
    const getUserSessionsApi = useApi(codeAgentOrchestrationApi.getUserSessions)
    const getSystemMetricsApi = useApi(codeAgentOrchestrationApi.getSystemMetrics)
    const getUserAnalyticsApi = useApi(codeAgentOrchestrationApi.getUserAnalytics)

    // Load initial data
    useEffect(() => {
        loadInitialData()
    }, [])

    const loadInitialData = async () => {
        try {
            setIsLoading(true)
            await Promise.all([
                getAllCodeAgents(),
                loadUserSessions(),
                loadSystemMetrics(),
                loadUserAnalytics()
            ])
        } catch (error) {
            console.error('Error loading initial data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const getAllCodeAgents = async () => {
        try {
            const response = await getAllCodeAgentsApi.request()
            setCodeAgents(response.data || [])
        } catch (error) {
            console.error('Error fetching code agents:', error)
            enqueueSnackbar({
                message: 'Failed to fetch code agents',
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error'
                }
            })
        }
    }

    const loadUserSessions = async () => {
        try {
            const userId = 'current_user' // Replace with actual user ID
            const response = await getUserSessionsApi.request(userId)
            setSessions(response.data || [])
        } catch (error) {
            console.error('Error loading user sessions:', error)
        }
    }

    const loadSystemMetrics = async () => {
        try {
            const response = await getSystemMetricsApi.request()
            setSystemMetrics(response.data || {})
        } catch (error) {
            console.error('Error loading system metrics:', error)
        }
    }

    const loadUserAnalytics = async () => {
        try {
            const userId = 'current_user' // Replace with actual user ID
            const response = await getUserAnalyticsApi.request(userId)
            setAnalytics(response.data || {})
        } catch (error) {
            console.error('Error loading user analytics:', error)
        }
    }

    // Orchestration handlers
    const handleGenerateCode = async () => {
        if (!orchestrationPrompt.trim()) {
            enqueueSnackbar({
                message: 'Please enter a code generation prompt',
                options: {
                    variant: 'warning'
                }
            })
            return
        }

        setIsGenerating(true)
        setGenerationProgress(0)

        // Simulate progress updates
        const progressInterval = setInterval(() => {
            setGenerationProgress(prev => {
                if (prev >= 90) {
                    clearInterval(progressInterval)
                    return 90
                }
                return prev + 10
            })
        }, 500)

        try {
            let response;
            
            // Use document-enhanced processing if documents are selected
             if (selectedDocuments) {
                 response = await codeAgentApi.processWithDocuments({
                    prompt: orchestrationPrompt,
                    language: selectedLanguage,
                    framework: selectedFramework || undefined,
                    complexity: selectedComplexity,
                    documentStoreId: selectedDocuments.storeId,
                    loaderIds: selectedDocuments.loaderIds,
                    query: selectedDocuments.query,
                    context: {
                        timestamp: new Date().toISOString(),
                        source: 'orchestrated_ui_with_documents'
                    }
                })
            } else {
                response = await generateCodeApi.request({
                    userId: 'current_user', // Replace with actual user ID
                    prompt: orchestrationPrompt,
                    language: selectedLanguage,
                    framework: selectedFramework || undefined,
                    complexity: selectedComplexity,
                    context: {
                        timestamp: new Date().toISOString(),
                        source: 'orchestrated_ui'
                    }
                })
            }

            clearInterval(progressInterval)
            setGenerationProgress(100)

            // Navigate to the session view
            if (response.data.sessionId) {
                setCurrentSession(response.data)
                navigate(`/codeagent/session/${response.data.sessionId}`)
            }

            enqueueSnackbar({
                message: 'Code generated successfully!',
                options: {
                    variant: 'success'
                }
            })

            // Reset form
            setOrchestrationPrompt('')
            setSelectedFramework('')
            
            // Reload data
            loadUserSessions()
            loadUserAnalytics()

        } catch (error) {
            clearInterval(progressInterval)
            console.error('Error generating code:', error)
            enqueueSnackbar({
                message: error.response?.data?.message || 'Failed to generate code',
                options: {
                    variant: 'error'
                }
            })
        } finally {
            setIsGenerating(false)
            setGenerationProgress(0)
        }
    }

    // Traditional CodeAgent handlers
    const handleCreateNew = () => {
        setDialogProps({
            title: 'Create New CodeAgent',
            type: 'ADD',
            data: {}
        })
        setShowDialog(true)
    }

    const handleEdit = (codeAgent) => {
        setDialogProps({
            title: 'Edit CodeAgent',
            type: 'EDIT',
            data: codeAgent
        })
        setShowDialog(true)
    }

    const handleDelete = async (codeAgent) => {
        if (window.confirm(`Are you sure you want to delete "${codeAgent.name}"?`)) {
            try {
                await deleteCodeAgentApi.request(codeAgent.id)
                enqueueSnackbar({
                    message: 'CodeAgent deleted successfully',
                    options: {
                        variant: 'success'
                    }
                })
                getAllCodeAgents()
            } catch (error) {
                console.error('Error deleting code agent:', error)
                enqueueSnackbar({
                    message: 'Failed to delete CodeAgent',
                    options: {
                        variant: 'error'
                    }
                })
            }
        }
    }

    const handleExecute = (codeAgent) => {
        navigate(`/codeagent/${codeAgent.id}/execute`)
    }

    const handleSessionClick = (session) => {
        navigate(`/codeagent/session/${session.id}`)
    }

    const onConfirm = () => {
        setShowDialog(false)
        getAllCodeAgents()
    }

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue)
    }

    // Render orchestration panel
    const renderOrchestrationPanel = () => (
        <Card sx={{ mb: 3 }}>
            <CardContent>
                <Stack spacing={3}>
                    <Box display="flex" alignItems="center" gap={2}>
                        <IconBrain size={24} color={theme.palette.primary.main} />
                        <Typography variant="h5">AI-Powered Code Generation</Typography>
                    </Box>
                    
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Describe what you want to build"
                        placeholder="e.g., Create a REST API for user management with authentication, validation, and database integration"
                        value={orchestrationPrompt}
                        onChange={(e) => setOrchestrationPrompt(e.target.value)}
                        disabled={isGenerating}
                    />
                    
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={4}>
                            <FormControl fullWidth>
                                <InputLabel>Language</InputLabel>
                                <Select
                                    value={selectedLanguage}
                                    onChange={(e) => setSelectedLanguage(e.target.value)}
                                    disabled={isGenerating}
                                >
                                    <MenuItem value="javascript">JavaScript</MenuItem>
                                    <MenuItem value="python">Python</MenuItem>
                                    <MenuItem value="typescript">TypeScript</MenuItem>
                                    <MenuItem value="java">Java</MenuItem>
                                    <MenuItem value="go">Go</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        
                        <Grid item xs={12} sm={4}>
                            <FormControl fullWidth>
                                <InputLabel>Framework (Optional)</InputLabel>
                                <Select
                                    value={selectedFramework}
                                    onChange={(e) => setSelectedFramework(e.target.value)}
                                    disabled={isGenerating}
                                >
                                    <MenuItem value="">None</MenuItem>
                                    <MenuItem value="react">React</MenuItem>
                                    <MenuItem value="express">Express.js</MenuItem>
                                    <MenuItem value="fastapi">FastAPI</MenuItem>
                                    <MenuItem value="django">Django</MenuItem>
                                    <MenuItem value="spring">Spring Boot</MenuItem>
                                    <MenuItem value="gin">Gin</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        
                        <Grid item xs={12} sm={4}>
                            <FormControl fullWidth>
                                <InputLabel>Complexity</InputLabel>
                                <Select
                                    value={selectedComplexity}
                                    onChange={(e) => setSelectedComplexity(e.target.value)}
                                    disabled={isGenerating}
                                >
                                    <MenuItem value="simple">Simple</MenuItem>
                                    <MenuItem value="medium">Medium</MenuItem>
                                    <MenuItem value="complex">Complex</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                    
                    {isGenerating && (
                        <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                Generating code... {generationProgress}%
                            </Typography>
                            <LinearProgress variant="determinate" value={generationProgress} />
                        </Box>
                    )}
                    
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={<IconRocket />}
                        onClick={handleGenerateCode}
                        disabled={isGenerating || !orchestrationPrompt.trim()}
                        sx={{ alignSelf: 'flex-start' }}
                    >
                        {isGenerating ? 'Generating...' : 'Generate Code'}
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    )

    // Render analytics cards
    const renderAnalyticsCards = () => (
        <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
                <Card>
                    <CardContent>
                        <Stack direction="row" alignItems="center" spacing={2}>
                            <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                                <IconCode />
                            </Avatar>
                            <Box>
                                <Typography variant="h4">{analytics?.totalSessions || 0}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Total Sessions
                                </Typography>
                            </Box>
                        </Stack>
                    </CardContent>
                </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
                <Card>
                    <CardContent>
                        <Stack direction="row" alignItems="center" spacing={2}>
                            <Avatar sx={{ bgcolor: theme.palette.success.main }}>
                                <IconCheck />
                            </Avatar>
                            <Box>
                                <Typography variant="h4">{analytics?.successfulTasks || 0}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Successful Tasks
                                </Typography>
                            </Box>
                        </Stack>
                    </CardContent>
                </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
                <Card>
                    <CardContent>
                        <Stack direction="row" alignItems="center" spacing={2}>
                            <Avatar sx={{ bgcolor: theme.palette.warning.main }}>
                                <IconClock />
                            </Avatar>
                            <Box>
                                <Typography variant="h4">{analytics?.pendingFollowUps || 0}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Pending Follow-ups
                                </Typography>
                            </Box>
                        </Stack>
                    </CardContent>
                </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
                <Card>
                    <CardContent>
                        <Stack direction="row" alignItems="center" spacing={2}>
                            <Avatar sx={{ bgcolor: theme.palette.info.main }}>
                                <IconChartBar />
                            </Avatar>
                            <Box>
                                <Typography variant="h4">{analytics?.averageScore || 0}%</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Avg Quality Score
                                </Typography>
                            </Box>
                        </Stack>
                    </CardContent>
                </Card>
            </Grid>
        </Grid>
    )

    // Render recent sessions
    const renderRecentSessions = () => (
        <Card>
            <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>Recent Sessions</Typography>
                {sessions.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        No sessions yet. Generate your first code to get started!
                    </Typography>
                ) : (
                    <List>
                        {sessions.slice(0, 5).map((session) => (
                            <ListItem
                                key={session.id}
                                button
                                onClick={() => handleSessionClick(session)}
                            >
                                <ListItemIcon>
                                    <IconRobot size={20} />
                                </ListItemIcon>
                                <ListItemText
                                    primary={session.context?.description || `Session ${session.id}`}
                                    secondary={`${session.language} • ${new Date(session.created_at).toLocaleDateString()}`}
                                />
                                <ListItemSecondaryAction>
                                    <Chip
                                        label={session.status}
                                        size="small"
                                        color={session.status === 'completed' ? 'success' : 'default'}
                                    />
                                </ListItemSecondaryAction>
                            </ListItem>
                        ))}
                    </List>
                )}
            </CardContent>
        </Card>
    )

    // Render traditional CodeAgents
    const renderTraditionalCodeAgents = () => (
        <Grid container spacing={3}>
            {codeAgents.length === 0 ? (
                <Grid item xs={12}>
                    <Paper
                        sx={{
                            p: 4,
                            textAlign: 'center',
                            backgroundColor: theme.palette.background.paper
                        }}
                    >
                        <IconCode size={64} color={theme.palette.text.secondary} />
                        <Typography variant='h4' sx={{ mt: 2, mb: 1 }}>
                            No Traditional CodeAgents Yet
                        </Typography>
                        <Typography variant='body1' color='text.secondary' sx={{ mb: 3 }}>
                            Create traditional CodeAgents for custom code execution
                        </Typography>
                        <Button
                            variant='contained'
                            color='primary'
                            onClick={handleCreateNew}
                            startIcon={<IconPlus />}
                        >
                            Create CodeAgent
                        </Button>
                    </Paper>
                </Grid>
            ) : (
                codeAgents.map((codeAgent) => (
                    <Grid item xs={12} sm={6} md={4} key={codeAgent.id}>
                        <Card
                            sx={{
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                '&:hover': {
                                    boxShadow: theme.shadows[4]
                                }
                            }}
                        >
                            <CardContent sx={{ flexGrow: 1 }}>
                                <Stack spacing={2}>
                                    <Box display="flex" alignItems="center" justifyContent="space-between">
                                        <Typography variant="h6" noWrap>
                                            {codeAgent.name}
                                        </Typography>
                                        <Chip
                                            label={codeAgent.language}
                                            size="small"
                                            color="primary"
                                            variant="outlined"
                                        />
                                    </Box>
                                    
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 3,
                                            WebkitBoxOrient: 'vertical'
                                        }}
                                    >
                                        {codeAgent.description || 'No description provided'}
                                    </Typography>
                                    
                                    <Typography variant="caption" color="text.secondary">
                                        Updated: {new Date(codeAgent.updatedDate).toLocaleDateString()}
                                    </Typography>
                                </Stack>
                            </CardContent>
                            
                            <Divider />
                            
                            <Box p={2}>
                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                    <Tooltip title="Execute">
                                        <IconButton
                                            size="small"
                                            onClick={() => handleExecute(codeAgent)}
                                            color="primary"
                                        >
                                            <IconPlayerPlay size={18} />
                                        </IconButton>
                                    </Tooltip>
                                    
                                    <Tooltip title="Edit">
                                        <IconButton
                                            size="small"
                                            onClick={() => handleEdit(codeAgent)}
                                        >
                                            <IconEdit size={18} />
                                        </IconButton>
                                    </Tooltip>
                                    
                                    <Tooltip title="Delete">
                                        <IconButton
                                            size="small"
                                            onClick={() => handleDelete(codeAgent)}
                                            color="error"
                                        >
                                            <IconTrash size={18} />
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                            </Box>
                        </Card>
                    </Grid>
                ))
            )}
        </Grid>
    )

    if (isLoading) {
        return <BackdropLoader open={isLoading} />
    }

    return (
        <>
            <MainCard>
                <Stack flexDirection='column' sx={{ gap: 3 }}>
                    <ViewHeader
                        title='CodeAgent with AI Orchestration'
                        description='Generate intelligent code solutions or create traditional CodeAgents'
                        onSearchChange={() => {}}
                        search={false}
                    >
                        <Stack direction="row" spacing={2}>
                            <Button
                                variant='outlined'
                                color='primary'
                                onClick={handleCreateNew}
                                startIcon={<IconPlus />}
                            >
                                Traditional CodeAgent
                            </Button>
                            <Button
                                variant='contained'
                                color='primary'
                                onClick={() => setActiveTab(0)}
                                startIcon={<IconBrain />}
                            >
                                AI Generation
                            </Button>
                        </Stack>
                    </ViewHeader>
                    
                    {/* System Health Alert */}
                    {systemMetrics && systemMetrics.status !== 'healthy' && (
                        <Alert severity="warning">
                            System is experiencing issues. Some features may be limited.
                        </Alert>
                    )}
                    
                    {/* Tabs */}
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs value={activeTab} onChange={handleTabChange}>
                            <Tab label="AI Generation" icon={<IconBrain />} />
                            <Tab label="Traditional CodeAgents" icon={<IconCode />} />
                            <Tab label="Sessions" icon={<IconHistory />} />
                            <Tab label="Analytics" icon={<IconChartBar />} />
                        </Tabs>
                    </Box>
                    
                    {/* Tab Content */}
                    {activeTab === 0 && (
                        <Box>
                            {renderOrchestrationPanel()}
                            {renderAnalyticsCards()}
                            {renderRecentSessions()}
                        </Box>
                    )}
                    
                    {activeTab === 1 && renderTraditionalCodeAgents()}
                    
                    {activeTab === 2 && (
                        <Card>
                            <CardContent>
                                <Typography variant="h6" sx={{ mb: 2 }}>All Sessions</Typography>
                                {sessions.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary">
                                        No sessions found. Start generating code to create your first session!
                                    </Typography>
                                ) : (
                                    <List>
                                        {sessions.map((session) => (
                                            <ListItem
                                                key={session.id}
                                                button
                                                onClick={() => handleSessionClick(session)}
                                            >
                                                <ListItemIcon>
                                                    <IconRobot size={20} />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={session.context?.description || `Session ${session.id}`}
                                                    secondary={`${session.language} • ${new Date(session.created_at).toLocaleDateString()} • ${session.status}`}
                                                />
                                                <ListItemSecondaryAction>
                                                    <Chip
                                                        label={session.status}
                                                        size="small"
                                                        color={session.status === 'completed' ? 'success' : session.status === 'active' ? 'primary' : 'default'}
                                                    />
                                                </ListItemSecondaryAction>
                                            </ListItem>
                                        ))}
                                    </List>
                                )}
                            </CardContent>
                        </Card>
                    )}
                    
                    {activeTab === 3 && (
                        <Box>
                            {renderAnalyticsCards()}
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <Card>
                                        <CardContent>
                                            <Typography variant="h6" sx={{ mb: 2 }}>Language Distribution</Typography>
                                            {analytics?.languageStats ? (
                                                <Stack spacing={1}>
                                                    {Object.entries(analytics.languageStats).map(([language, count]) => (
                                                        <Box key={language} display="flex" justifyContent="space-between">
                                                            <Typography variant="body2">{language}</Typography>
                                                            <Chip label={count} size="small" />
                                                        </Box>
                                                    ))}
                                                </Stack>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">
                                                    No data available
                                                </Typography>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>
                                
                                <Grid item xs={12} md={6}>
                                    <Card>
                                        <CardContent>
                                            <Typography variant="h6" sx={{ mb: 2 }}>Recent Activity</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Activity tracking coming soon...
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </Box>
                    )}
                </Stack>
            </MainCard>
            
            <CodeAgentDialog
                show={showDialog}
                dialogProps={dialogProps}
                onCancel={() => setShowDialog(false)}
                onConfirm={onConfirm}
            />
        </>
    )
}

export default CodeAgentOrchestrated