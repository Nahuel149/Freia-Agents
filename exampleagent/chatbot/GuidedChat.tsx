import React, { useState, useRef, useEffect, useCallback } from 'react'
import { FaPaperPlane, FaRobot, FaSpinner } from 'react-icons/fa'
import { ChatMessage } from './ChatMessage'
import { ChatButton } from './ChatButton'
import { sendChatMessage, FrontendMessage, ChatResponseBody } from '../../services/api' // Assuming api.ts is in src/services
import { v4 as uuidv4 } from 'uuid'

const API_URL = import.meta.env.VITE_API_URL || ''

// Initial state for the guided conversation
const INITIAL_CONVERSATION_STATE: Record<string, any> = {
    currentQuestionIndex: 0, // Start with the first question
    // Add other expected keys with null/default values if needed by the prompt
    userName: null,
    locationType: null,
    needsWifi: null,
    needsCCTV: null,
    needsNetworkDesign: null,
    additionalInfo: null
}

export const GuidedChat: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false) // Start closed by default
    const [sessionId, setSessionId] = useState<string>('')
    const [messages, setMessages] = useState<FrontendMessage[]>([])
    const [input, setInput] = useState('')
    const [isAIThinking, setIsAIThinking] = useState(false)
    const [conversationState, setConversationState] = useState<Record<string, any>>(INITIAL_CONVERSATION_STATE)
    const [error, setError] = useState<string | null>(null)
    const [isBackendReady, setIsBackendReady] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Effect to set initial greeting when chat opens and messages are empty
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            if (!sessionId) {
                setSessionId(uuidv4())
            }
            const initialGreetingMessage: FrontendMessage = {
                id: 'initial-ai-greeting',
                text: "Hello! I'm a Smart Wifi Access agent. To start, what's your name?",
                sender: 'ai',
                timestamp: new Date()
            }
            setMessages([initialGreetingMessage])
            setConversationState(INITIAL_CONVERSATION_STATE) // Reset state on open if empty
            setError(null) // Clear errors on open if empty
        }
        // Optional: Consider if state/messages should *always* reset on reopen,
        // or only if messages are empty (current logic).
    }, [isOpen]) // Dependency: run when isOpen changes

    // Effect to scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Effect to focus input when chat opens
    useEffect(() => {
        if (isOpen) {
            // Timeout needed to allow the element to become visible after state change
            const timer = setTimeout(() => {
                inputRef.current?.focus()
            }, 100)
            return () => clearTimeout(timer)
        }
    }, [isOpen])

    // --- Backend Readiness Polling ---
    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null

        const checkBackendStatus = async () => {
            try {
                const response = await fetch(`${API_URL}/api/health`)
                if (response.ok) {
                    const data = await response.json()
                    if (data.status === 'ready') {
                        setIsBackendReady(true)
                        console.log('Chat backend is ready.')
                        if (intervalId) clearInterval(intervalId) // Stop polling
                    } else {
                        console.log('Chat backend is starting...')
                    }
                } else {
                    // Handle non-200 responses (e.g., 503 during startup)
                    console.log(`Chat backend status: ${response.status}`)
                }
            } catch (err) {
                console.error('Error checking backend health:', err)
                // Keep polling even if there's an error, backend might come up
            }
        }

        // Start polling immediately and then every 2 seconds
        checkBackendStatus()
        intervalId = setInterval(checkBackendStatus, 2000)

        // Cleanup on unmount
        return () => {
            if (intervalId) clearInterval(intervalId)
        }
    }, []) // Empty dependency array ensures this runs only on mount

    // --- TODO: Implement toggleChat (Checklist 15) ---
    const toggleChat = () => {
        setIsOpen(!isOpen)
        // Reset state if closing and re-opening, or manage persistence
        if (!isOpen) {
            // Optional: Reset messages and state when opening
            // setMessages([]); // Clears history on reopen
            // setConversationState(INITIAL_CONVERSATION_STATE);
            // setError(null);
            // Effect will trigger to add initial message if messages are empty
        }
    }

    // --- TODO: Implement handleSendMessage (Checklist 16) ---
    const handleSendMessage = async () => {
        const trimmedInput = input.trim()
        if (!trimmedInput || isAIThinking) {
            return // Don't send empty messages or while AI is thinking
        }

        setError(null) // Clear previous errors
        const newUserMessage: FrontendMessage = {
            id: Date.now().toString() + '-user',
            text: trimmedInput,
            sender: 'user',
            timestamp: new Date()
        }

        // Add user message optimistically
        setMessages((prevMessages) => [...prevMessages, newUserMessage])
        setInput('')
        setIsAIThinking(true)

        // Prepare messages for API (include the new user message)
        const messagesForApi = [...messages, newUserMessage]

        try {
            // Call the API service
            const response: ChatResponseBody = await sendChatMessage(sessionId, messagesForApi, conversationState)

            // Create AI response message
            const aiResponseMessage: FrontendMessage = {
                id: Date.now().toString() + '-ai',
                text: response.answer,
                sender: 'ai',
                timestamp: new Date()
            }

            // Add AI message to state
            setMessages((prevMessages) => [...prevMessages, aiResponseMessage])

            // Update conversation state if updates are provided
            if (response.stateUpdates) {
                // Increment index if not the final step, based on backend logic
                const currentIdx = conversationState?.currentQuestionIndex ?? 0
                const nextIdx = response.isFinalStep ? currentIdx : currentIdx + 1

                const newState = {
                    ...conversationState,
                    ...response.stateUpdates,
                    currentQuestionIndex: nextIdx
                }
                setConversationState(newState)
                console.log('Updated Conversation State:', newState)
            }

            if (response.isFinalStep) {
                console.log('Guided conversation marked as final step.')
                // Optionally: Add a final concluding message from the UI
                // Or disable input, show summary, etc.
            }
        } catch (err: any) {
            console.error('Error in handleSendMessage:', err)
            const errorMsg = err.message || 'An unknown error occurred.'
            setError(`Failed to get response: ${errorMsg}`)
            // Optionally remove the optimistic user message or add an error indicator
            // Example: Add an error message to the chat
            const errorMessage: FrontendMessage = {
                id: Date.now().toString() + '-error',
                text: `Sorry, I encountered an error: ${errorMsg}`,
                sender: 'ai',
                timestamp: new Date()
            }
            setMessages((prevMessages) => [...prevMessages, errorMessage])
        } finally {
            setIsAIThinking(false)
            // Refocus input after AI responds
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }

    // --- TODO: Implement handleKeyPress (Checklist 17) ---
    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !isAIThinking && input.trim() !== '') {
            e.preventDefault() // Prevent default form submission
            handleSendMessage()
        }
    }

    // Basic JSX structure
    return (
        <>
            <ChatButton isOpen={isOpen} onClick={toggleChat} />
            <div
                className={`fixed bottom-24 left-6 w-96 h-[500px] bg-white rounded-lg shadow-xl z-40 flex flex-col transition-transform duration-300 ease-out transform ${
                    isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
                }`}
                style={{ visibility: isOpen ? 'visible' : 'hidden' }} // Use visibility for focus management
            >
                {/* Header */}
                <div className='bg-red-600 rounded-t-lg p-3 text-white flex items-center justify-between'>
                    <div className='flex items-center'>
                        <FaRobot className='mr-2' />
                        <h3 className='font-semibold text-sm'>Smart Wifi Access Live Agent</h3>
                    </div>
                    <button onClick={toggleChat} aria-label='Close chat' className='text-red-200 hover:text-white'>
                        &times; {/* Simple close icon */}
                    </button>
                </div>

                {/* Messages */}
                <div className='flex-1 p-4 overflow-y-auto bg-gray-50'>
                    {messages.map((msg) => (
                        <ChatMessage key={msg.id} message={msg.text} sender={msg.sender} timestamp={msg.timestamp} />
                    ))}
                    {isAIThinking && (
                        <div className='flex justify-start mb-3'>
                            <FaSpinner className='animate-spin mr-2 text-gray-500' />
                            <span className='text-sm text-gray-500'>Assistant is typing...</span>
                        </div>
                    )}
                    {error && <div className='text-red-500 text-sm p-2 bg-red-100 rounded mt-2'>Error: {error}</div>}
                    <div ref={messagesEndRef} /> {/* Anchor for scrolling */}
                </div>

                {/* Input */}
                <div className='p-3 border-t border-gray-200 bg-white'>
                    <div className='flex items-center'>
                        <input
                            ref={inputRef}
                            type='text'
                            className='flex-1 border border-gray-300 rounded-l-md p-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-500'
                            placeholder='Type your message...'
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            disabled={isAIThinking || !isBackendReady}
                        />
                        <button
                            onClick={handleSendMessage}
                            className='bg-red-500 text-white p-2 h-9 flex items-center rounded-r-md hover:bg-red-600 disabled:opacity-50'
                            disabled={isAIThinking || !isBackendReady || input.trim() === ''}
                            aria-label='Send message'
                        >
                            <FaPaperPlane />
                        </button>
                    </div>
                    {!isBackendReady && (
                        <div className='mt-2 text-center text-gray-500 text-sm'>Connecting to Smart Wifi Access agent...</div>
                    )}
                    {error && <div className='mt-2 p-2 text-red-600 text-sm bg-red-100 rounded'>Error: {error}</div>}
                </div>
            </div>
        </>
    )
}
