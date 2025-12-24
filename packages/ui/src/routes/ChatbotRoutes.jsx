import { lazy } from 'react'

// project imports
import Loadable from '@/ui-component/loading/Loadable'
import MinimalLayout from '@/layout/MinimalLayout'

// canvas routing
const ChatbotFull = Loadable(lazy(() => import('@/views/chatbot')))
const ManualAgentPublicChat = Loadable(lazy(() => import('@/views/manual-agents/PublicManualAgentChat')))

// ==============================|| CANVAS ROUTING ||============================== //

const ChatbotRoutes = {
    path: '/',
    element: <MinimalLayout />,
    children: [
        {
            path: '/chatbot/:id',
            element: <ChatbotFull />
        },
        {
            path: '/manual-agent/:token',
            element: <ManualAgentPublicChat />
        }
    ]
}

export default ChatbotRoutes
