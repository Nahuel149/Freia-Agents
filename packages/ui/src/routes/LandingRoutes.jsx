import { lazy } from 'react'
import { Navigate } from 'react-router-dom'
import Loadable from '@/ui-component/loading/Loadable'
import MinimalLayout from '@/layout/MinimalLayout'

const LandingPage = Loadable(lazy(() => import('@/views/landing')))
const DemoHoteles = Loadable(lazy(() => import('@/views/landing/demo-hoteles')))

const LandingRoutes = {
    path: '/',
    element: <MinimalLayout />,
    children: [
        {
            path: '/',
            element: <LandingPage />
        },
        {
            path: '/demo/hoteles',
            element: <Navigate to='/demo/hotel-gran-sol' replace />
        },
        {
            path: '/demo/:landingId',
            element: <DemoHoteles />
        }
    ]
}

export default LandingRoutes
