import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

// material-ui
import { Alert, Box, Button, OutlinedInput, Stack, Typography, useTheme, Container, Card, CardContent } from '@mui/material'

// project imports
import { closeSnackbar as closeSnackbarAction, enqueueSnackbar as enqueueSnackbarAction } from '@/store/actions'
import { StyledButton } from '@/ui-component/button/StyledButton'
import { Input } from '@/ui-component/input/Input'
import { BackdropLoader } from '@/ui-component/loading/BackdropLoader'

// API
import accountApi from '@/api/account.api'

// utils
import useNotifier from '@/utils/useNotifier'
import { validatePassword } from '@/utils/validation'

// Icons
import { IconExclamationCircle, IconX } from '@tabler/icons-react'

// ==============================|| ResetPasswordPage ||============================== //

const ResetPasswordPage = () => {
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)
    useNotifier()
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const emailInput = {
        label: 'Email',
        name: 'email',
        type: 'email',
        placeholder: 'user@company.com'
    }

    const passwordInput = {
        label: 'Password',
        name: 'password',
        type: 'password',
        placeholder: '********'
    }

    const confirmPasswordInput = {
        label: 'Confirm Password',
        name: 'confirmPassword',
        type: 'password',
        placeholder: '********'
    }

    const resetPasswordInput = {
        label: 'Reset Token',
        name: 'resetToken',
        type: 'text'
    }

    const [params] = useSearchParams()
    const token = params.get('token')

    const [emailVal, setEmailVal] = useState('')
    const [newPasswordVal, setNewPasswordVal] = useState('')
    const [confirmPasswordVal, setConfirmPasswordVal] = useState('')
    const [tokenVal, setTokenVal] = useState(token ?? '')

    const [loading, setLoading] = useState(false)
    const [authErrors, setAuthErrors] = useState([])

    const goLogin = () => {
        navigate('/signin', { replace: true })
    }

    const validateAndSubmit = async (event) => {
        event.preventDefault()
        const validationErrors = []
        setAuthErrors([])
        if (!tokenVal) {
            validationErrors.push('Token cannot be left blank!')
        }
        if (newPasswordVal !== confirmPasswordVal) {
            validationErrors.push('New Password and Confirm Password do not match.')
        }
        const passwordErrors = validatePassword(newPasswordVal)
        if (passwordErrors.length > 0) {
            validationErrors.push(...passwordErrors)
        }
        if (validationErrors.length > 0) {
            setAuthErrors(validationErrors)
            return
        }
        const body = {
            user: {
                email: emailVal,
                tempToken: tokenVal,
                password: newPasswordVal
            }
        }
        setLoading(true)
        try {
            const updateResponse = await accountApi.resetPassword(body)
            setAuthErrors([])
            setLoading(false)
            if (updateResponse.data) {
                enqueueSnackbar({
                    message: 'Password reset successful',
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
                setEmailVal('')
                setTokenVal('')
                setNewPasswordVal('')
                setConfirmPasswordVal('')
                goLogin()
            }
        } catch (error) {
            setLoading(false)
            setAuthErrors([typeof error.response.data === 'object' ? error.response.data.message : error.response.data])
            enqueueSnackbar({
                message: `Failed to reset password!`,
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
                    ? 'linear-gradient(135deg, #0B1021 0%, #0E1529 45%, #0A56F0 100%)'
                    : 'linear-gradient(135deg, #F8FAFF 0%, #E8F0FF 45%, #FF7A18 100%)',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: customization.isDarkMode
                        ? 'radial-gradient(circle at 20% 80%, rgba(255, 122, 24, 0.16) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(10, 86, 240, 0.18) 0%, transparent 50%)'
                        : 'radial-gradient(circle at 20% 80%, rgba(255, 122, 24, 0.14) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(10, 86, 240, 0.16) 0%, transparent 50%)',
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
                        background: customization.isDarkMode ? 'rgba(14, 21, 41, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                        border: customization.isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                        borderRadius: '24px',
                        boxShadow: customization.isDarkMode
                            ? '0 25px 60px rgba(0, 0, 0, 0.45)'
                            : '0 25px 60px rgba(10, 86, 240, 0.18)',
                        position: 'relative',
                        zIndex: 1
                    }}
                >
                    <CardContent sx={{ p: 4 }}>
                        <Stack flexDirection='column' sx={{ gap: 3 }}>
                            {authErrors && authErrors.length > 0 && (
                                <Alert icon={<IconExclamationCircle />} variant='filled' severity='error'>
                                    <ul style={{ margin: 0 }}>
                                        {authErrors.map((msg, key) => (
                                            <li key={key}>{msg}</li>
                                        ))}
                                    </ul>
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
                                    Reset Password
                                </Typography>
                                <Typography 
                                    variant='body1' 
                                    sx={{ 
                                        color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
                                        maxWidth: '400px'
                                    }}
                                >
                                    <Link 
                                        style={{ 
                                            color: customization.isDarkMode ? '#667eea' : '#764ba2',
                                            textDecoration: 'none',
                                            fontWeight: 600
                                        }} 
                                        to='/signin'
                                    >
                                        Back to Login
                                    </Link>
                                    .
                                </Typography>
                            </Stack>
                            <form onSubmit={validateAndSubmit}>
                                <Stack sx={{ width: '100%', flexDirection: 'column', alignItems: 'left', justifyContent: 'center', gap: 3 }}>
                                    <Box>
                                        <Typography 
                                            sx={{ 
                                                mb: 1,
                                                fontWeight: 600,
                                                color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)'
                                            }}
                                        >
                                            Email<span style={{ color: '#f44336' }}>&nbsp;*</span>
                                        </Typography>
                                        <Input
                                            inputParam={emailInput}
                                            onChange={(newValue) => setEmailVal(newValue)}
                                            value={emailVal}
                                            showDialog={false}
                                        />
                                    </Box>
                                    <Box>
                                        <Typography 
                                            sx={{ 
                                                mb: 1,
                                                fontWeight: 600,
                                                color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)'
                                            }}
                                        >
                                            Reset Token<span style={{ color: '#f44336' }}>&nbsp;*</span>
                                        </Typography>
                                        <OutlinedInput
                                            fullWidth
                                            type='string'
                                            placeholder='Paste in the reset token.'
                                            multiline={true}
                                            rows={3}
                                            onChange={(e) => setTokenVal(e.target.value)}
                                            value={tokenVal}
                                            sx={{
                                                borderRadius: 2,
                                                backgroundColor: customization.isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                                                backdropFilter: 'blur(10px)',
                                                border: customization.isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.3)',
                                                '& .MuiOutlinedInput-notchedOutline': {
                                                    border: 'none'
                                                },
                                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                                    border: 'none'
                                                },
                                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                    border: '2px solid #667eea'
                                                }
                                            }}
                                        />
                                        <Typography 
                                            variant='caption' 
                                            sx={{ 
                                                mt: 0.5,
                                                color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)',
                                                fontStyle: 'italic'
                                            }}
                                        >
                                            Please copy the token you received in your email.
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography 
                                            sx={{ 
                                                mb: 1,
                                                fontWeight: 600,
                                                color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)'
                                            }}
                                        >
                                            New Password<span style={{ color: '#f44336' }}>&nbsp;*</span>
                                        </Typography>
                                        <Input
                                            inputParam={passwordInput}
                                            onChange={(newValue) => setNewPasswordVal(newValue)}
                                            value={newPasswordVal}
                                            showDialog={false}
                                        />
                                        <Typography 
                                            variant='caption' 
                                            sx={{ 
                                                mt: 0.5,
                                                color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)',
                                                fontStyle: 'italic'
                                            }}
                                        >
                                            Password must be at least 8 characters long and contain at least one lowercase letter, one uppercase letter, one digit, and one special character.
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography 
                                            sx={{ 
                                                mb: 1,
                                                fontWeight: 600,
                                                color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)'
                                            }}
                                        >
                                            Confirm Password<span style={{ color: '#f44336' }}>&nbsp;*</span>
                                        </Typography>
                                        <Input
                                            inputParam={confirmPasswordInput}
                                            onChange={(newValue) => setConfirmPasswordVal(newValue)}
                                            value={confirmPasswordVal}
                                            showDialog={false}
                                        />
                                        <Typography 
                                            variant='caption' 
                                            sx={{ 
                                                mt: 0.5,
                                                color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)',
                                                fontStyle: 'italic'
                                            }}
                                        >
                                            Confirm your new password. Must match the password typed above.
                                        </Typography>
                                    </Box>

                                    <StyledButton
                                        variant='contained'
                                        type='submit'
                                        fullWidth
                                        sx={{
                                            height: 48,
                                            borderRadius: 3,
                                            background: 'linear-gradient(135deg, #FF7A18 0%, #0A56F0 100%)',
                                            boxShadow: '0 4px 15px rgba(10, 86, 240, 0.4)',
                                            fontSize: '1rem',
                                            fontWeight: 600,
                                            textTransform: 'none',
                                            transition: 'all 0.3s ease',
                                            '&:hover': {
                                                background: 'linear-gradient(135deg, #e86a12 0%, #094dcc 100%)',
                                                boxShadow: '0 6px 20px rgba(10, 86, 240, 0.6)',
                                                transform: 'translateY(-2px)'
                                            },
                                            '&:active': {
                                                transform: 'translateY(0px)'
                                            }
                                        }}
                                    >
                                        Update Password
                                    </StyledButton>
                                </Stack>
                            </form>
                            <BackdropLoader open={loading} />
                        </Stack>
                    </CardContent>
                </Card>
            </Container>
        </Box>
    )
}

export default ResetPasswordPage
