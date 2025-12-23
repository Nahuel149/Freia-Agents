import * as PropTypes from 'prop-types'
import { StyledButton, StyledToggleButton } from '@/ui-component/button/StyledButton'
import { Button, IconButton, ListItemButton, MenuItem, Tab } from '@mui/material'

export const StyledPermissionButton = ({ permissionId, display, ...props }) => {
    // OSS mode: Always show buttons without permission checks
    return <StyledButton {...props} />
}

export const StyledPermissionToggleButton = ({ permissionId, display, ...props }) => {
    // OSS mode: Always show buttons without permission checks
    return <StyledToggleButton {...props} />
}

export const PermissionIconButton = ({ permissionId, display, ...props }) => {
    // OSS mode: Always show buttons without permission checks
    return <IconButton {...props} />
}

export const PermissionButton = ({ permissionId, display, ...props }) => {
    // OSS mode: Always show buttons without permission checks
    return <Button {...props} />
}

export const PermissionTab = ({ permissionId, display, ...props }) => {
    // OSS mode: Always show tabs without permission checks
    return <Tab {...props} />
}

export const PermissionMenuItem = ({ permissionId, display, ...props }) => {
    // OSS mode: Always show menu items without permission checks
    return <MenuItem {...props} />
}

export const PermissionListItemButton = ({ permissionId, display, ...props }) => {
    // OSS mode: Always show list item buttons without permission checks
    return <ListItemButton {...props} />
}

const displayPropType = PropTypes.oneOfType([PropTypes.array, PropTypes.string])

StyledPermissionButton.propTypes = { permissionId: PropTypes.string, display: displayPropType }
StyledPermissionToggleButton.propTypes = { permissionId: PropTypes.string, display: displayPropType }
PermissionIconButton.propTypes = { permissionId: PropTypes.string, display: displayPropType }
PermissionButton.propTypes = { permissionId: PropTypes.string, display: displayPropType }
PermissionTab.propTypes = { permissionId: PropTypes.string, display: displayPropType }
PermissionMenuItem.propTypes = { permissionId: PropTypes.string, display: displayPropType }
PermissionListItemButton.propTypes = { permissionId: PropTypes.string, display: displayPropType }
