import PropTypes from 'prop-types'
import { useAuth } from '@/hooks/useAuth'

export const Available = ({ permission, children }) => {
    // OSS mode: Always show children without permission checks
    return children
}

Available.propTypes = {
    permission: PropTypes.string,
    children: PropTypes.element
}
