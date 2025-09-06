import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'

// material-ui
import { Alert, Box, Stack, Typography, useTheme, Container, Card, CardContent } from '@mui/material'

// project imports
import { StyledButton } from '@/ui-component/button/StyledButton'
import MainCard from '@/ui-component/cards/MainCard'
import { Input } from '@/ui-component/input/Input'
import { BackdropLoader } from '@/ui-component/loading/BackdropLoader'

// API
import accountApi from '@/api/account.api'

// Hooks
import useApi from '@/hooks/useApi'
import { useConfig } from '@/store/context/ConfigContext'

// utils
import useNotifier from '@/utils/useNotifier'

// Icons
import { IconCircleCheck, IconExclamationCircle } from '@tabler/icons-react'

// ==============================|| ForgotPasswordPage ||============================== //

const ForgotPasswordPage = () => {
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)
    useNotifier()

    const usernameInput = {
        label: 'Username',
        name: 'username',
        type: 'email',
        placeholder: 'user@company.com'
    }
    const [usernameVal, setUsernameVal] = useState('')
    const { isEnterpriseLicensed } = useConfig()

    const [isLoading, setLoading] = useState(false)
    const [responseMsg, setResponseMsg] = useState(undefined)

    const forgotPasswordApi = useApi(accountApi.forgotPassword)

    const sendResetRequest = async (event) => {
        event.preventDefault()
        const body = {
            user: {
                email: usernameVal
            }
        }
        setLoading(true)
        await forgotPasswordApi.request(body)
    }

    useEffect(() => {
        if (forgotPasswordApi.error) {
            const errMessage =
                typeof forgotPasswordApi.error.response.data === 'object'
                    ? forgotPasswordApi.error.response.data.message
                    : forgotPasswordApi.error.response.data
            setResponseMsg({
                type: 'error',
                msg: errMessage ?? 'Failed to send instructions, please contact your administrator.'
            })
            setLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [forgotPasswordApi.error])

    useEffect(() => {
        if (forgotPasswordApi.data) {
            setResponseMsg({
                type: 'success',
                msg: 'Password reset instructions sent to the email.'
            })
            setLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [forgotPasswordApi.data])

    return (
        <Box
            sx={{
                minHeight: '100vh',
                width: '100vw',
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: customization.isDarkMode
                    ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: customization.isDarkMode
                        ? 'radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%)'
                        : 'radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.3) 0%, transparent 50%)',
                    pointerEvents: 'none'
                },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 2,
                overflow: 'auto'
            }}
        >
            <Container maxWidth="sm">
                <Card
                    sx={{
                        backdropFilter: 'blur(20px)',
                        background: customization.isDarkMode
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(255, 255, 255, 0.25)',
                        border: customization.isDarkMode
                            ? '1px solid rgba(255, 255, 255, 0.1)'
                            : '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: 4,
                        boxShadow: customization.isDarkMode
                            ? '0 8px 32px rgba(0, 0, 0, 0.3)'
                            : '0 8px 32px rgba(0, 0, 0, 0.1)',
                        position: 'relative',
                        zIndex: 1
                    }}
                >
                    <CardContent sx={{ p: 4 }}>
                        <Stack flexDirection='column' sx={{ gap: 3 }}>
                    {responseMsg && responseMsg?.type === 'error' && (
                        <Alert icon={<IconExclamationCircle />} variant='filled' severity='error'>
                            {responseMsg.msg}
                        </Alert>
                    )}
                    {responseMsg && responseMsg?.type !== 'error' && (
                        <Alert icon={<IconCircleCheck />} variant='filled' severity='success'>
                            {responseMsg.msg}
                        </Alert>
                    )}
                            <Stack sx={{ gap: 2, alignItems: 'center', textAlign: 'center', mb: 1 }}>
                                <Typography 
                                    variant='h3' 
                                    sx={{ 
                                        fontWeight: 700,
                                        fontSize: { xs: '1.75rem', sm: '2rem' },
                                        background: customization.isDarkMode
                                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        backgroundClip: 'text',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        mb: 1
                                    }}
                                >
                                    Forgot Password?
                                </Typography>
                                <Typography 
                                    variant='body1' 
                                    sx={{ 
                                        color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
                                        maxWidth: '400px'
                                    }}
                                >
                                    Have a reset password code?{' '}
                                    <Link 
                                        style={{ 
                                            color: customization.isDarkMode ? '#667eea' : '#764ba2',
                                            textDecoration: 'none',
                                            fontWeight: 600
                                        }} 
                                        to='/reset-password'
                                    >
                                        Change your password here
                                    </Link>
                                    .
                                </Typography>
                            </Stack>
                            <form onSubmit={sendResetRequest}>
                                <Stack sx={{ width: '100%', flexDirection: 'column', alignItems: 'left', justifyContent: 'center', gap: 3 }}>
                                    <Box sx={{ mb: 1 }}>
                                        <Typography 
                                            variant='body1' 
                                            sx={{ 
                                                mb: 1.5,
                                                fontWeight: 600,
                                                color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)'
                                            }}
                                        >
                                            Email<span style={{ color: '#f44336' }}>&nbsp;*</span>
                                        </Typography>
                                        <Input
                                            inputParam={usernameInput}
                                            onChange={(newValue) => setUsernameVal(newValue)}
                                            value={usernameVal}
                                            showDialog={false}
                                        />
                                        {isEnterpriseLicensed && (
                                            <Typography 
                                                variant='caption' 
                                                sx={{ 
                                                    mt: 0.5,
                                                    color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)',
                                                    fontStyle: 'italic'
                                                }}
                                            >
                                                If you forgot the email you used for signing up, please contact your administrator.
                                            </Typography>
                                        )}
                                    </Box>
                                    <StyledButton
                                        variant='contained'
                                        disabled={!usernameVal}
                                        type='submit'
                                        fullWidth
                                        sx={{
                                            height: 48,
                                            borderRadius: 3,
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                                            fontSize: '1rem',
                                            fontWeight: 600,
                                            textTransform: 'none',
                                            transition: 'all 0.3s ease',
                                            '&:hover': {
                                                background: 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)',
                                                boxShadow: '0 6px 20px rgba(102, 126, 234, 0.6)',
                                                transform: 'translateY(-2px)'
                                            },
                                            '&:active': {
                                                transform: 'translateY(0px)'
                                            }
                                        }}
                                    >
                                        Send Reset Password Instructions
                                    </StyledButton>
                                </Stack>
                            </form>
                            <BackdropLoader open={isLoading} />
                        </Stack>
                    </CardContent>
                </Card>
            </Container>
        </Box>
    )
}

export default ForgotPasswordPage
