import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'

// material-ui
import {
    Box,
    Button,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography,
    Stack,
    Alert,
    CircularProgress,
    Divider,
    Paper,
    Snackbar,
    LinearProgress
} from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@/ErrorBoundary'
import { BackdropLoader } from '@/ui-component/loading/BackdropLoader'
import WorkflowPreview from './WorkflowPreview'

// API
import agentflowGeneratorApi from '@/api/agentflowGenerator'
import nodesApi from '@/api/nodes'

// Hooks
import useApi from '@/hooks/useApi'
import useNotifier from '@/utils/useNotifier'

// store
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'

// icons
import { IconSparkles, IconRobot, IconWand, IconAlertCircle, IconCheck } from '@tabler/icons-react'

// ==============================|| AGENTFLOW GENERATOR ||============================== //

const AgentflowGenerator = () => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const theme = useTheme()
    const dispatch = useDispatch()

    // ==============================|| Snackbar ||============================== //
    useNotifier()
    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    // State
    const [question, setQuestion] = useState('')
    const [selectedChatModel, setSelectedChatModel] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [generatedWorkflow, setGeneratedWorkflow] = useState(null)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [progress, setProgress] = useState(0)
    const [chatModels, setChatModels] = useState([])

    // API calls
    const getChatModelsApi = useApi(nodesApi.getSpecificNode)
    const generateWorkflowApi = useApi(agentflowGeneratorApi.generateAgentflow)

    useEffect(() => {
        // Load available chat models
        getChatModelsApi.request('chatModels')
    }, [])

    useEffect(() => {
        if (getChatModelsApi.data) {
            setChatModels(getChatModelsApi.data || [])
        }
    }, [getChatModelsApi.data])

    const handleGenerate = async () => {
        if (!question.trim()) {
            setError('Please enter a question or description for your workflow')
            return
        }
        if (!selectedChatModel) {
            setError('Please select a chat model')
            return
        }

        setError('')
        setSuccess('')
        setIsGenerating(true)
        setGeneratedWorkflow(null)
        setProgress(0)

        try {
            // Simulate progress updates
            const progressInterval = setInterval(() => {
                setProgress((prev) => {
                    if (prev >= 90) {
                        clearInterval(progressInterval)
                        return 90
                    }
                    return prev + 10
                })
            }, 500)

            const response = await generateWorkflowApi.request({
                question: question.trim(),
                selectedChatModel
            })

            clearInterval(progressInterval)
            setProgress(100)

            if (response) {
                setGeneratedWorkflow(response)
                setSuccess('Workflow generated successfully!')
                enqueueSnackbar({
                    message: 'Workflow generated successfully!',
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'success'
                    }
                })
            } else {
                throw new Error('No data received from server')
            }
        } catch (err) {
            console.error('Generation error:', err)
            let errorMessage = 'Failed to generate workflow. Please try again.'

            if (err.response?.status === 400) {
                errorMessage = 'Invalid request. Please check your inputs and try again.'
            } else if (err.response?.status === 401) {
                errorMessage = 'Authentication required. Please log in and try again.'
            } else if (err.response?.status === 403) {
                errorMessage = 'You do not have permission to generate workflows.'
            } else if (err.response?.status === 429) {
                errorMessage = 'Too many requests. Please wait a moment and try again.'
            } else if (err.response?.status >= 500) {
                errorMessage = 'Server error. Please try again later.'
            } else if (err.response?.data?.message) {
                errorMessage = err.response.data.message
            } else if (err.message) {
                errorMessage = err.message
            }

            setError(errorMessage)
            setProgress(0)
            enqueueSnackbar({
                message: 'Failed to generate workflow',
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error'
                }
            })
        } finally {
            setIsGenerating(false)
        }
    }

    const handleCreateWorkflow = () => {
        if (generatedWorkflow) {
            try {
                // Navigate to canvas with generated workflow data
                navigate('/v2/agentcanvas', {
                    state: {
                        generatedWorkflow,
                        isFromGenerator: true
                    }
                })
            } catch (err) {
                console.error('Navigation error:', err)
                setError('Failed to navigate to canvas. Please try again.')
            }
        }
    }

    const handleCloseSnackbar = () => {
        setSuccess('')
        setError('')
    }

    const handleReset = () => {
        setQuestion('')
        setSelectedChatModel('')
        setGeneratedWorkflow(null)
        setError('')
    }

    return (
        <ErrorBoundary>
            <ViewHeader
                title={t('Agentflow Generator')}
                subtitle={t('Generate AI workflows from natural language descriptions')}
                icon={<IconSparkles />}
            />

            <MainCard>
                <Stack spacing={3}>
                    {/* Input Form */}
                    <Paper elevation={1} sx={{ p: 3 }}>
                        <Stack spacing={3}>
                            <Box display='flex' alignItems='center' gap={1}>
                                <IconWand size={24} color={theme.palette.primary.main} />
                                <Typography variant='h4' color='primary'>
                                    {t('Describe Your Workflow')}
                                </Typography>
                            </Box>

                            <TextField
                                fullWidth
                                multiline
                                rows={4}
                                label={t('What do you want your AI workflow to do?')}
                                placeholder={t(
                                    'Example: Create a customer support agent that can answer questions about our products and escalate complex issues to human agents'
                                )}
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                disabled={isGenerating}
                                variant='outlined'
                            />

                            <FormControl fullWidth disabled={isGenerating}>
                                <InputLabel>{t('Select Chat Model')}</InputLabel>
                                <Select
                                    value={selectedChatModel}
                                    onChange={(e) => setSelectedChatModel(e.target.value)}
                                    label={t('Select Chat Model')}
                                >
                                    {chatModels.map((model) => (
                                        <MenuItem key={model.name} value={model.name}>
                                            {model.label || model.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            {isGenerating && (
                                <Box sx={{ width: '100%' }}>
                                    <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
                                        Generating workflow... {progress}%
                                    </Typography>
                                    <LinearProgress variant='determinate' value={progress} />
                                </Box>
                            )}

                            {error && (
                                <Alert severity='error' onClose={() => setError('')}>
                                    {error}
                                </Alert>
                            )}

                            <Stack direction='row' spacing={2}>
                                <Button
                                    variant='contained'
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !question.trim() || !selectedChatModel}
                                    startIcon={isGenerating ? <CircularProgress size={20} /> : <IconRobot />}
                                    size='large'
                                >
                                    {isGenerating ? t('Generating...') : t('Generate Workflow')}
                                </Button>

                                <Button variant='outlined' onClick={handleReset} disabled={isGenerating}>
                                    {t('Reset')}
                                </Button>
                            </Stack>
                        </Stack>
                    </Paper>

                    {/* Generated Workflow Preview */}
                    {generatedWorkflow && (
                        <>
                            <Divider />
                            <Paper elevation={1} sx={{ p: 3 }}>
                                <Stack spacing={3}>
                                    <Box display='flex' alignItems='center' justifyContent='space-between'>
                                        <Typography variant='h4' color='primary'>
                                            {t('Generated Workflow')}
                                        </Typography>
                                        <Button variant='contained' onClick={handleCreateWorkflow} color='success'>
                                            {t('Create Workflow')}
                                        </Button>
                                    </Box>

                                    <WorkflowPreview workflow={generatedWorkflow} />
                                </Stack>
                            </Paper>
                        </>
                    )}
                </Stack>
            </MainCard>

            {/* Success/Error Snackbar */}
            <Snackbar
                open={!!success || !!error}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={handleCloseSnackbar}
                    severity={success ? 'success' : 'error'}
                    variant='filled'
                    icon={success ? <IconCheck /> : <IconAlertCircle />}
                >
                    {success || error}
                </Alert>
            </Snackbar>

            {isGenerating && <BackdropLoader open={isGenerating} />}
        </ErrorBoundary>
    )
}

export default AgentflowGenerator
