import { Link } from 'react-router-dom'

// material-ui
import { ButtonBase } from '@mui/material'

// project imports
import Logo from '@/ui-component/extended/Logo'

// ==============================|| MAIN LOGO ||============================== //

const LogoSection = () => (
    <ButtonBase disableRipple component={Link} to='/agentflows'>
        <Logo />
    </ButtonBase>
)

export default LogoSection
