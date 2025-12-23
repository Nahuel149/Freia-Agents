import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Box,
    Typography,
    Chip,
    Alert,
    CircularProgress,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Checkbox
} from '@mui/material'
import { Description as DocumentIcon, Storage as DatabaseIcon, Link as LinkIcon } from '@mui/icons-material'
import codeAgentApi from '@/api/codeAgent'

const DocumentStoreSelector = ({ open, onClose, onSelect }) => {
    const [documentStores, setDocumentStores] = useState([])
    const [selectedStore, setSelectedStore] = useState('')
    const [loaders, setLoaders] = useState([])
    const [selectedLoaders, setSelectedLoaders] = useState([])
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [step, setStep] = useState(1) // 1: Select Store, 2: Select Loaders, 3: Enter Query

    // Load document stores on component mount
    useEffect(() => {
        if (open) {
            loadDocumentStores()
        }
    }, [open])

    const loadDocumentStores = async () => {
        try {
            setLoading(true)
            setError(null)
            const response = await codeAgentApi.getDocumentStores()
            if (response.data.success) {
                setDocumentStores(response.data.data || [])
            } else {
                setError('Failed to load document stores')
            }
        } catch (err) {
            console.error('Error loading document stores:', err)
            setError('Failed to load document stores: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const loadDocumentLoaders = async (storeId) => {
        try {
            setLoading(true)
            setError(null)
            const response = await codeAgentApi.getDocumentLoaders(storeId)
            if (response.data.success) {
                setLoaders(response.data.data || [])
                setStep(2)
            } else {
                setError('Failed to load document loaders')
            }
        } catch (err) {
            console.error('Error loading document loaders:', err)
            setError('Failed to load document loaders: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleStoreSelect = (storeId) => {
        setSelectedStore(storeId)
        loadDocumentLoaders(storeId)
    }

    const handleLoaderToggle = (loaderId) => {
        setSelectedLoaders((prev) => {
            if (prev.includes(loaderId)) {
                return prev.filter((id) => id !== loaderId)
            } else {
                return [...prev, loaderId]
            }
        })
    }

    const handleNext = () => {
        if (step === 2) {
            setStep(3)
        }
    }

    const handleBack = () => {
        if (step === 3) {
            setStep(2)
        } else if (step === 2) {
            setStep(1)
            setSelectedStore('')
            setLoaders([])
            setSelectedLoaders([])
        }
    }

    const handleConfirm = () => {
        const selectedStoreData = documentStores.find((store) => store.id === selectedStore)
        const selectedLoadersData = loaders.filter((loader) => selectedLoaders.includes(loader.id))

        onSelect({
            documentStore: selectedStoreData,
            loaders: selectedLoadersData,
            query: query.trim()
        })

        handleClose()
    }

    const handleClose = () => {
        setStep(1)
        setSelectedStore('')
        setLoaders([])
        setSelectedLoaders([])
        setQuery('')
        setError(null)
        onClose()
    }

    const renderStoreSelection = () => (
        <Box>
            <Typography variant='h6' gutterBottom>
                Select Document Store
            </Typography>
            <Typography variant='body2' color='textSecondary' sx={{ mb: 2 }}>
                Choose a document store to search for relevant documents
            </Typography>

            {error && (
                <Alert severity='error' sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {loading ? (
                <Box display='flex' justifyContent='center' p={3}>
                    <CircularProgress />
                </Box>
            ) : (
                <FormControl fullWidth>
                    <InputLabel>Document Store</InputLabel>
                    <Select value={selectedStore} onChange={(e) => handleStoreSelect(e.target.value)} label='Document Store'>
                        {documentStores.map((store) => (
                            <MenuItem key={store.id} value={store.id}>
                                <Box display='flex' alignItems='center' gap={1}>
                                    <DatabaseIcon fontSize='small' />
                                    <Box>
                                        <Typography variant='body1'>{store.name}</Typography>
                                        {store.description && (
                                            <Typography variant='caption' color='textSecondary'>
                                                {store.description}
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            )}
        </Box>
    )

    const renderLoaderSelection = () => (
        <Box>
            <Typography variant='h6' gutterBottom>
                Select Document Sources
            </Typography>
            <Typography variant='body2' color='textSecondary' sx={{ mb: 2 }}>
                Choose which document sources to include in your search
            </Typography>

            {error && (
                <Alert severity='error' sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {loading ? (
                <Box display='flex' justifyContent='center' p={3}>
                    <CircularProgress />
                </Box>
            ) : (
                <List>
                    {loaders.map((loader) => (
                        <ListItem key={loader.id} button onClick={() => handleLoaderToggle(loader.id)}>
                            <ListItemIcon>
                                <Checkbox checked={selectedLoaders.includes(loader.id)} onChange={() => handleLoaderToggle(loader.id)} />
                            </ListItemIcon>
                            <ListItemIcon>
                                <DocumentIcon />
                            </ListItemIcon>
                            <ListItemText
                                primary={loader.loader_name || loader.source}
                                secondary={
                                    <Box>
                                        <Typography variant='caption' display='block'>
                                            Source: {loader.source}
                                        </Typography>
                                        <Chip label={loader.status} size='small' color={loader.status === 'SYNC' ? 'success' : 'default'} />
                                    </Box>
                                }
                            />
                        </ListItem>
                    ))}
                </List>
            )}

            {selectedLoaders.length > 0 && (
                <Box mt={2}>
                    <Typography variant='body2' color='textSecondary'>
                        Selected: {selectedLoaders.length} source(s)
                    </Typography>
                </Box>
            )}
        </Box>
    )

    const renderQueryInput = () => (
        <Box>
            <Typography variant='h6' gutterBottom>
                Enter Search Query
            </Typography>
            <Typography variant='body2' color='textSecondary' sx={{ mb: 2 }}>
                Describe what you are looking for in the documents
            </Typography>

            <TextField
                fullWidth
                multiline
                rows={4}
                label='Search Query'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='e.g., How to implement authentication, API documentation, database schema...'
                helperText='This query will be used to find relevant documents for your code generation task'
            />
        </Box>
    )

    const getDialogActions = () => {
        const actions = []

        if (step > 1) {
            actions.push(
                <Button key='back' onClick={handleBack}>
                    Back
                </Button>
            )
        }

        actions.push(
            <Button key='cancel' onClick={handleClose}>
                Cancel
            </Button>
        )

        if (step === 1) {
            // No next button for step 1, selection triggers next step
        } else if (step === 2) {
            actions.push(
                <Button key='next' onClick={handleNext} disabled={selectedLoaders.length === 0} variant='contained'>
                    Next
                </Button>
            )
        } else if (step === 3) {
            actions.push(
                <Button key='confirm' onClick={handleConfirm} disabled={!query.trim()} variant='contained' startIcon={<LinkIcon />}>
                    Use Documents
                </Button>
            )
        }

        return actions
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth='md' fullWidth>
            <DialogTitle>Document Store Integration - Step {step} of 3</DialogTitle>
            <DialogContent>
                {step === 1 && renderStoreSelection()}
                {step === 2 && renderLoaderSelection()}
                {step === 3 && renderQueryInput()}
            </DialogContent>
            <DialogActions>{getDialogActions()}</DialogActions>
        </Dialog>
    )
}

export default DocumentStoreSelector
