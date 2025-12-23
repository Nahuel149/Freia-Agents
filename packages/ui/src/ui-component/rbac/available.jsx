import PropTypes from 'prop-types'

export const Available = ({ permission, children }) => {
    // OSS mode: Always show children without permission checks
    return children
}

Available.propTypes = {
    permission: PropTypes.string,
    children: PropTypes.element
}
