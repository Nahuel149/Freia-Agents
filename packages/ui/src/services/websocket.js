/**
 * WebSocket service for real-time dashboard updates
 * Handles connection to agent output streams and data broadcasting
 */

class WebSocketService {
    constructor() {
        this.socket = null
        this.reconnectAttempts = 0
        this.maxReconnectAttempts = 5
        this.reconnectInterval = 3000
        this.listeners = new Map()
        this.isConnected = false
        this.heartbeatInterval = null
    }

    /**
     * Get WebSocket URL based on environment configuration
     * @returns {string} WebSocket URL
     */
    getWebSocketURL() {
        // Get base URL from environment or current location
        const baseURL = import.meta.env.VITE_API_BASE_URL || window.location.origin
        
        // Convert HTTP/HTTPS to WS/WSS
        let wsURL = baseURL.replace(/^http/, 'ws')
        
        // Handle different environments
        if (baseURL.includes('localhost:3000')) {
            // Local development - backend runs on port 3000
            wsURL = 'ws://localhost:3000/ws'
        } else if (baseURL.includes('localhost:8080')) {
            // UI development server - but backend is on 3000
            wsURL = 'ws://localhost:3000/ws'
        } else {
            // Production or other environments
            wsURL = `${wsURL}/ws`
        }
        
        return wsURL
    }

    /**
     * Connect to WebSocket server
     * @param {string} url - WebSocket server URL
     */
    connect(url = null) {
        const wsURL = url || this.getWebSocketURL()
        try {
            this.socket = new WebSocket(wsURL)
            this.setupEventHandlers()
        } catch (error) {
            console.error('WebSocket connection failed:', error)
            this.handleReconnect()
        }
    }

    /**
     * Setup WebSocket event handlers
     */
    setupEventHandlers() {
        if (!this.socket) return

        this.socket.onopen = () => {
            console.log('WebSocket connected')
            this.isConnected = true
            this.reconnectAttempts = 0
            this.startHeartbeat()
            this.emit('connected', { status: 'connected' })
        }

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                this.handleMessage(data)
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error)
            }
        }

        this.socket.onclose = (event) => {
            console.log('WebSocket disconnected:', event.code, event.reason)
            this.isConnected = false
            this.stopHeartbeat()
            this.emit('disconnected', { code: event.code, reason: event.reason })
            
            if (!event.wasClean) {
                this.handleReconnect()
            }
        }

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error)
            this.emit('error', { error })
        }
    }

    /**
     * Handle incoming WebSocket messages
     * @param {Object} data - Parsed message data
     */
    handleMessage(data) {
        const { type, payload } = data

        switch (type) {
            case 'agent_activity':
                this.emit('agentActivity', payload)
                break
            case 'tool_execution':
                this.emit('toolExecution', payload)
                break
            case 'conversation_update':
                this.emit('conversationUpdate', payload)
                break
            case 'metrics_update':
                this.emit('metricsUpdate', payload)
                break
            case 'error_report':
                this.emit('errorReport', payload)
                break
            case 'heartbeat':
                // Handle heartbeat response
                break
            default:
                console.warn('Unknown message type:', type)
        }
    }

    /**
     * Start heartbeat to keep connection alive
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected && this.socket.readyState === WebSocket.OPEN) {
                this.send('heartbeat', { timestamp: Date.now() })
            }
        }, 30000) // Send heartbeat every 30 seconds
    }

    /**
     * Stop heartbeat
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval)
            this.heartbeatInterval = null
        }
    }

    /**
     * Handle reconnection logic
     */
    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++
            console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
            
            setTimeout(() => {
                this.connect()
            }, this.reconnectInterval * this.reconnectAttempts)
        } else {
            console.error('Max reconnection attempts reached')
            this.emit('maxReconnectAttemptsReached', { attempts: this.reconnectAttempts })
        }
    }

    /**
     * Send message to WebSocket server
     * @param {string} type - Message type
     * @param {Object} payload - Message payload
     */
    send(type, payload = {}) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({ type, payload })
            this.socket.send(message)
        } else {
            console.warn('WebSocket is not connected')
        }
    }

    /**
     * Subscribe to specific events
     * @param {string} event - Event name
     * @param {Function} callback - Event callback
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, [])
        }
        this.listeners.get(event).push(callback)
    }

    /**
     * Unsubscribe from events
     * @param {string} event - Event name
     * @param {Function} callback - Event callback to remove
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event)
            const index = callbacks.indexOf(callback)
            if (index > -1) {
                callbacks.splice(index, 1)
            }
        }
    }

    /**
     * Emit event to all listeners
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data)
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error)
                }
            })
        }
    }

    /**
     * Subscribe to agent activities
     * @param {Function} callback - Callback for agent activity updates
     */
    subscribeToAgentActivities(callback) {
        this.on('agentActivity', callback)
        // Request current agent status
        this.send('subscribe', { type: 'agent_activities' })
    }

    /**
     * Subscribe to tool executions
     * @param {Function} callback - Callback for tool execution updates
     */
    subscribeToToolExecutions(callback) {
        this.on('toolExecution', callback)
        this.send('subscribe', { type: 'tool_executions' })
    }

    /**
     * Subscribe to conversation updates
     * @param {Function} callback - Callback for conversation updates
     */
    subscribeToConversations(callback) {
        this.on('conversationUpdate', callback)
        this.send('subscribe', { type: 'conversations' })
    }

    /**
     * Subscribe to metrics updates
     * @param {Function} callback - Callback for metrics updates
     */
    subscribeToMetrics(callback) {
        this.on('metricsUpdate', callback)
        this.send('subscribe', { type: 'metrics' })
    }

    /**
     * Subscribe to error reports
     * @param {Function} callback - Callback for error reports
     */
    subscribeToErrors(callback) {
        this.on('errorReport', callback)
        this.send('subscribe', { type: 'errors' })
    }

    /**
     * Disconnect WebSocket
     */
    disconnect() {
        this.stopHeartbeat()
        if (this.socket) {
            this.socket.close(1000, 'Client disconnect')
            this.socket = null
        }
        this.isConnected = false
        this.listeners.clear()
    }

    /**
     * Get connection status
     * @returns {boolean} Connection status
     */
    getConnectionStatus() {
        return this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN
    }
}

// Create singleton instance
const websocketService = new WebSocketService()

export default websocketService