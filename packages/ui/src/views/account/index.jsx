import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'

// utils
import useNotifier from '@/utils/useNotifier'
import { validatePassword } from '@/utils/validation'

// material-ui
import {
    Box,
    OutlinedInput,
    Skeleton,
    Stack,
    Typography
} from '@mui/material'
// OSS Mode: Removed unused Material-UI imports for billing dialogs
import { darken, useTheme } from '@mui/material/styles'

// project imports
import ErrorBoundary from '@/ErrorBoundary'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import { StyledButton } from '@/ui-component/button/StyledButton'
import MainCard from '@/ui-component/cards/MainCard'
import SettingsSection from '@/ui-component/form/settings'
// OSS mode: PricingDialog removed

// Icons
import { IconX } from '@tabler/icons-react'

// API
import userApi from '@/api/user'
// OSS Mode: Removed billing-related API imports (accountApi, pricingApi)

// Hooks
import useApi from '@/hooks/useApi'

// Store
import { store } from '@/store'
import { closeSnackbar as closeSnackbarAction, enqueueSnackbar as enqueueSnackbarAction } from '@/store/actions'
import { gridSpacing } from '@/store/constant'
import { useConfig } from '@/store/context/ConfigContext'
import { useError } from '@/store/context/ErrorContext'
import { userProfileUpdated } from '@/store/reducers/authSlice'

// ==============================|| ACCOUNT SETTINGS ||============================== //

const calculatePercentage = (count, total) => {
    return Math.min((count / total) * 100, 100)
}

const AccountSettings = () => {
    const theme = useTheme()
    const dispatch = useDispatch()
    useNotifier()
    const navigate = useNavigate()

    const currentUser = useSelector((state) => state.auth.user)
    const customization = useSelector((state) => state.customization)

    const { error, setError } = useError()
    const { isCloud } = useConfig()

    const [isLoading, setLoading] = useState(true)
    const [profileName, setProfileName] = useState('')
    const [email, setEmail] = useState('')
    const [migrateEmail, setMigrateEmail] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    // OSS Mode: Billing, usage, and seats management removed
    const [isMigrateLoading, setIsMigrateLoading] = useState(false)

    // OSS Mode: Usage calculations removed

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const getUserByIdApi = useApi(userApi.getMe)
    // OSS Mode: Billing and subscription APIs removed

    useEffect(() => {
        getUserByIdApi.request()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        setLoading(getUserByIdApi.loading)
    }, [getUserByIdApi.loading])

    useEffect(() => {
        try {
            if (getUserByIdApi.data) {
                setProfileName(getUserByIdApi.data?.name || '')
                setEmail(getUserByIdApi.data?.email || '')
                setMigrateEmail(getUserByIdApi.data?.email || '')
            }
        } catch (e) {
            console.error(e)
        }
    }, [getUserByIdApi.data])

    // OSS Mode: Billing and subscription useEffect hooks removed

    // OSS Mode: Current plan title removed

    // OSS Mode: Billing and subscription functions removed

    const saveProfileData = async () => {
        try {
            const obj = {
                id: currentUser.id,
                name: profileName,
                email: email
            }
            const saveProfileResp = await userApi.updateUser(obj)
            if (saveProfileResp.data) {
                store.dispatch(userProfileUpdated(saveProfileResp.data))
                enqueueSnackbar({
                    message: 'Profile updated',
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
        } catch (error) {
            setError(error)
            enqueueSnackbar({
                message: `Failed to update profile: ${
                    typeof error.response.data === 'object' ? error.response.data.message : error.response.data
                }`,
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    persist: true,
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
        }
    }

    const savePassword = async () => {
        try {
            const validationErrors = []
            if (newPassword !== confirmPassword) {
                validationErrors.push('New Password and Confirm Password do not match')
            }
            const passwordErrors = validatePassword(newPassword)
            if (passwordErrors.length > 0) {
                validationErrors.push(...passwordErrors)
            }
            if (validationErrors.length > 0) {
                enqueueSnackbar({
                    message: validationErrors.join(', '),
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'error',
                        persist: true,
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
                return
            }

            const obj = {
                id: currentUser.id,
                password: newPassword
            }
            const saveProfileResp = await userApi.updateUser(obj)
            if (saveProfileResp.data) {
                store.dispatch(userProfileUpdated(saveProfileResp.data))
                enqueueSnackbar({
                    message: 'Password updated',
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
        } catch (error) {
            setError(error)
            enqueueSnackbar({
                message: `Failed to update password: ${
                    typeof error.response.data === 'object' ? error.response.data.message : error.response.data
                }`,
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    persist: true,
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
        }
    }

    // OSS Mode: Seats management functions removed

    return (
        <MainCard maxWidth='md'>
            {error ? (
                <ErrorBoundary error={error} />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 4 }}>
                    <ViewHeader title='Account Settings' />
                    {isLoading && !getUserByIdApi.data ? (
                        <Box display='flex' flexDirection='column' gap={gridSpacing}>
                            <Skeleton width='25%' height={32} />
                            <Box display='flex' flexDirection='column' gap={2}>
                                <Skeleton width='20%' />
                                <Skeleton variant='rounded' height={56} />
                            </Box>
                            <Box display='flex' flexDirection='column' gap={2}>
                                <Skeleton width='20%' />
                                <Skeleton variant='rounded' height={56} />
                            </Box>
                            <Box display='flex' flexDirection='column' gap={2}>
                                <Skeleton width='20%' />
                                <Skeleton variant='rounded' height={56} />
                            </Box>
                        </Box>
                    ) : (
                        <>
                            {/* OSS mode: Subscription & Billing section removed for open source */}
                            {/* OSS mode: Seats section removed for open source */}
                            {/* OSS mode: Usage section removed for open source */}
                            <SettingsSection
                                action={
                                    <StyledButton onClick={saveProfileData} sx={{ borderRadius: 2, height: 40 }} variant='contained'>
                                        Save
                                    </StyledButton>
                                }
                                title='Profile'
                            >
                                <Box
                                    sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: gridSpacing,
                                        px: 2.5,
                                        py: 2
                                    }}
                                >
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <Typography variant='body1'>Name</Typography>
                                        <OutlinedInput
                                            id='name'
                                            type='string'
                                            fullWidth
                                            placeholder='Your Name'
                                            name='name'
                                            onChange={(e) => setProfileName(e.target.value)}
                                            value={profileName}
                                        />
                                    </Box>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <Typography variant='body1'>Email Address</Typography>
                                        <OutlinedInput
                                            id='email'
                                            type='string'
                                            fullWidth
                                            placeholder='Email Address'
                                            name='email'
                                            onChange={(e) => setEmail(e.target.value)}
                                            value={email}
                                        />
                                    </Box>
                                </Box>
                            </SettingsSection>
                            {!currentUser.isSSO && (
                                <SettingsSection
                                    action={
                                        <StyledButton
                                            disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword}
                                            onClick={savePassword}
                                            sx={{ borderRadius: 2, height: 40 }}
                                            variant='contained'
                                        >
                                            Save
                                        </StyledButton>
                                    }
                                    title='Security'
                                >
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: gridSpacing,
                                            px: 2.5,
                                            py: 2
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                gridColumn: 'span 2 / span 2',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 1
                                            }}
                                        >
                                            <Typography variant='body1'>New Password</Typography>
                                            <OutlinedInput
                                                id='newPassword'
                                                type='password'
                                                fullWidth
                                                placeholder='New Password'
                                                name='newPassword'
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                value={newPassword}
                                            />
                                            <Typography variant='caption'>
                                                <i>
                                                    Password must be at least 8 characters long and contain at least one lowercase letter,
                                                    one uppercase letter, one digit, and one special character.
                                                </i>
                                            </Typography>
                                        </Box>
                                        <Box
                                            sx={{
                                                gridColumn: 'span 2 / span 2',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 1
                                            }}
                                        >
                                            <Typography variant='body1'>Confirm Password</Typography>
                                            <OutlinedInput
                                                id='confirmPassword'
                                                type='password'
                                                fullWidth
                                                placeholder='Confirm Password'
                                                name='confirmPassword'
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                value={confirmPassword}
                                            />
                                        </Box>
                                    </Box>
                                </SettingsSection>
                            )}
                            {/* OSS Mode: Subscription migration section removed */}
                        </>
                    )}
                </Stack>
            )}
            {/* OSS mode: PricingDialog removed */}
            {/* OSS Mode: Removed seats management dialogs */}
            {/* OSS Mode: Removed all billing dialog content */}
            {/* OSS Mode: Removed remaining billing dialog content */}
            {/* OSS Mode: Removed all remaining billing dialogs */}
        </MainCard>
    )
}

export default AccountSettings
