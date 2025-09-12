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
    Tabs,
    Tab,
    Alert
} from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@/ErrorBoundary'
import { BackdropLoader } from '@/ui-component/loading/BackdropLoader'
import CodeAgentDialog from './CodeAgentDialog'
import CodeAgentOrchestrated from './CodeAgentOrchestrated'
import DocumentStoreSelector from './DocumentStoreSelector'

// API
import codeAgentApi from '@/api/codeAgent'
import codeAgentOrchestrationApi from '@/api/codeAgentOrchestration'

// Hooks
import useApi from '@/hooks/useApi'
import useNotifier from '@/utils/useNotifier'

// store
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'

// icons
import { IconCode, IconPlus, IconEdit, IconTrash, IconPlayerPlay, IconRocket, IconBrain, IconDatabase } from '@tabler/icons-react'

// ==============================|| CODEAGENT ||============================== //

const CodeAgent = () => {
    const theme = useTheme()
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { t } = useTranslation()

    useNotifier()
    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const [showDialog, setShowDialog] = useState(false)
    const [dialogProps, setDialogProps] = useState({})
    const [codeAgents, setCodeAgents] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [activeView, setActiveView] = useState('traditional') // 'traditional' or 'orchestrated'
    const [systemHealth, setSystemHealth] = useState(null)
    const [documentSelectorOpen, setDocumentSelectorOpen] = useState(false)
    const [selectedDocuments, setSelectedDocuments] = useState(null)

    const getAllCodeAgentsApi = useApi(codeAgentApi.getAllCodeAgents)
    const deleteCodeAgentApi = useApi(codeAgentApi.deleteCodeAgent)
    const getSystemHealthApi = useApi(codeAgentOrchestrationApi.getSystemHealth)

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
        } finally {
            setIsLoading(false)
        }
    }

    const checkSystemHealth = async () => {
        try {
            const response = await getSystemHealthApi.request()
            setSystemHealth(response.data)
        } catch (error) {
            console.error('Error checking system health:', error)
            setSystemHealth({ status: 'unknown', message: 'Unable to check system status' })
        }
    }

    useEffect(() => {
        getAllCodeAgents()
        checkSystemHealth()
    }, [])

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

    const handleDelete = async (codeAgentId) => {
        try {
            await deleteCodeAgentApi.request(codeAgentId)
            enqueueSnackbar({
                message: 'CodeAgent deleted successfully',
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'success'
                }
            })
            getAllCodeAgents()
        } catch (error) {
            console.error('Error deleting code agent:', error)
            enqueueSnackbar({
                message: 'Failed to delete CodeAgent',
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error'
                }
            })
        }
    }

    const handleExecute = (codeAgent) => {
        navigate(`/codeagent/${codeAgent.id}/execute`)
    }

    const onConfirm = () => {
        setShowDialog(false)
        getAllCodeAgents()
    }

    const handleViewChange = (event, newValue) => {
        setActiveView(newValue)
    }

    const handleDocumentSelect = (documentData) => {
        setSelectedDocuments(documentData)
        dispatch(enqueueSnackbarAction({
            message: `Selected ${documentData.loaders.length} document source(s) from ${documentData.documentStore.name}`,
            options: {
                key: new Date().getTime() + Math.random(),
                variant: 'success'
            }
        }))
    }

    const handleClearDocuments = () => {
        setSelectedDocuments(null)
        dispatch(enqueueSnackbarAction({
            message: 'Document selection cleared',
            options: {
                key: new Date().getTime() + Math.random(),
                variant: 'info'
            }
        }))
    }

    // If orchestrated view is selected, render the new component
    if (activeView === 'orchestrated') {
        return <CodeAgentOrchestrated selectedDocuments={selectedDocuments} />
    }

    // Traditional view
    return (
        <>
            <MainCard>
                <Stack flexDirection='column' sx={{ gap: 3 }}>
                    <ViewHeader
                        title='CodeAgent'
                        description='Create and execute backend applications with raw code instead of nodes'
                        onSearchChange={() => {}}
                        search={true}
                        searchPlaceholder='Search CodeAgents...'
                    >
                        <Stack direction="row" spacing={2}>
                            <Button 
                                variant='outlined' 
                                color='primary' 
                                onClick={() => setActiveView('orchestrated')}
                                startIcon={<IconBrain />}
                            >
                                AI Orchestration
                            </Button>
                            <Button
                                variant='contained'
                                color='primary'
                                onClick={handleCreateNew}
                                startIcon={<IconPlus />}
                            >
                                Create CodeAgent
                            </Button>
                            <Button
                                variant={selectedDocuments ? "contained" : "outlined"}
                                onClick={() => setDocumentSelectorOpen(true)}
                                startIcon={<IconDatabase />}
                                color={selectedDocuments ? "success" : "primary"}
                            >
                                {selectedDocuments ? 'Documents Selected' : 'Select Documents'}
                            </Button>
                            {selectedDocuments && (
                                <Button
                                    variant="outlined"
                                    onClick={handleClearDocuments}
                                    color="error"
                                    size="small"
                                >
                                    Clear Selection
                                </Button>
                            )}
                        </Stack>
                    </ViewHeader>
                    
                    {/* System Health Alert */}
                    {systemHealth && systemHealth.status !== 'healthy' && (
                        <Alert 
                            severity={systemHealth.status === 'error' ? 'error' : 'warning'}
                            action={
                                <Button 
                                    color="inherit" 
                                    size="small" 
                                    onClick={() => setActiveView('orchestrated')}
                                    startIcon={<IconRocket />}
                                >
                                    Try AI Generation
                                </Button>
                            }
                        >
                            {systemHealth.message || 'System status unknown'}
                        </Alert>
                    )}
                    
                    {selectedDocuments && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            <Typography variant="body2" component="div">
                                <strong>Document Context Active:</strong>
                                <br />
                                Store: {selectedDocuments.documentStore.name}
                                <br />
                                Sources: {selectedDocuments.loaders.length} selected
                                <br />
                                Query: "{selectedDocuments.query}"
                            </Typography>
                        </Alert>
                    )}
                    
                    {/* View Toggle Tabs */}
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs value={activeView} onChange={handleViewChange}>
                            <Tab 
                                value="traditional" 
                                label="Traditional CodeAgents" 
                                icon={<IconCode />} 
                            />
                            <Tab 
                                value="orchestrated" 
                                label="AI Orchestration" 
                                icon={<IconBrain />} 
                            />
                        </Tabs>
                    </Box>
                    
                    {isLoading ? (
                        <BackdropLoader open={isLoading} />
                    ) : (
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
                                            No CodeAgents Yet
                                        </Typography>
                                        <Typography variant='body1' color='text.secondary' sx={{ mb: 3 }}>
                                            Create your first CodeAgent to build and execute backend applications with raw code
                                        </Typography>
                                        <Button
                                            variant='contained'
                                            color='primary'
                                            onClick={handleCreateNew}
                                            startIcon={<IconPlus />}
                                        >
                                            Create Your First CodeAgent
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
                                                    boxShadow: theme.shadows[8]
                                                }
                                            }}
                                        >
                                            <CardContent sx={{ flexGrow: 1 }}>
                                                <Stack spacing={2}>
                                                    <Box display='flex' alignItems='center' gap={1}>
                                                        <IconCode size={24} color={theme.palette.primary.main} />
                                                        <Typography variant='h6' noWrap>
                                                            {codeAgent.name}
                                                        </Typography>
                                                    </Box>
                                                    
                                                    <Typography
                                                        variant='body2'
                                                        color='text.secondary'
                                                        sx={{
                                                            display: '-webkit-box',
                                                            WebkitLineClamp: 3,
                                                            WebkitBoxOrient: 'vertical',
                                                            overflow: 'hidden'
                                                        }}
                                                    >
                                                        {codeAgent.description || 'No description provided'}
                                                    </Typography>
                                                    
                                                    <Divider />
                                                    
                                                    <Box display='flex' justifyContent='space-between' alignItems='center'>
                                                        <Typography variant='caption' color='text.secondary'>
                                                            {codeAgent.language || 'JavaScript'}
                                                        </Typography>
                                                        <Stack direction='row' spacing={1}>
                                                            <Tooltip title='Execute'>
                                                                <IconButton
                                                                    size='small'
                                                                    color='success'
                                                                    onClick={() => handleExecute(codeAgent)}
                                                                >
                                                                    <IconPlayerPlay size={18} />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title='Edit'>
                                                                <IconButton
                                                                    size='small'
                                                                    color='primary'
                                                                    onClick={() => handleEdit(codeAgent)}
                                                                >
                                                                    <IconEdit size={18} />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title='Delete'>
                                                                <IconButton
                                                                    size='small'
                                                                    color='error'
                                                                    onClick={() => handleDelete(codeAgent.id)}
                                                                >
                                                                    <IconTrash size={18} />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Stack>
                                                    </Box>
                                                </Stack>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))
                            )}
                        </Grid>
                    )}
                </Stack>
            </MainCard>
            
            <CodeAgentDialog
                show={showDialog}
                dialogProps={dialogProps}
                onCancel={() => setShowDialog(false)}
                onConfirm={onConfirm}
            />
            
            <DocumentStoreSelector
                open={documentSelectorOpen}
                onClose={() => setDocumentSelectorOpen(false)}
                onSelect={handleDocumentSelect}
            />
        </>
    )
}

export default CodeAgent