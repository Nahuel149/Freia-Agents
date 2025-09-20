import { useState, useEffect, useCallback, useRef } from 'react'
import websocketService from '@/services/websocket'

/**
 * Custom hook for managing real-time data updates
 * @param {Object} options - Configuration options
 * @returns {Object} Real-time data and connection status
 */
export const useRealTimeData = (options = {}) => {
    const {
        autoConnect = true,
        reconnectOnMount = true,
        subscriptions = ['agentActivity', 'toolExecution', 'conversationUpdate', 'metricsUpdate']
    } = options

    const [connectionStatus, setConnectionStatus] = useState('disconnected')
    const [lastUpdate, setLastUpdate] = useState(null)
    const [realtimeData, setRealtimeData] = useState({
        agentActivities: [],
        toolExecutions: [],
        conversations: [],
        metrics: {},
        errors: []
    })

    const subscriptionsRef = useRef(new Set())
    const isInitializedRef = useRef(false)

    /**
     * Handle connection status changes
     */
    const handleConnectionChange = useCallback((status) => {
        setConnectionStatus(status)
        setLastUpdate(new Date())
    }, [])

    /**
     * Handle agent activity updates
     */
    const handleAgentActivity = useCallback((data) => {
        setRealtimeData(prev => ({
            ...prev,
            agentActivities: [data, ...prev.agentActivities.slice(0, 49)] // Keep last 50 activities
        }))
        setLastUpdate(new Date())
    }, [])

    /**
     * Handle tool execution updates
     */
    const handleToolExecution = useCallback((data) => {
        setRealtimeData(prev => ({
            ...prev,
            toolExecutions: [data, ...prev.toolExecutions.slice(0, 99)] // Keep last 100 executions
        }))
        setLastUpdate(new Date())
    }, [])

    /**
     * Handle conversation updates
     */
    const handleConversationUpdate = useCallback((data) => {
        setRealtimeData(prev => {
            const existingIndex = prev.conversations.findIndex(conv => conv.id === data.id)
            let updatedConversations

            if (existingIndex >= 0) {
                // Update existing conversation
                updatedConversations = [...prev.conversations]
                updatedConversations[existingIndex] = { ...updatedConversations[existingIndex], ...data }
            } else {
                // Add new conversation
                updatedConversations = [data, ...prev.conversations.slice(0, 49)] // Keep last 50 conversations
            }

            return {
                ...prev,
                conversations: updatedConversations
            }
        })
        setLastUpdate(new Date())
    }, [])

    /**
     * Handle metrics updates
     */
    const handleMetricsUpdate = useCallback((data) => {
        setRealtimeData(prev => ({
            ...prev,
            metrics: { ...prev.metrics, ...data }
        }))
        setLastUpdate(new Date())
    }, [])

    /**
     * Handle error reports
     */
    const handleErrorReport = useCallback((data) => {
        setRealtimeData(prev => ({
            ...prev,
            errors: [data, ...prev.errors.slice(0, 29)] // Keep last 30 errors
        }))
        setLastUpdate(new Date())
    }, [])

    /**
     * Setup WebSocket subscriptions
     */
    const setupSubscriptions = useCallback(() => {
        // Clear existing subscriptions
        subscriptionsRef.current.clear()

        // Setup connection status listeners
        websocketService.on('connected', () => handleConnectionChange('connected'))
        websocketService.on('disconnected', () => handleConnectionChange('disconnected'))
        websocketService.on('error', () => handleConnectionChange('error'))

        // Setup data subscriptions based on options
        if (subscriptions.includes('agentActivity')) {
            websocketService.subscribeToAgentActivities(handleAgentActivity)
            subscriptionsRef.current.add('agentActivity')
        }

        if (subscriptions.includes('toolExecution')) {
            websocketService.subscribeToToolExecutions(handleToolExecution)
            subscriptionsRef.current.add('toolExecution')
        }

        if (subscriptions.includes('conversationUpdate')) {
            websocketService.subscribeToConversations(handleConversationUpdate)
            subscriptionsRef.current.add('conversationUpdate')
        }

        if (subscriptions.includes('metricsUpdate')) {
            websocketService.subscribeToMetrics(handleMetricsUpdate)
            subscriptionsRef.current.add('metricsUpdate')
        }

        if (subscriptions.includes('errorReport')) {
            websocketService.subscribeToErrors(handleErrorReport)
            subscriptionsRef.current.add('errorReport')
        }
    }, [subscriptions, handleConnectionChange, handleAgentActivity, handleToolExecution, 
        handleConversationUpdate, handleMetricsUpdate, handleErrorReport])

    /**
     * Connect to WebSocket
     */
    const connect = useCallback(() => {
        if (!websocketService.getConnectionStatus()) {
            websocketService.connect()
            setupSubscriptions()
        }
    }, [setupSubscriptions])

    /**
     * Disconnect from WebSocket
     */
    const disconnect = useCallback(() => {
        websocketService.disconnect()
        setConnectionStatus('disconnected')
    }, [])

    /**
     * Manually refresh data
     */
    const refreshData = useCallback(() => {
        if (websocketService.getConnectionStatus()) {
            // Request fresh data from server
            websocketService.send('refresh_data', { 
                subscriptions: Array.from(subscriptionsRef.current),
                timestamp: Date.now()
            })
        }
    }, [])

    /**
     * Clear specific data type
     */
    const clearData = useCallback((dataType) => {
        setRealtimeData(prev => ({
            ...prev,
            [dataType]: dataType === 'metrics' ? {} : []
        }))
    }, [])

    /**
     * Get filtered data based on criteria
     */
    const getFilteredData = useCallback((dataType, filter = {}) => {
        const data = realtimeData[dataType]
        
        if (!data || (Array.isArray(data) && data.length === 0)) {
            return Array.isArray(data) ? [] : {}
        }

        if (!Array.isArray(data)) {
            return data
        }

        let filteredData = [...data]

        // Apply time filter
        if (filter.timeRange) {
            const now = new Date()
            const timeLimit = new Date(now.getTime() - filter.timeRange * 60 * 1000) // timeRange in minutes
            filteredData = filteredData.filter(item => 
                new Date(item.timestamp || item.createdAt || item.time) >= timeLimit
            )
        }

        // Apply status filter
        if (filter.status) {
            filteredData = filteredData.filter(item => item.status === filter.status)
        }

        // Apply type filter
        if (filter.type) {
            filteredData = filteredData.filter(item => item.type === filter.type)
        }

        // Apply limit
        if (filter.limit) {
            filteredData = filteredData.slice(0, filter.limit)
        }

        return filteredData
    }, [realtimeData])

    // Initialize WebSocket connection
    useEffect(() => {
        if (autoConnect && !isInitializedRef.current) {
            connect()
            isInitializedRef.current = true
        }

        return () => {
            if (reconnectOnMount) {
                disconnect()
            }
        }
    }, [autoConnect, reconnectOnMount, connect, disconnect])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Clean up subscriptions
            subscriptionsRef.current.forEach(subscription => {
                switch (subscription) {
                    case 'agentActivity':
                        websocketService.off('agentActivity', handleAgentActivity)
                        break
                    case 'toolExecution':
                        websocketService.off('toolExecution', handleToolExecution)
                        break
                    case 'conversationUpdate':
                        websocketService.off('conversationUpdate', handleConversationUpdate)
                        break
                    case 'metricsUpdate':
                        websocketService.off('metricsUpdate', handleMetricsUpdate)
                        break
                    case 'errorReport':
                        websocketService.off('errorReport', handleErrorReport)
                        break
                }
            })
        }
    }, [handleAgentActivity, handleToolExecution, handleConversationUpdate, 
        handleMetricsUpdate, handleErrorReport])

    return {
        // Connection status
        connectionStatus,
        isConnected: connectionStatus === 'connected',
        lastUpdate,

        // Real-time data
        realtimeData,
        agentActivities: realtimeData.agentActivities,
        toolExecutions: realtimeData.toolExecutions,
        conversations: realtimeData.conversations,
        metrics: realtimeData.metrics,
        errors: realtimeData.errors,

        // Actions
        connect,
        disconnect,
        refreshData,
        clearData,
        getFilteredData,

        // Utilities
        getRecentActivities: (minutes = 60) => getFilteredData('agentActivities', { timeRange: minutes }),
        getRecentToolExecutions: (minutes = 60) => getFilteredData('toolExecutions', { timeRange: minutes }),
        getActiveConversations: () => getFilteredData('conversations', { status: 'active' }),
        getRecentErrors: (minutes = 60) => getFilteredData('errors', { timeRange: minutes })
    }
}

export default useRealTimeData