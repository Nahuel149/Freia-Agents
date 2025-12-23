import { useState } from 'react'
import PropTypes from 'prop-types'

// material-ui
import {
    Box,
    Card,
    CardContent,
    Typography,
    Stack,
    Chip,
    Grid,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Divider,
    Paper
} from '@mui/material'
import { useTheme } from '@mui/material/styles'

// icons
import {
    IconChevronDown,
    IconHierarchy,
    IconArrowRight,
    IconRobot,
    IconBrain,
    IconTool,
    IconDatabase,
    IconMessage,
    IconSettings
} from '@tabler/icons-react'

// ==============================|| WORKFLOW PREVIEW ||============================== //

const WorkflowPreview = ({ workflow }) => {
    const theme = useTheme()
    const [expanded, setExpanded] = useState('nodes')

    const handleChange = (panel) => (event, isExpanded) => {
        setExpanded(isExpanded ? panel : false)
    }

    const getNodeIcon = (nodeType) => {
        switch (nodeType?.toLowerCase()) {
            case 'chatmodel':
            case 'chatopenai':
                return <IconBrain size={20} />
            case 'agent':
            case 'agentexecutor':
                return <IconRobot size={20} />
            case 'tool':
                return <IconTool size={20} />
            case 'memory':
            case 'buffermemory':
                return <IconDatabase size={20} />
            case 'prompt':
            case 'prompttemplate':
                return <IconMessage size={20} />
            default:
                return <IconSettings size={20} />
        }
    }

    const getNodeColor = (nodeType) => {
        switch (nodeType?.toLowerCase()) {
            case 'chatmodel':
            case 'chatopenai':
                return theme.palette.primary.main
            case 'agent':
            case 'agentexecutor':
                return theme.palette.success.main
            case 'tool':
                return theme.palette.warning.main
            case 'memory':
            case 'buffermemory':
                return theme.palette.info.main
            case 'prompt':
            case 'prompttemplate':
                return theme.palette.secondary.main
            default:
                return theme.palette.grey[500]
        }
    }

    if (!workflow) {
        return null
    }

    const { nodes = [], edges = [] } = workflow

    return (
        <Box>
            <Stack spacing={2}>
                {/* Summary */}
                <Paper elevation={0} sx={{ p: 2, bgcolor: theme.palette.background.default }}>
                    <Grid container spacing={2}>
                        <Grid item xs={6} sm={3}>
                            <Box textAlign='center'>
                                <Typography variant='h3' color='primary'>
                                    {nodes.length}
                                </Typography>
                                <Typography variant='body2' color='textSecondary'>
                                    Nodes
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <Box textAlign='center'>
                                <Typography variant='h3' color='primary'>
                                    {edges.length}
                                </Typography>
                                <Typography variant='body2' color='textSecondary'>
                                    Connections
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <Box textAlign='center'>
                                <Typography variant='h3' color='primary'>
                                    {new Set(nodes.map((n) => n.data?.name || n.data?.type)).size}
                                </Typography>
                                <Typography variant='body2' color='textSecondary'>
                                    Node Types
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <Box textAlign='center'>
                                <Chip label='AI Generated' color='success' variant='outlined' size='small' />
                            </Box>
                        </Grid>
                    </Grid>
                </Paper>

                {/* Nodes Accordion */}
                <Accordion expanded={expanded === 'nodes'} onChange={handleChange('nodes')}>
                    <AccordionSummary expandIcon={<IconChevronDown />} aria-controls='nodes-content' id='nodes-header'>
                        <Box display='flex' alignItems='center' gap={1}>
                            <IconHierarchy size={20} />
                            <Typography variant='h5'>Workflow Nodes ({nodes.length})</Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Grid container spacing={2}>
                            {nodes.map((node, index) => {
                                const nodeType = node.data?.name || node.data?.type || 'Unknown'
                                const nodeLabel = node.data?.label || node.id

                                return (
                                    <Grid item xs={12} sm={6} md={4} key={node.id || index}>
                                        <Card variant='outlined' sx={{ height: '100%' }}>
                                            <CardContent>
                                                <Stack spacing={1}>
                                                    <Box display='flex' alignItems='center' gap={1}>
                                                        <Box
                                                            sx={{
                                                                color: getNodeColor(nodeType),
                                                                display: 'flex',
                                                                alignItems: 'center'
                                                            }}
                                                        >
                                                            {getNodeIcon(nodeType)}
                                                        </Box>
                                                        <Typography variant='subtitle2' noWrap>
                                                            {nodeLabel}
                                                        </Typography>
                                                    </Box>

                                                    <Chip
                                                        label={nodeType}
                                                        size='small'
                                                        variant='outlined'
                                                        sx={{
                                                            borderColor: getNodeColor(nodeType),
                                                            color: getNodeColor(nodeType)
                                                        }}
                                                    />

                                                    {node.data?.description && (
                                                        <Typography variant='body2' color='textSecondary' sx={{ fontSize: '0.75rem' }}>
                                                            {node.data.description}
                                                        </Typography>
                                                    )}
                                                </Stack>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                )
                            })}
                        </Grid>
                    </AccordionDetails>
                </Accordion>

                {/* Connections Accordion */}
                <Accordion expanded={expanded === 'connections'} onChange={handleChange('connections')}>
                    <AccordionSummary expandIcon={<IconChevronDown />} aria-controls='connections-content' id='connections-header'>
                        <Box display='flex' alignItems='center' gap={1}>
                            <IconArrowRight size={20} />
                            <Typography variant='h5'>Node Connections ({edges.length})</Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                        <List>
                            {edges.map((edge, index) => {
                                const sourceNode = nodes.find((n) => n.id === edge.source)
                                const targetNode = nodes.find((n) => n.id === edge.target)
                                const sourceLabel = sourceNode?.data?.label || edge.source
                                const targetLabel = targetNode?.data?.label || edge.target

                                return (
                                    <div key={edge.id || index}>
                                        <ListItem>
                                            <ListItemIcon>
                                                <IconArrowRight size={16} />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={
                                                    <Box display='flex' alignItems='center' gap={1}>
                                                        <Typography variant='body2'>{sourceLabel}</Typography>
                                                        <IconArrowRight size={14} color={theme.palette.text.secondary} />
                                                        <Typography variant='body2'>{targetLabel}</Typography>
                                                    </Box>
                                                }
                                                secondary={
                                                    edge.sourceHandle && edge.targetHandle
                                                        ? `${edge.sourceHandle} → ${edge.targetHandle}`
                                                        : null
                                                }
                                            />
                                        </ListItem>
                                        {index < edges.length - 1 && <Divider />}
                                    </div>
                                )
                            })}
                        </List>
                    </AccordionDetails>
                </Accordion>
            </Stack>
        </Box>
    )
}

WorkflowPreview.propTypes = {
    workflow: PropTypes.shape({
        nodes: PropTypes.array,
        edges: PropTypes.array
    })
}

export default WorkflowPreview
