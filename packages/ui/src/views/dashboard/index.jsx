import { useEffect, useState } from 'react'
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
    LinearProgress,
    Avatar,
    IconButton,
    Tooltip,
     List,
     ListItem,
     ListItemAvatar,
     ListItemText,
     Divider,
     Chip
 } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import { gridSpacing } from '@/store/constant'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@/ErrorBoundary'

// Hooks
import { useTranslation } from 'react-i18next'
import { useError } from '@/store/context/ErrorContext'

// icons
import {
    IconUsers,
    IconMessageCircle,
    IconTrendingUp,
    IconTarget,
    IconPhone,
    IconMail,
    IconCalendar,
    IconCurrencyDollar,
    IconChartBar,
    IconRefresh,
    IconEye,
    IconClock,
    IconUserPlus,
    IconThumbUp,
    IconAlertTriangle,
    IconPackage,
    IconMoodHappy,
    IconMoodSad,
    IconMoodEmpty,
    IconStar
} from '@tabler/icons-react'

// ==============================|| DASHBOARD ||============================== //

const Dashboard = () => {
    const navigate = useNavigate()
    const theme = useTheme()
    const { t } = useTranslation()
    const { error, setError } = useError()

    const [isLoading, setLoading] = useState(true)
    const [dashboardData, setDashboardData] = useState({
        totalConversations: 0,
        activeAgents: 0,
        closedClients: 0,
        totalContacts: 0,
        conversionRate: 0,
        avgResponseTime: 0,
        totalRevenue: 0,
        monthlyGrowth: 0,
        leadsGenerated: 0,
        meetingsScheduled: 0,
        followUpsCompleted: 0,
        customerSatisfaction: 0,
        // B2B Tire Sales Specific Metrics
        totalCallbacks: 0,
        newClientContacts: 0,
        followUpsSent: 0,
        outOfStockAlerts: 0,
        mostRequestedProducts: [],
        customerFeedbackAvg: 0,
        sentimentAnalysis: { positive: 0, neutral: 0, negative: 0 },
        topMentionedWords: [],
        agentPerformance: [],
        inventoryAlerts: [],
        recentActivities: [],
        topPerformingAgents: [],
        salesFunnel: {
            leads: 0,
            qualified: 0,
            proposals: 0,
            closed: 0
        }
    })

    // Fetch real data from API
    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true)
            try {
                // Fetch dashboard metrics from API
                const response = await fetch('/api/v1/dashboard')
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`)
                }
                const apiData = await response.json()
                
                // Map API data to dashboard state with fallbacks for missing data
                setDashboardData({
                    totalConversations: apiData.totalConversations || 0,
                    activeAgents: apiData.activeAgents || 0,
                    closedClients: apiData.closedClients || 0,
                    totalContacts: apiData.totalConversations || 0, // Use same as conversations for now
                    conversionRate: apiData.conversionRate || 0,
                    avgResponseTime: 2.3, // Keep static for now
                    totalRevenue: apiData.salesData?.reduce((sum, sale) => sum + sale.revenue, 0) || 0,
                    monthlyGrowth: 18.7, // Keep static for now
                    leadsGenerated: apiData.totalConversations || 0,
                    meetingsScheduled: Math.floor((apiData.closedClients || 0) * 1.5), // Estimate
                    followUpsCompleted: apiData.totalCallbacks || 0,
                    customerSatisfaction: 4.2, // Keep static for now
                    // B2B Tire Sales Specific Data from API
                    totalCallbacks: apiData.totalCallbacks || 0,
                    newClientContacts: apiData.totalConversations || 0,
                    followUpsSent: apiData.totalCallbacks || 0,
                    outOfStockAlerts: apiData.mostRequestedProducts?.filter(p => p.stock === 0).length || 0,
                    mostRequestedProducts: apiData.mostRequestedProducts?.map(p => ({
                        name: p.name,
                        requests: p.requests,
                        stock: Math.floor(Math.random() * 20) // Random stock for demo
                    })) || [],
                    customerFeedbackAvg: 8.4, // Keep static for now
                    sentimentAnalysis: apiData.sentimentAnalysis || { positive: 0, neutral: 0, negative: 0 },
                    topMentionedWords: [
                        { word: 'precio', count: 156 },
                        { word: 'descuento', count: 89 },
                        { word: 'calidad', count: 67 },
                        { word: 'entrega', count: 54 },
                        { word: 'garantía', count: 43 }
                    ], // Keep static for now
                    agentPerformance: [
                        { name: 'Agent Carlos', sales: 23, revenue: 45600, satisfaction: 9.1 },
                        { name: 'Agent María', sales: 19, revenue: 38200, satisfaction: 8.7 },
                        { name: 'Agent Diego', sales: 17, revenue: 34100, satisfaction: 8.9 },
                        { name: 'Agent Ana', sales: 15, revenue: 29800, satisfaction: 8.5 }
                    ], // Keep static for now
                    inventoryAlerts: apiData.mostRequestedProducts?.filter(p => p.stock <= 5).map(p => ({
                        product: p.name,
                        status: p.stock === 0 ? 'Sin Stock' : `Stock Bajo (${p.stock})`,
                        priority: p.stock === 0 ? 'high' : p.stock <= 3 ? 'medium' : 'low'
                    })) || [],
                    recentActivities: [
                        { id: 1, type: 'client_closed', agent: 'Agent Alpha', client: 'TechCorp Inc.', value: '$25,000', time: '2 hours ago' },
                        { id: 2, type: 'new_contact', agent: 'Agent Beta', client: 'StartupXYZ', value: 'New Lead', time: '4 hours ago' },
                        { id: 3, type: 'meeting_scheduled', agent: 'Agent Gamma', client: 'Enterprise Ltd.', value: 'Demo Call', time: '6 hours ago' },
                        { id: 4, type: 'proposal_sent', agent: 'Agent Delta', client: 'MegaCorp', value: '$50,000', time: '8 hours ago' },
                        { id: 5, type: 'follow_up', agent: 'Agent Epsilon', client: 'SmallBiz Co.', value: 'Follow-up', time: '1 day ago' }
                    ], // Keep static for now
                    topPerformingAgents: [
                        { name: 'Agent Alpha', conversations: 89, closedDeals: 12, revenue: 125000, avatar: 'A' },
                        { name: 'Agent Beta', conversations: 76, closedDeals: 9, revenue: 98000, avatar: 'B' },
                        { name: 'Agent Gamma', conversations: 65, closedDeals: 8, revenue: 87000, avatar: 'G' },
                        { name: 'Agent Delta', conversations: 58, closedDeals: 7, revenue: 76000, avatar: 'D' }
                    ], // Keep static for now
                    salesFunnel: {
                        leads: apiData.totalConversations || 0,
                        qualified: Math.floor((apiData.totalConversations || 0) * 0.6),
                        proposals: Math.floor((apiData.totalConversations || 0) * 0.25),
                        closed: apiData.closedClients || 0
                    }
                })
            } catch (err) {
                setError(err)
            } finally {
                setLoading(false)
            }
        }

        fetchDashboardData()
    }, [])

    const MetricCard = ({ title, value, icon, color, subtitle, trend }) => (
        <Card 
            sx={{ 
                height: '100%',
                background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
                border: `1px solid ${color}30`,
                borderRadius: '16px',
                transition: 'all 0.3s ease',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: `0 8px 25px ${color}20`
                }
            }}
        >
            <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                        <Typography variant="h6" color="textSecondary" gutterBottom>
                            {title}
                        </Typography>
                        <Typography variant="h3" component="div" sx={{ color: color, fontWeight: 'bold' }}>
                            {isLoading ? <Skeleton width={80} /> : value}
                        </Typography>
                        {subtitle && (
                            <Typography variant="body2" color="textSecondary">
                                {subtitle}
                            </Typography>
                        )}
                        {trend && (
                            <Chip 
                                label={`+${trend}%`} 
                                size="small" 
                                color="success" 
                                sx={{ mt: 1 }}
                            />
                        )}
                    </Box>
                    <Avatar sx={{ bgcolor: color, width: 56, height: 56 }}>
                        {icon}
                    </Avatar>
                </Stack>
            </CardContent>
        </Card>
    )

    const ActivityItem = ({ activity }) => {
        const getActivityIcon = (type) => {
            switch (type) {
                case 'client_closed': return <IconTarget size={20} color={theme.palette.success.main} />
                case 'new_contact': return <IconUsers size={20} color={theme.palette.info.main} />
                case 'meeting_scheduled': return <IconCalendar size={20} color={theme.palette.warning.main} />
                case 'proposal_sent': return <IconMail size={20} color={theme.palette.primary.main} />
                default: return <IconMessageCircle size={20} color={theme.palette.text.secondary} />
            }
        }

        return (
            <Stack direction="row" spacing={2} alignItems="center" sx={{ py: 1.5, px: 2 }}>
                {getActivityIcon(activity.type)}
                <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" fontWeight="medium">
                        {activity.agent} - {activity.client}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                        {activity.value} • {activity.time}
                    </Typography>
                </Box>
            </Stack>
        )
    }

    const SalesFunnelCard = () => (
        <Card sx={{ height: '100%', borderRadius: '16px' }}>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Sales Funnel
                </Typography>
                <Stack spacing={2}>
                    {Object.entries(dashboardData.salesFunnel).map(([stage, count], index) => {
                        const percentage = (count / dashboardData.salesFunnel.leads) * 100
                        const colors = ['#2196F3', '#4CAF50', '#FF9800', '#9C27B0']
                        return (
                            <Box key={stage}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                                        {stage}
                                    </Typography>
                                    <Typography variant="body2" fontWeight="bold">
                                        {isLoading ? <Skeleton width={30} /> : count}
                                    </Typography>
                                </Stack>
                                <LinearProgress 
                                    variant="determinate" 
                                    value={percentage} 
                                    sx={{ 
                                        height: 8, 
                                        borderRadius: 4,
                                        backgroundColor: `${colors[index]}20`,
                                        '& .MuiLinearProgress-bar': {
                                            backgroundColor: colors[index]
                                        }
                                    }} 
                                />
                            </Box>
                        )
                    })}
                </Stack>
            </CardContent>
        </Card>
    )

    return (
        <MainCard 
            sx={{
                background: 'linear-gradient(135deg, rgba(74, 144, 226, 0.1) 0%, rgba(80, 200, 120, 0.1) 100%)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '20px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
            }}
        >
            {error ? (
                <ErrorBoundary error={error} />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 3 }}>
                    <ViewHeader
                        title="B2B Agent Performance Dashboard"
                        subtitle="Monitor your AI agents' performance and business metrics"
                        action={
                            <Tooltip title="Refresh Data">
                                <IconButton onClick={() => window.location.reload()}>
                                    <IconRefresh />
                                </IconButton>
                            </Tooltip>
                        }
                    />

                    {/* Key Metrics */}
                    <Grid container spacing={gridSpacing}>
                        <Grid item xs={12} sm={6} md={3}>
                            <MetricCard
                                title="Total Conversations"
                                value={dashboardData.totalConversations.toLocaleString()}
                                icon={<IconMessageCircle />}
                                color={theme.palette.primary.main}
                                trend={dashboardData.monthlyGrowth}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <MetricCard
                                title="Closed Clients"
                                value={dashboardData.closedClients}
                                icon={<IconTarget />}
                                color={theme.palette.success.main}
                                subtitle="This month"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <MetricCard
                                title="Total Contacts"
                                value={dashboardData.totalContacts.toLocaleString()}
                                icon={<IconUsers />}
                                color={theme.palette.info.main}
                                subtitle="All time"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <MetricCard
                                title="Conversion Rate"
                                value={`${dashboardData.conversionRate}%`}
                                icon={<IconTrendingUp />}
                                color={theme.palette.warning.main}
                                subtitle="Lead to client"
                            />
                        </Grid>
                    </Grid>

                    {/* Secondary Metrics */}
                    <Grid container spacing={gridSpacing}>
                        <Grid item xs={12} sm={6} md={3}>
                            <MetricCard
                                title="Active Agents"
                                value={dashboardData.activeAgents}
                                icon={<IconUsers />}
                                color={theme.palette.secondary.main}
                                subtitle="Currently online"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <MetricCard
                                title="Avg Response Time"
                                value={`${dashboardData.avgResponseTime}s`}
                                icon={<IconPhone />}
                                color={theme.palette.error.main}
                                subtitle="Agent response"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <MetricCard
                                title="Total Revenue"
                                value={`$${(dashboardData.totalRevenue / 1000).toFixed(0)}K`}
                                icon={<IconCurrencyDollar />}
                                color={theme.palette.success.main}
                                subtitle="This quarter"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <MetricCard
                                title="Leads Generated"
                                value={dashboardData.leadsGenerated}
                                icon={<IconTrendingUp />}
                                color={theme.palette.info.main}
                                subtitle="This month"
                            />
                        </Grid>
                    </Grid>

                    {/* Additional Metrics */}
                    <Grid container spacing={gridSpacing}>
                        <Grid item xs={12} sm={6} md={3}>
                            <MetricCard
                                title="Meetings Scheduled"
                                value={dashboardData.meetingsScheduled}
                                icon={<IconCalendar />}
                                color={theme.palette.warning.main}
                                subtitle="This month"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <MetricCard
                                title="Follow-ups Completed"
                                value={dashboardData.followUpsCompleted}
                                icon={<IconMessageCircle />}
                                color={theme.palette.secondary.main}
                                subtitle="This month"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <MetricCard
                                title="Customer Satisfaction"
                                value={`${dashboardData.customerSatisfaction}/5.0`}
                                icon={<IconChartBar />}
                                color={theme.palette.success.main}
                                subtitle="Average rating"
                            />
                        </Grid>
                    </Grid>

                    {/* B2B Tire Sales Specific Metrics */}
                    <Grid container spacing={gridSpacing}>
                        <Grid item xs={12} sm={6} md={3}>
                            <MetricCard
                                title="Total Callbacks"
                                value={dashboardData.totalCallbacks}
                                icon={<IconPhone />}
                                color={theme.palette.info.main}
                                subtitle="This week"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <MetricCard
                                title="New Client Contacts"
                                value={dashboardData.newClientContacts}
                                icon={<IconUsers />}
                                color={theme.palette.success.main}
                                subtitle="This week"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <MetricCard
                                title="Follow-ups Sent"
                                value={dashboardData.followUpsSent}
                                icon={<IconMail />}
                                color={theme.palette.primary.main}
                                subtitle="This week"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <MetricCard
                                title="Customer Feedback Avg"
                                value={`${dashboardData.customerFeedbackAvg}/10`}
                                icon={<IconChartBar />}
                                color={theme.palette.success.main}
                                subtitle="Average score"
                            />
                        </Grid>
                         
                         {/* Inventory Alerts Section */}
                         <Grid item xs={12} md={6}>
                             <MainCard title="Alertas de Inventario" content={false}>
                                 <CardContent>
                                     {dashboardData.inventoryAlerts.map((alert, index) => (
                                         <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 2, p: 2, 
                                             bgcolor: alert.priority === 'high' ? 'error.light' : alert.priority === 'medium' ? 'warning.light' : 'info.light',
                                             borderRadius: 1 }}>
                                             <IconAlertTriangle color={alert.priority === 'high' ? 'red' : alert.priority === 'medium' ? 'orange' : 'blue'} />
                                             <Box sx={{ ml: 2 }}>
                                                 <Typography variant="subtitle2">{alert.product}</Typography>
                                                 <Typography variant="body2" color="text.secondary">{alert.status}</Typography>
                                             </Box>
                                         </Box>
                                     ))}
                                 </CardContent>
                             </MainCard>
                         </Grid>
                         
                         {/* Most Requested Products */}
                         <Grid item xs={12} md={6}>
                             <MainCard title="Productos Más Solicitados" content={false}>
                                 <CardContent>
                                     {dashboardData.mostRequestedProducts.map((product, index) => (
                                         <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, p: 2, 
                                             bgcolor: 'grey.50', borderRadius: 1 }}>
                                             <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                 <IconPackage />
                                                 <Box sx={{ ml: 2 }}>
                                                     <Typography variant="subtitle2">{product.name}</Typography>
                                                     <Typography variant="body2" color="text.secondary">{product.requests} solicitudes</Typography>
                                                 </Box>
                                             </Box>
                                             <Chip 
                                                 label={product.stock > 0 ? `Stock: ${product.stock}` : 'Sin Stock'}
                                                 color={product.stock > 10 ? 'success' : product.stock > 0 ? 'warning' : 'error'}
                                                 size="small"
                                             />
                                         </Box>
                                     ))}
                                 </CardContent>
                             </MainCard>
                         </Grid>
                         
                         {/* Sentiment Analysis */}
                          <Grid item xs={12} md={6}>
                              <MainCard title="Análisis de Sentimientos" content={false}>
                                  <CardContent>
                                      <Box sx={{ display: 'flex', justifyContent: 'space-around', mb: 2 }}>
                                          <Box sx={{ textAlign: 'center' }}>
                                              <IconMoodHappy size={40} color="green" />
                                              <Typography variant="h4" color="success.main">{dashboardData.sentimentAnalysis.positive}%</Typography>
                                              <Typography variant="body2">Positivo</Typography>
                                          </Box>
                                          <Box sx={{ textAlign: 'center' }}>
                                              <IconMoodEmpty size={40} color="orange" />
                                              <Typography variant="h4" color="warning.main">{dashboardData.sentimentAnalysis.neutral}%</Typography>
                                              <Typography variant="body2">Neutral</Typography>
                                          </Box>
                                          <Box sx={{ textAlign: 'center' }}>
                                              <IconMoodSad size={40} color="red" />
                                              <Typography variant="h4" color="error.main">{dashboardData.sentimentAnalysis.negative}%</Typography>
                                              <Typography variant="body2">Negativo</Typography>
                                          </Box>
                                      </Box>
                                  </CardContent>
                              </MainCard>
                          </Grid>
                          
                          {/* Top Mentioned Words */}
                          <Grid item xs={12} md={6}>
                              <MainCard title="Palabras Más Mencionadas" content={false}>
                                  <CardContent>
                                      {dashboardData.topMentionedWords.map((wordData, index) => (
                                          <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                                              <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>
                                                  {wordData.word}
                                              </Typography>
                                              <Chip 
                                                  label={wordData.count}
                                                  color="primary"
                                                  size="small"
                                              />
                                          </Box>
                                      ))}
                                  </CardContent>
                              </MainCard>
                          </Grid>
                          
                          {/* Agent Performance */}
                          <Grid item xs={12}>
                              <MainCard title="Rendimiento de Agentes" content={false}>
                                  <CardContent>
                                      <Grid container spacing={2}>
                                          {dashboardData.agentPerformance.map((agent, index) => (
                                              <Grid item xs={12} sm={6} md={3} key={index}>
                                                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, textAlign: 'center' }}>
                                                      <Typography variant="h6">{agent.name}</Typography>
                                                      <Typography variant="body2" color="text.secondary">Ventas: {agent.sales}</Typography>
                                                      <Typography variant="body2" color="text.secondary">Ingresos: ${agent.revenue.toLocaleString()}</Typography>
                                                      <Typography variant="body2" color="success.main">Satisfacción: {agent.satisfaction}/10</Typography>
                                                  </Box>
                                              </Grid>
                                          ))}
                                      </Grid>
                                  </CardContent>
                              </MainCard>
                          </Grid>
                          
                          <Grid item xs={12} sm={6} md={3}>
                              <SalesFunnelCard />
                          </Grid>
                     </Grid>

                    {/* Detailed Analytics */}
                    <Grid container spacing={gridSpacing}>
                        {/* Recent Activities */}
                        <Grid item xs={12} md={6}>
                            <Card sx={{ height: '100%', borderRadius: '16px' }}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Recent Activities
                                    </Typography>
                                    <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
                                        {isLoading ? (
                                            Array.from({ length: 5 }).map((_, index) => (
                                                <Skeleton key={index} height={60} />
                                            ))
                                        ) : (
                                            dashboardData.recentActivities.map((activity) => (
                                                <ActivityItem key={activity.id} activity={activity} />
                                            ))
                                        )}
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Top Performing Agents */}
                        <Grid item xs={12} md={6}>
                            <Card sx={{ height: '100%', borderRadius: '16px' }}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Top Performing Agents
                                    </Typography>
                                    <Stack spacing={2}>
                                        {isLoading ? (
                                            Array.from({ length: 4 }).map((_, index) => (
                                                <Skeleton key={index} height={60} />
                                            ))
                                        ) : (
                                            dashboardData.topPerformingAgents.map((agent, index) => (
                                                <Stack key={agent.name} direction="row" spacing={2} alignItems="center">
                                                    <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                                                        {agent.avatar}
                                                    </Avatar>
                                                    <Box sx={{ flexGrow: 1 }}>
                                                        <Typography variant="body1" fontWeight="medium">
                                                            {agent.name}
                                                        </Typography>
                                                        <Typography variant="caption" color="textSecondary">
                                                            {agent.conversations} conversations • {agent.closedDeals} deals
                                                        </Typography>
                                                    </Box>
                                                    <Typography variant="h6" color="success.main">
                                                        ${(agent.revenue / 1000).toFixed(0)}K
                                                    </Typography>
                                                </Stack>
                                            ))
                                        )}
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Stack>
            )}
        </MainCard>
    )
}

export default Dashboard