import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import { useLocation } from 'react-router-dom'
import { useConfig } from '@/store/context/ConfigContext'
import { useAuth } from '@/hooks/useAuth'
import { useSelector } from 'react-redux'
import { BackdropLoader } from '@/ui-component/loading/BackdropLoader'

/**
 * Checks if a feature flag is enabled
 * @param {Object} features - Feature flags object
 * @param {string} display - Feature flag key to check
 * @param {React.ReactElement} children - Components to render if feature is enabled
 * @returns {React.ReactElement} Children or unauthorized redirect
 */
const checkFeatureFlag = (features, display, children, redirectState) => {
    // Validate features object exists and is properly formatted
    if (!features || Array.isArray(features) || Object.keys(features).length === 0) {
        return <Navigate to='/unauthorized' replace state={redirectState} />
    }

    // Check if feature flag exists and is enabled
    if (Object.hasOwnProperty.call(features, display)) {
        const isFeatureEnabled = features[display] === 'true' || features[display] === true
        return isFeatureEnabled ? children : <Navigate to='/unauthorized' replace state={redirectState} />
    }

    return <Navigate to='/unauthorized' replace state={redirectState} />
}

export const RequireAuth = ({ permission, display, children }) => {
    const location = useLocation()
    // OSS mode: Enterprise license checks removed
    const { isCloud, isOpenSource } = useConfig()
    const { hasPermission } = useAuth()
    const isGlobal = useSelector((state) => state.auth.isGlobal)
    const currentUser = useSelector((state) => state.auth.user)
    const features = useSelector((state) => state.auth.features)
    const permissions = useSelector((state) => state.auth.permissions)
    const unauthorizedState = { path: location.pathname }
    const [featureTimeoutReached, setFeatureTimeoutReached] = useState(false)
    const isFeatureCheckPending = isCloud && display && (features === null || typeof features === 'undefined')

    useEffect(() => {
        if (isFeatureCheckPending) {
            setFeatureTimeoutReached(false)
            const timeoutId = setTimeout(() => {
                setFeatureTimeoutReached(true)
            }, 1200)

            return () => clearTimeout(timeoutId)
        }

        setFeatureTimeoutReached(false)
    }, [isFeatureCheckPending])

    // Step 1: Authentication Check
    // Redirect to login if user is not authenticated
    if (!currentUser) {
        return <Navigate to='/login' replace state={{ path: location.pathname }} />
    }

    // Step 2: Deployment Type Specific Logic
    // Open Source: Allow access to everything
    if (isOpenSource) {
        return children
    }

    if (isFeatureCheckPending) {
        if (!featureTimeoutReached) {
            return <BackdropLoader open />
        }

        return <Navigate to='/unauthorized' replace state={unauthorizedState} />
    }

    // OSS mode: Enterprise license checks removed - Cloud only
    if (isCloud) {
        // Allow access to basic features (no display property)
        if (!display) return children

        // Check if user has any permissions
        if (!Array.isArray(permissions) || permissions.length === 0) {
            return <Navigate to='/unauthorized' replace state={unauthorizedState} />
        }

        // OSS mode: Simplified permission checks without organization concepts

        // Check user permissions and feature flags
        if (!permission || hasPermission(permission)) {
            return checkFeatureFlag(features, display, children, unauthorizedState)
        }

        return <Navigate to='/unauthorized' replace state={unauthorizedState} />
    }

    // Fallback: Allow access if none of the above conditions match
    return children
}

RequireAuth.propTypes = {
    permission: PropTypes.string,
    display: PropTypes.string,
    children: PropTypes.element
}
