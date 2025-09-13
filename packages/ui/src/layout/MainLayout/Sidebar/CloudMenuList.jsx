import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'
import { store } from '@/store'

// material-ui
import { Divider, Box, Button, List, ListItemButton, ListItemIcon, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import useNotifier from '@/utils/useNotifier'
import { useConfig } from '@/store/context/ConfigContext'

// API
import { logoutSuccess } from '@/store/reducers/authSlice'

// Hooks
import useApi from '@/hooks/useApi'

// icons
import { IconFileText, IconLogout, IconX } from '@tabler/icons-react'
import accountApi from '@/api/account.api'

const CloudMenuList = () => {
    const customization = useSelector((state) => state.customization)
    const dispatch = useDispatch()
    useNotifier()
    const theme = useTheme()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const logoutApi = useApi(accountApi.logout)
    const { isCloud } = useConfig()

    const signOutClicked = () => {
        logoutApi.request()
        enqueueSnackbar({
            message: 'Logging out...',
            options: {
                key: new Date().getTime() + Math.random(),
                variant: 'success',
                action: (key) => (
                    <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                        <IconX />
                    </Button>
                )
            }
        })
    }

    useEffect(() => {
        try {
            if (logoutApi.data && logoutApi.data.message === 'logged_out') {
                store.dispatch(logoutSuccess())
                window.location.href = logoutApi.data.redirectUrl
            }
        } catch (e) {
            console.error(e)
        }
    }, [logoutApi.data])

    return null
}

export default CloudMenuList
