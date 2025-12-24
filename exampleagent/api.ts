// Interfaces matching backend models (routers/chat.py)

/**
 * Input message format expected by the backend.
 */
export interface ChatMessageInput {
    role: 'human' | 'ai' | 'system' // System role might be used for initial prompts if needed
    content: string
}

/**
 * Structure of the request body sent to the chat API endpoint.
 */
export interface ChatRequestBody {
    session_id: string
    messages: ChatMessageInput[]
    currentState?: Record<string, any> | null // Optional state for guided chat
}

/**
 * Structure of the successful response body received from the chat API endpoint.
 */
export interface ChatResponseBody {
    answer: string // The AI's text response
    stateUpdates?: Record<string, any> | null // Updates to the conversation state
    isFinalStep: boolean // Flag indicating guided conversation end
}

// Define a type for messages used within the frontend GuidedChat component
export interface FrontendMessage {
    id: string
    text: string
    sender: 'user' | 'ai'
    timestamp: Date
}

// Placeholder for API base URL - configure this based on your environment
// Use import.meta.env for Vite environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || '' // Default to '' for relative path in production

// TODO: Implement sendChatMessage function (Checklist Item 19)
/**
 * Sends chat messages and current state to the backend API.
 * @param session_id The session ID for the conversation.
 * @param messages Array of messages in the frontend format.
 * @param currentState Current state object for guided conversation.
 * @returns The structured response from the backend.
 */
export const sendChatMessage = async (
    session_id: string,
    messages: FrontendMessage[],
    currentState: Record<string, any> | null
): Promise<ChatResponseBody> => {
    // Convert frontend messages to the backend input format
    const backendMessages: ChatMessageInput[] = messages.map((msg) => ({
        role: msg.sender === 'user' ? 'human' : 'ai',
        content: msg.text
    }))

    const requestBody: ChatRequestBody = {
        session_id,
        messages: backendMessages,
        // Always send the state object, let backend handle interpretation
        currentState: currentState
    }

    const apiUrl = API_BASE_URL ? `${API_BASE_URL}/api/chat/rag` : '/api/chat/rag' // Use relative path when no env URL

    try {
        console.log('Sending chat request:', requestBody)
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // Add Authorization header if your API requires authentication
                // 'Authorization': `Bearer ${your_auth_token}`,
            },
            body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
            // Attempt to read error details from response body
            let errorDetail = `HTTP error! status: ${response.status}`
            try {
                const errorData = await response.json()
                errorDetail = errorData.detail || JSON.stringify(errorData) || errorDetail
            } catch (e) {
                // Ignore if response body is not JSON or empty
            }
            console.error('API Error Response:', errorDetail)
            throw new Error(`API request failed: ${errorDetail}`)
        }

        // Ensure we received JSON response
        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('application/json')) {
            const invalidBody = await response.text()
            console.error('Invalid JSON response:', contentType, invalidBody)
            throw new Error('Invalid response format: expected JSON')
        }

        // Attempt to parse JSON response, handling empty or invalid JSON
        const text = await response.text()
        let responseData: ChatResponseBody
        try {
            responseData = text ? JSON.parse(text) : { answer: '', stateUpdates: null, isFinalStep: false }
        } catch (e) {
            console.error('Error parsing JSON response:', e, text)
            throw new Error(`Failed to parse JSON response: ${e}`)
        }
        console.log('Received chat response:', responseData)
        return responseData
    } catch (error) {
        console.error('Error sending chat message:', error)
        // Re-throw the error so the component can handle it (e.g., display error message)
        throw error
    }
}
