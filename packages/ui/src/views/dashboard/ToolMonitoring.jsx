import React, { useState, useEffect } from 'react'
import {
    Grid,
    Card,
    CardContent,
    Typography,
    Skeleton,
    Stack,
    Chip,
    Avatar,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Divider,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Alert
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import MainCard from '@/ui-component/cards/MainCard'
import { gridSpacing } from '@/store/constant'
import client from '@/api/client'
import { useRealTimeData } from '@/hooks/useRealTimeData'
import {
    IconTool,
    IconActivity,
    IconClock,
    IconCheck,
    IconX,
    IconAlertTriangle,
    IconTrendingUp,
    IconTrendingDown,
    IconDatabase,
    IconSearch,
    IconFileText,
    IconMail,
    IconPhone,
    IconCalendar,
    IconCode,
    IconWorld,
    IconBrain,
    IconChartBar
} from '@tabler/icons-react'

const ToolMonitoring = () => {
    const theme = useTheme()
    const [isLoading, setLoading] = useState(true)
    const [toolData, setToolData] = useState({
        overview: {
            totalTools: 0,
            activeTools: 0,
            totalUsage: 0,
            successRate: 0,
            avgResponseTime: 0,
            errorCount: 0
        },
        toolUsage: [],
        recentActivity: [],
        errorLogs: [],
        performance: []
    })

    // Real-time data integration
    const { connectionStatus, isConnected, realtimeData, subscribeToToolExecutions, subscribeToErrors, getMetrics, updateMetrics } =
        useRealTimeData()

    const { toolExecutions = [], errors = [], metrics = {} } = realtimeData

    const toolIcons = {
        search_codebase: IconSearch,
        view_files: IconFileText,
        update_file: IconCode,
        write_to_file: IconFileText,
        run_command: IconActivity,
        web_search: IconWorld,
        mcp_render: IconDatabase,
        mcp_MongoDB: IconDatabase,
        mcp_PostgreSQL: IconDatabase,
        email: IconMail,
        calendar: IconCalendar,
        phone: IconPhone,
        ai_analysis: IconBrain,
        default: IconTool
    }

    useEffect(() => {
        fetchToolData()
        const interval = setInterval(fetchToolData, 30000) // Refresh every 30 seconds
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        // Subscribe to real-time tool execution data
        subscribeToToolExecutions()
        subscribeToErrors()
    }, [])

    // Update tool metrics with real-time data
    useEffect(() => {
        if (metrics && Object.keys(metrics).length > 0) {
            setToolData((prev) => ({
                ...prev,
                overview: {
                    ...prev.overview,
                    totalTools: metrics.totalTools || prev.overview.totalTools,
                    activeTools: metrics.activeTools || prev.overview.activeTools,
                    totalUsage: metrics.totalUsage || prev.overview.totalUsage,
                    successRate: metrics.successRate || prev.overview.successRate,
                    avgResponseTime: metrics.avgResponseTime || prev.overview.avgResponseTime,
                    errorCount: metrics.errorCount || prev.overview.errorCount
                },
                toolUsage: metrics.toolUsage || prev.toolUsage,
                recentActivity: toolExecutions.slice(0, 5) || prev.recentActivity,
                errorLogs: errors.slice(0, 3) || prev.errorLogs
            }))
        }
    }, [metrics, toolExecutions, errors])

    const fetchToolData = async () => {
        try {
            const response = await client.get('/agent-dashboard/tools')
            setToolData(response.data)
        } catch (error) {
            console.error('Error fetching tool data:', error)
        }
        setLoading(false)
    }

    const getToolIcon = (toolName) => {
        const IconComponent = toolIcons[toolName] || toolIcons.default
        return <IconComponent size={20} />
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'success':
                return theme.palette.success.main
            case 'error':
                return theme.palette.error.main
            case 'warning':
                return theme.palette.warning.main
            default:
                return theme.palette.grey[500]
        }
    }

    const getTrendIcon = (trend) => {
        switch (trend) {
            case 'up':
                return <IconTrendingUp size={16} color={theme.palette.success.main} />
            case 'down':
                return <IconTrendingDown size={16} color={theme.palette.error.main} />
            default:
                return <IconChartBar size={16} color={theme.palette.grey[500]} />
        }
    }

    const MetricCard = ({ title, value, subtitle, icon, color, trend }) => (
        <Card sx={{ height: '100%', borderRadius: '12px' }}>
            <CardContent>
                <Stack direction='row' alignItems='center' justifyContent='space-between' mb={1}>
                    <Avatar sx={{ bgcolor: `${color}20`, color: color, width: 40, height: 40 }}>{icon}</Avatar>
                    {trend && getTrendIcon(trend)}
                </Stack>
                <Typography variant='h4' fontWeight='bold' color={color}>
                    {isLoading ? <Skeleton width={60} /> : value}
                </Typography>
                <Typography variant='h6' color='textPrimary' gutterBottom>
                    {title}
                </Typography>
                {subtitle && (
                    <Typography variant='body2' color='textSecondary'>
                        {subtitle}
                    </Typography>
                )}
            </CardContent>
        </Card>
    )

    return (
        <Stack spacing={3}>
            {/* Connection Status Alert */}
            {!isConnected && (
                <Alert severity='warning' icon={<IconAlertTriangle />}>
                    Real-time connection lost. Tool monitoring data may not be current.
                </Alert>
            )}

            {/* Overview Metrics */}
            <Grid container spacing={gridSpacing}>
                <Grid item xs={12} sm={6} md={2}>
                    <MetricCard
                        title='Total Tools'
                        value={toolData.overview.totalTools}
                        icon={<IconTool />}
                        color={theme.palette.primary.main}
                        subtitle='Available'
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                    <MetricCard
                        title='Active Tools'
                        value={toolData.overview.activeTools}
                        icon={<IconActivity />}
                        color={theme.palette.success.main}
                        subtitle='Currently used'
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                    <MetricCard
                        title='Total Usage'
                        value={toolData.overview.totalUsage.toLocaleString()}
                        icon={<IconChartBar />}
                        color={theme.palette.info.main}
                        subtitle='All time'
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                    <MetricCard
                        title='Success Rate'
                        value={`${toolData.overview.successRate}%`}
                        icon={<IconCheck />}
                        color={theme.palette.success.main}
                        subtitle='Overall'
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                    <MetricCard
                        title='Avg Response'
                        value={`${toolData.overview.avgResponseTime}s`}
                        icon={<IconClock />}
                        color={theme.palette.warning.main}
                        subtitle='Response time'
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                    <MetricCard
                        title='Errors'
                        value={toolData.overview.errorCount}
                        icon={<IconX />}
                        color={theme.palette.error.main}
                        subtitle='Last 24h'
                    />
                </Grid>
            </Grid>

            {/* Tool Usage Table */}
            <Grid container spacing={gridSpacing}>
                <Grid item xs={12} lg={8}>
                    <MainCard title='Tool Usage Analytics' content={false}>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Tool</TableCell>
                                        <TableCell align='right'>Usage</TableCell>
                                        <TableCell align='right'>Success Rate</TableCell>
                                        <TableCell align='right'>Avg Time</TableCell>
                                        <TableCell align='right'>Errors</TableCell>
                                        <TableCell align='right'>Trend</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {isLoading
                                        ? Array.from({ length: 5 }).map((_, index) => (
                                              <TableRow key={index}>
                                                  <TableCell>
                                                      <Skeleton />
                                                  </TableCell>
                                                  <TableCell>
                                                      <Skeleton />
                                                  </TableCell>
                                                  <TableCell>
                                                      <Skeleton />
                                                  </TableCell>
                                                  <TableCell>
                                                      <Skeleton />
                                                  </TableCell>
                                                  <TableCell>
                                                      <Skeleton />
                                                  </TableCell>
                                                  <TableCell>
                                                      <Skeleton />
                                                  </TableCell>
                                              </TableRow>
                                          ))
                                        : toolData.toolUsage.map((tool) => {
                                              const performance = toolData.performance.find((p) => p.tool === tool.name)
                                              return (
                                                  <TableRow key={tool.name}>
                                                      <TableCell>
                                                          <Stack direction='row' alignItems='center' spacing={1}>
                                                              {getToolIcon(tool.name)}
                                                              <Typography variant='body2'>
                                                                  {tool.name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                                              </Typography>
                                                          </Stack>
                                                      </TableCell>
                                                      <TableCell align='right'>{tool.usage}</TableCell>
                                                      <TableCell align='right'>
                                                          <Chip
                                                              label={`${tool.successRate}%`}
                                                              size='small'
                                                              color={
                                                                  tool.successRate > 95
                                                                      ? 'success'
                                                                      : tool.successRate > 90
                                                                      ? 'warning'
                                                                      : 'error'
                                                              }
                                                          />
                                                      </TableCell>
                                                      <TableCell align='right'>{tool.avgTime}s</TableCell>
                                                      <TableCell align='right'>
                                                          <Typography color={tool.errors > 5 ? 'error' : 'textPrimary'}>
                                                              {tool.errors}
                                                          </Typography>
                                                      </TableCell>
                                                      <TableCell align='right'>
                                                          {performance && (
                                                              <Stack direction='row' alignItems='center' spacing={0.5}>
                                                                  {getTrendIcon(performance.trend)}
                                                                  <Typography
                                                                      variant='caption'
                                                                      color={
                                                                          performance.trend === 'up'
                                                                              ? 'success.main'
                                                                              : performance.trend === 'down'
                                                                              ? 'error.main'
                                                                              : 'textSecondary'
                                                                      }
                                                                  >
                                                                      {performance.change > 0 ? '+' : ''}
                                                                      {performance.change}%
                                                                  </Typography>
                                                              </Stack>
                                                          )}
                                                      </TableCell>
                                                  </TableRow>
                                              )
                                          })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </MainCard>
                </Grid>

                {/* Recent Activity */}
                <Grid item xs={12} lg={4}>
                    <MainCard title='Recent Tool Activity' content={false}>
                        <CardContent>
                            <List>
                                {isLoading
                                    ? Array.from({ length: 5 }).map((_, index) => (
                                          <ListItem key={index}>
                                              <ListItemAvatar>
                                                  <Skeleton variant='circular' width={40} height={40} />
                                              </ListItemAvatar>
                                              <ListItemText primary={<Skeleton />} secondary={<Skeleton />} />
                                          </ListItem>
                                      ))
                                    : toolData.recentActivity.map((activity, index) => (
                                          <React.Fragment key={index}>
                                              <ListItem>
                                                  <ListItemAvatar>
                                                      <Avatar
                                                          sx={{
                                                              bgcolor: `${getStatusColor(activity.status)}20`,
                                                              color: getStatusColor(activity.status),
                                                              width: 32,
                                                              height: 32
                                                          }}
                                                      >
                                                          {getToolIcon(activity.tool)}
                                                      </Avatar>
                                                  </ListItemAvatar>
                                                  <ListItemText
                                                      primary={
                                                          <Stack direction='row' alignItems='center' spacing={1}>
                                                              <Typography variant='body2'>{activity.tool.replace(/_/g, ' ')}</Typography>
                                                              <Chip
                                                                  label={activity.status}
                                                                  size='small'
                                                                  color={activity.status === 'success' ? 'success' : 'error'}
                                                                  sx={{ height: 20 }}
                                                              />
                                                          </Stack>
                                                      }
                                                      secondary={
                                                          <Typography variant='caption' color='textSecondary'>
                                                              {activity.agent} • {activity.duration}s •{' '}
                                                              {new Date(activity.timestamp).toLocaleTimeString()}
                                                          </Typography>
                                                      }
                                                  />
                                              </ListItem>
                                              {index < toolData.recentActivity.length - 1 && <Divider />}
                                          </React.Fragment>
                                      ))}
                            </List>
                        </CardContent>
                    </MainCard>
                </Grid>
            </Grid>

            {/* Error Logs */}
            <Grid container spacing={gridSpacing}>
                <Grid item xs={12}>
                    <MainCard title='Recent Errors' content={false}>
                        <CardContent>
                            {isLoading ? (
                                <Stack spacing={1}>
                                    {Array.from({ length: 3 }).map((_, index) => (
                                        <Skeleton key={index} height={60} />
                                    ))}
                                </Stack>
                            ) : toolData.errorLogs.length > 0 ? (
                                <Stack spacing={2}>
                                    {toolData.errorLogs.map((error, index) => (
                                        <Alert key={index} severity='error' icon={<IconAlertTriangle />} sx={{ borderRadius: '8px' }}>
                                            <Stack>
                                                <Typography variant='body2' fontWeight='medium'>
                                                    {error.tool.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}: {error.error}
                                                </Typography>
                                                <Typography variant='caption' color='textSecondary'>
                                                    {error.agent} • {new Date(error.timestamp).toLocaleString()}
                                                </Typography>
                                            </Stack>
                                        </Alert>
                                    ))}
                                </Stack>
                            ) : (
                                <Alert severity='success' icon={<IconCheck />}>
                                    No recent errors - all tools are running smoothly!
                                </Alert>
                            )}
                        </CardContent>
                    </MainCard>
                </Grid>
            </Grid>
        </Stack>
    )
}

export default ToolMonitoring
