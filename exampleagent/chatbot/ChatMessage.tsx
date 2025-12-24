import React from 'react'
import { FaRobot, FaUser } from 'react-icons/fa'

export interface ChatMessageProps {
    message: string
    sender: 'user' | 'ai'
    timestamp?: Date // Optional timestamp
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
    message,
    sender,
    timestamp = new Date() // Default to now if not provided
}) => {
    const isUser = sender === 'user'

    // Basic styling - enhance with Tailwind or CSS modules as needed
    const messageClass = isUser
        ? 'bg-red-500 text-white self-end' // User messages: Red background
        : 'bg-gray-200 text-gray-800 self-start' // AI messages: Gray background

    const icon = isUser ? (
        <FaUser className='mr-2 text-red-200' /> // Adjusted icon color for red bg
    ) : (
        <FaRobot className='mr-2 text-gray-500' />
    )

    const containerClass = isUser ? 'justify-end' : 'justify-start'

    return (
        <div className={`flex ${containerClass} mb-3`}>
            {!isUser && <div className='w-8'>{icon}</div>} {/* Icon for AI */}
            <div className={`max-w-[75%] p-3 rounded-lg shadow ${messageClass}`}>
                <p className='text-sm'>{message}</p>
                {/* Optional: Display timestamp */}
                {/* <span className="text-xs opacity-70 block mt-1">{
          timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }</span> */}
            </div>
            {isUser && <div className='w-8 ml-2'>{icon}</div>} {/* Icon for User */}
        </div>
    )
}
