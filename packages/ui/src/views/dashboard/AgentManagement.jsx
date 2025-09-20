import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// material-ui
import {
    Box,
    Grid,
    Card,
    CardContent,
    Typography,
    Skeleton,
    Stack,
    Chip,
    Avatar,
    IconButton,
    Tooltip,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Divider,
    TextField,
    Button,
    Alert,
    Badge,
    Switch,
    FormControlLabel,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    LinearProgress
} from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import { gridSpacing } from '@/store/constant'
import client from '@/api/client'

// third party
import { useTranslation } from 'react-i18next'

// icons
import {
    IconRobot,
    IconSettings,
    IconCheck,
    IconX,
    IconTool,
    IconWifi,
    IconWifiOff,
    IconEye,
    IconRefresh,
    IconPlayerPlay,
    IconPlayerPause,
    IconTrash,
    IconEdit,
    IconPlus,
    IconChartBar,
    IconClock,
    IconMessageCircle,
    IconTarget,
    IconTrendingUp
} from '@tabler/icons-react'

const AgentManagement = () => {
    const theme = useTheme()
    const navigate = useNavigate()
    const { t } = useTranslation()
    
    const [isLoading, setLoading] = useState(true)
    const [agents, setAgents] = useState([])
    const [selectedAgent, setSelectedAgent] = useState(null)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [agentStats, setAgentStats] = useState({
        totalAgents: 0,
        activeAgents: 0,
        inactiveAgents: 0,
        totalConversations: 0,
        avgResponseTime: 0,
        successRate: 0
    })

    // Fetch agents data
    useEffect(() => {
        const fetchAgents = async () => {
            setLoading(true)
            try {
                // Fetch both chatflows and agentflows from API
                const [chatflowsResponse, agentflowsResponse] = await Promise.all([
                    client.get('/chatflows?type=CHATFLOW'),
                    client.get('/chatflows?type=AGENTFLOW')
                ])
                
                const chatflows = chatflowsResponse.data || []
                const agentflows = agentflowsResponse.data || []
                const allFlows = [...chatflows, ...agentflows]

                const statsResponse = await client.get('/chatflows/stats')
                const chatflowStats = statsResponse.data || []
                
                // Transform flows to agent format
                const agentData = allFlows.map(flow => {
                    const stats = chatflowStats.find(s => s.chatflowid === flow.id)
                    return {
                        id: flow.id,
                        name: flow.name,
                        type: flow.type || (flow.flowData && JSON.parse(flow.flowData).nodes?.some(n => n.data.name === 'startAgentflow') ? 'agentflow' : 'chatflow'),
                        status: flow.deployed ? 'active' : 'inactive',
                        lastActive: flow.updatedDate || flow.createdDate,
                        conversations: stats?.totalConversations || 0,
                        responseTime: stats?.avgResponseTime || 0,
                        successRate: stats?.successRate || 0,
                        description: flow.description || 'No description available',
                        category: flow.category || 'General',
                        deployed: flow.deployed || false
                    }
                })
                
                setAgents(agentData)
                
                // Calculate stats
                const stats = {
                    totalAgents: agentData.length,
                    activeAgents: agentData.filter(a => a.status === 'active').length,
                    inactiveAgents: agentData.filter(a => a.status === 'inactive').length,
                    totalConversations: agentData.reduce((sum, a) => sum + a.conversations, 0),
                    avgResponseTime: agentData.length > 0 ? 
                        agentData.reduce((sum, a) => sum + a.responseTime, 0) / agentData.length : 0,
                    successRate: agentData.length > 0 ? 
                        agentData.reduce((sum, a) => sum + a.successRate, 0) / agentData.length : 0
                }
                setAgentStats(stats)
                
            } catch (error) {
                console.error('Error fetching agents:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchAgents()
    }, [])

    const handleAgentToggle = async (agentId, currentStatus) => {
        try {
            // Toggle agent status
            const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
            
            // Update local state
            setAgents(prev => prev.map(agent => 
                agent.id === agentId ? { ...agent, status: newStatus } : agent
            ))
            
            // Here you would make an API call to update the agent status
            // await client.patch(`/chatflows/${agentId}`, { deployed: newStatus === 'active' })
            
        } catch (error) {
            console.error('Error toggling agent:', error)
        }
    }

    const handleViewAgent = (agentId) => {
        navigate(`/chatflows/${agentId}`)
    }

    const handleEditAgent = (agentId) => {
        navigate(`/canvas/${agentId}`)
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'active':
                return 'success'
            case 'inactive':
                return 'default'
            default:
                return 'default'
        }
    }

    const getStatusIcon = (status) => {
        switch (status) {
            case 'active':
                return <IconWifi size={16} />
            case 'inactive':
                return <IconWifiOff size={16} />
            default:
                return <IconWifiOff size={16} />
        }
    }

    if (isLoading) {
        return (
            <Stack spacing={3}>
                <Grid container spacing={gridSpacing}>
                    {[1, 2, 3, 4].map((item) => (
                        <Grid item xs={12} sm={6} md={3} key={item}>
                            <Card>
                                <CardContent>
                                    <Skeleton variant="text" height={40} />
                                    <Skeleton variant="text" height={60} />
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
                <Skeleton variant="rectangular" height={400} />
            </Stack>
        )
    }

    return (
        <Stack spacing={3}>
            {/* Agent Statistics */}
            <Grid container spacing={gridSpacing}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Stack direction="row" alignItems="center" spacing={2}>
                                <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                                    <IconRobot />
                                </Avatar>
                                <Box>
                                    <Typography variant="h3" color="primary">
                                        {agentStats.totalAgents}
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        Total Agents
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
                                    <IconWifi />
                                </Avatar>
                                <Box>
                                    <Typography variant="h3" color="success.main">
                                        {agentStats.activeAgents}
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        Active Agents
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
                                    <IconMessageCircle />
                                </Avatar>
                                <Box>
                                    <Typography variant="h3" color="info.main">
                                        {agentStats.totalConversations}
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        Total Conversations
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
                                    <Typography variant="h3" color="warning.main">
                                        {Math.round(agentStats.avgResponseTime)}ms
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        Avg Response Time
                                    </Typography>
                                </Box>
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Agent Management Table */}
            <Card>
                <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Typography variant="h4">
                            Agent Management
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<IconPlus />}
                            onClick={() => navigate('/chatflows')}
                        >
                            Create New Agent
                        </Button>
                    </Stack>
                    
                    <TableContainer component={Paper} variant="outlined">
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Agent</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Type</TableCell>
                                    <TableCell>Conversations</TableCell>
                                    <TableCell>Response Time</TableCell>
                                    <TableCell>Success Rate</TableCell>
                                    <TableCell>Last Active</TableCell>
                                    <TableCell align="center">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {agents.map((agent) => (
                                    <TableRow key={agent.id} hover>
                                        <TableCell>
                                            <Stack direction="row" alignItems="center" spacing={2}>
                                                <Avatar sx={{ bgcolor: theme.palette.primary.light }}>
                                                    <IconRobot size={20} />
                                                </Avatar>
                                                <Box>
                                                    <Typography variant="subtitle2">
                                                        {agent.name}
                                                    </Typography>
                                                    <Typography variant="body2" color="textSecondary">
                                                        {agent.description}
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                icon={getStatusIcon(agent.status)}
                                                label={agent.status}
                                                color={getStatusColor(agent.status)}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={agent.type}
                                                variant="outlined"
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>{agent.conversations}</TableCell>
                                        <TableCell>{agent.responseTime}ms</TableCell>
                                        <TableCell>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={agent.successRate}
                                                    sx={{ width: 60, height: 6 }}
                                                />
                                                <Typography variant="body2">
                                                    {agent.successRate}%
                                                </Typography>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">
                                                {new Date(agent.lastActive).toLocaleDateString()}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Stack direction="row" spacing={1}>
                                                <Tooltip title="View Agent">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleViewAgent(agent.id)}
                                                    >
                                                        <IconEye size={16} />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Edit Agent">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleEditAgent(agent.id)}
                                                    >
                                                        <IconEdit size={16} />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title={agent.status === 'active' ? 'Deactivate' : 'Activate'}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleAgentToggle(agent.id, agent.status)}
                                                        color={agent.status === 'active' ? 'error' : 'success'}
                                                    >
                                                        {agent.status === 'active' ? 
                                                            <IconPlayerPause size={16} /> : 
                                                            <IconPlayerPlay size={16} />
                                                        }
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    
                    {agents.length === 0 && (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <Typography variant="h6" color="textSecondary">
                                No agents found
                            </Typography>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                Create your first agent to get started
                            </Typography>
                            <Button
                                variant="contained"
                                startIcon={<IconPlus />}
                                onClick={() => navigate('/agentflows')}
                            >
                                Create Agent
                            </Button>
                        </Box>
                    )}
                </CardContent>
            </Card>
        </Stack>
    )
}

export default AgentManagement