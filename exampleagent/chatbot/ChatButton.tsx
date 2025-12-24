import React from 'react'
import { FaRobot, FaTimes } from 'react-icons/fa'

interface ChatButtonProps {
    isOpen: boolean
    onClick: () => void
}

export const ChatButton: React.FC<ChatButtonProps> = ({ isOpen, onClick }) => {
    // Example colors - adjust to your app's theme
    const primaryColor = '#007bff' // Example primary blue
    const hoverColor = '#0056b3' // Darker blue for hover
    const openBgColor = '#dc3545' // Example red when open
    const openHoverBgColor = '#c82333' // Darker red for hover

    return (
        <button
            className={`fixed bottom-6 left-6 rounded-full w-14 h-14 flex items-center justify-center shadow-lg z-50 transition-all duration-300 ${
                isOpen
                    ? 'bg-red-500 hover:bg-red-600' // Keep open state red
                    : 'bg-red-500 hover:bg-red-700' // Change default state to red (adjust shade if desired)
            }`}
            onClick={onClick}
            aria-label={isOpen ? 'Close Chat Assistant' : 'Open Chat Assistant'}
        >
            {isOpen ? <FaTimes className='text-white text-xl' /> : <FaRobot className='text-white text-xl' />}
        </button>
    )
}
