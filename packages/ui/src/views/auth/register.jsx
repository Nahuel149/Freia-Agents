import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'

// material-ui
import { Alert, Box, Button, Divider, List, ListItemText, Stack, Typography, useTheme, Container, Card, CardContent } from '@mui/material'

// project imports
import { StyledButton } from '@/ui-component/button/StyledButton'
import { Input } from '@/ui-component/input/Input'
import { BackdropLoader } from '@/ui-component/loading/BackdropLoader'
import { useSelector } from 'react-redux'

// API
import accountApi from '@/api/account.api'
import loginMethodApi from '@/api/loginmethod'
import ssoApi from '@/api/sso'

// Hooks
import useApi from '@/hooks/useApi'
import { useConfig } from '@/store/context/ConfigContext'

// utils
import useNotifier from '@/utils/useNotifier'
import { passwordSchema } from '@/utils/validation'

import { store } from '@/store'
import { loginSuccess } from '@/store/reducers/authSlice'
import { IconCircleCheck, IconExclamationCircle } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

// ==============================|| Register ||============================== //

const RegisterCloudUserSchema = z
    .object({
        username: z.string().min(1, 'Name is required'),
        email: z.string().min(1, 'Email is required').email('Invalid email address'),
        password: passwordSchema,
        confirmPassword: z.string().min(1, 'Confirm Password is required')
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ['confirmPassword']
    })

const RegisterPage = () => {
    const theme = useTheme()
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const notifier = useNotifier()
    const customization = useSelector((state) => state.customization)

    const usernameInput = {
        label: t('auth.register.displayName'),
        name: 'username',
        type: 'text',
        placeholder: 'John Doe'
    }

    const passwordInput = {
        label: t('auth.register.password'),
        name: 'password',
        type: 'password',
        placeholder: '********'
    }

    const confirmPasswordInput = {
        label: t('auth.register.confirmPassword'),
        name: 'confirmPassword',
        type: 'password',
        placeholder: '********'
    }

    const emailInput = {
        label: t('auth.register.email'),
        name: 'email',
        type: 'email',
        placeholder: 'user@company.com'
    }

    const [params] = useSearchParams()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [token, setToken] = useState(params.get('token') ?? '')
    const [username, setUsername] = useState('')
    const [configuredSsoProviders, setConfiguredSsoProviders] = useState([])

    const [loading, setLoading] = useState(false)
    const [authError, setAuthError] = useState('')
    const [successMsg, setSuccessMsg] = useState(undefined)

    const registerApi = useApi(accountApi.registerAccount)
    const ssoLoginApi = useApi(ssoApi.ssoLogin)
    const getDefaultProvidersApi = useApi(loginMethodApi.getDefaultLoginMethods)

    const register = async (event) => {
        event.preventDefault()
        const result = RegisterCloudUserSchema.safeParse({
            username,
            email,
            password,
            confirmPassword
        })
        if (result.success) {
            setLoading(true)
            const body = {
                user: {
                    name: username,
                    email,
                    credential: password
                }
            }
            await registerApi.request(body)
        } else {
            const errorMessages = result.error.errors.map((err) => err.message)
            setAuthError(errorMessages.join(', '))
        }
    }

    const signInWithSSO = (ssoProvider) => {
        //ssoLoginApi.request(ssoProvider)
        window.location.href = `/api/v1/${ssoProvider}/login`
    }

    useEffect(() => {
        if (registerApi.error) {
            setAuthError(`Error in registering user. Please try again. (${registerApi.error?.response?.data?.message || registerApi.error.message})`)
            setLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [registerApi.error])

    useEffect(() => {
        // SSO providers can be configured for OSS version as well
        getDefaultProvidersApi.request()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (ssoLoginApi.data) {
            store.dispatch(loginSuccess(ssoLoginApi.data))
            navigate(location.state?.path || '/chatflows')
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ssoLoginApi.data])

    useEffect(() => {
        if (ssoLoginApi.error) {
            if (ssoLoginApi.error?.response?.status === 401 && ssoLoginApi.error?.response?.data.redirectUrl) {
                window.location.href = ssoLoginApi.error.response.data.redirectUrl
            } else {
                setAuthError(ssoLoginApi.error.message)
            }
        }
    }, [ssoLoginApi.error])

    useEffect(() => {
        if (getDefaultProvidersApi.data && getDefaultProvidersApi.data.providers) {
            //data is an array of objects, store only the provider attribute
            setConfiguredSsoProviders(getDefaultProvidersApi.data.providers.map((provider) => provider))
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getDefaultProvidersApi.data])

    useEffect(() => {
        if (registerApi.data) {
            setLoading(false)
            setAuthError(undefined)
            setConfirmPassword('')
            setPassword('')
            setToken('')
            setUsername('')
            setEmail('')
            setSuccessMsg('Registration successful! You will be redirected to the sign in page shortly.')
            setTimeout(() => {
                navigate('/signin')
            }, 3000)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [registerApi.data])

    return (
        <>
            <Box
                sx={{
                    minHeight: '100vh',
                    width: '100%',
                    background: customization.isDarkMode
                        ? 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)'
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    position: 'relative',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: customization.isDarkMode
                            ? 'radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%)'
                            : 'radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.2) 0%, transparent 50%)',
                        pointerEvents: 'none'
                    }
                }}
            >
                <Container
                    maxWidth="sm"
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '100vh',
                        py: 4
                    }}
                >
                    <Card
                        sx={{
                            width: '100%',
                            maxWidth: 480,
                            background: customization.isDarkMode
                                ? 'rgba(255, 255, 255, 0.05)'
                                : 'rgba(255, 255, 255, 0.9)',
                            backdropFilter: 'blur(20px)',
                            border: customization.isDarkMode
                                ? '1px solid rgba(255, 255, 255, 0.1)'
                                : '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: 3,
                            boxShadow: customization.isDarkMode
                                ? '0 8px 32px rgba(0, 0, 0, 0.3)'
                                : '0 8px 32px rgba(0, 0, 0, 0.1)',
                            overflow: 'visible'
                        }}
                    >
                        <CardContent sx={{ p: 4 }}>
                <Stack flexDirection='column' sx={{ width: '100%', gap: 3 }}>
                    {authError && (
                        <Alert icon={<IconExclamationCircle />} variant='filled' severity='error'>
                            {authError.split(', ').length > 0 ? (
                                <List dense sx={{ py: 0 }}>
                                    {authError.split(', ').map((error, index) => (
                                        <ListItemText key={index} primary={error} primaryTypographyProps={{ color: '#fff !important' }} />
                                    ))}
                                </List>
                            ) : (
                                authError
                            )}
                        </Alert>
                    )}
                    {successMsg && (
                        <Alert icon={<IconCircleCheck />} variant='filled' severity='success'>
                            {successMsg}
                        </Alert>
                    )}
                    <Stack sx={{ gap: 2, textAlign: 'center', mb: 1 }}>
                       <Typography 
                           variant='h3' 
                           sx={{ 
                               fontWeight: 700,
                               background: customization.isDarkMode
                                   ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                   : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                               backgroundClip: 'text',
                               WebkitBackgroundClip: 'text',
                               WebkitTextFillColor: 'transparent',
                               mb: 1
                           }}
                       >
                           {t('auth.register.title')}
                       </Typography>
                       <Typography 
                           variant='body1' 
                           sx={{ 
                               color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
                               fontSize: '1rem'
                           }}
                       >
                           {t('auth.register.alreadyHaveAccount')}{' '}
                           <Link 
                               style={{ 
                                   color: customization.isDarkMode ? '#667eea' : '#764ba2',
                                   textDecoration: 'none',
                                   fontWeight: 600
                               }} 
                               to='/signin'
                           >
                               {t('auth.signin.title')}
                           </Link>
                           .
                       </Typography>
                    </Stack>
                    <form onSubmit={register} data-rewardful>
                        <Stack sx={{ width: '100%', flexDirection: 'column', alignItems: 'left', justifyContent: 'center', gap: 3 }}>
                            <Box sx={{ mb: 1 }}>
                                <Typography 
                                    variant='body2' 
                                    sx={{ 
                                        mb: 1.5,
                                        fontWeight: 600,
                                        color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)'
                                    }}
                                >
                                    {t('auth.register.displayName')}<span style={{ color: '#f44336' }}>&nbsp;*</span>
                                </Typography>
                                <Input
                                    inputParam={usernameInput}
                                    placeholder={t('auth.register.displayName')}
                                    onChange={(newValue) => setUsername(newValue)}
                                    value={username}
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
                                    {t('auth.register.displayNameHint')}
                                </Typography>
                            </Box>
                            <Box sx={{ mb: 1 }}>
                                <Typography 
                                    variant='body2' 
                                    sx={{ 
                                        mb: 1.5,
                                        fontWeight: 600,
                                        color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)'
                                    }}
                                >
                                    {t('auth.register.email')}<span style={{ color: '#f44336' }}>&nbsp;*</span>
                                </Typography>
                                <Input
                                    inputParam={emailInput}
                                    onChange={(newValue) => setEmail(newValue)}
                                    value={email}
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
                                    Kindly use a valid email address. Will be used as login id.
                                </Typography>
                            </Box>

                            <Box sx={{ mb: 1 }}>
                                <Typography 
                                    variant='body2' 
                                    sx={{ 
                                        mb: 1.5,
                                        fontWeight: 600,
                                        color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)'
                                    }}
                                >
                                    Password<span style={{ color: '#f44336' }}>&nbsp;*</span>
                                </Typography>
                                <Input inputParam={passwordInput} onChange={(newValue) => setPassword(newValue)} value={password} />
                                <Typography 
                                    variant='caption' 
                                    sx={{ 
                                        mt: 0.5,
                                        color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)',
                                        fontStyle: 'italic'
                                    }}
                                >
                                    Password must be at least 8 characters long and contain at least one lowercase letter, one uppercase
                                    letter, one digit, and one special character.
                                </Typography>
                            </Box>
                            <Box sx={{ mb: 2 }}>
                                <Typography 
                                    variant='body2' 
                                    sx={{ 
                                        mb: 1.5,
                                        fontWeight: 600,
                                        color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)'
                                    }}
                                >
                                    Confirm Password<span style={{ color: '#f44336' }}>&nbsp;*</span>
                                </Typography>
                                <Input
                                    inputParam={confirmPasswordInput}
                                    onChange={(newValue) => setConfirmPassword(newValue)}
                                    value={confirmPassword}
                                />
                                <Typography 
                                    variant='caption' 
                                    sx={{ 
                                        mt: 0.5,
                                        color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)',
                                        fontStyle: 'italic'
                                    }}
                                >
                                    Confirm your password. Must match the password typed above.
                                </Typography>
                            </Box>
                            <Button 
                                variant='contained' 
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
                                        background: 'linear-gradient(135deg, #5a67d8 0%, #667eea 100%)',
                                        boxShadow: '0 6px 20px rgba(102, 126, 234, 0.6)',
                                        transform: 'translateY(-2px)'
                                    },
                                    '&:active': {
                                        transform: 'translateY(0px)'
                                    }
                                }}
                            >
                                Create Account
                            </Button>
                            {configuredSsoProviders.length > 0 && (
                                <>
                                    <Box sx={{ display: 'flex', alignItems: 'center', my: 3 }}>
                                        <Divider 
                                            sx={{ 
                                                flexGrow: 1,
                                                borderColor: customization.isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
                                            }} 
                                        />
                                        <Typography 
                                            variant='body2' 
                                            sx={{ 
                                                mx: 2, 
                                                color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                                                fontWeight: 500
                                            }}
                                        >
                                            {t('auth.register.or')}
                                        </Typography>
                                        <Divider 
                                            sx={{ 
                                                flexGrow: 1,
                                                borderColor: customization.isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
                                            }} 
                                        />
                                    </Box>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        {configuredSsoProviders.map((provider) => (
                                            <Button
                                                key={provider}
                                                variant='outlined'
                                                fullWidth
                                                onClick={() => signInWithSSO(provider)}
                                                sx={{
                                                    height: 48,
                                                    borderRadius: 3,
                                                    textTransform: 'none',
                                                    fontSize: '1rem',
                                                    fontWeight: 500,
                                                    borderColor: customization.isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                                                    color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
                                                    background: customization.isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                                                    backdropFilter: 'blur(10px)',
                                                    transition: 'all 0.3s ease',
                                                    '&:hover': {
                                                        borderColor: '#667eea',
                                                        background: customization.isDarkMode ? 'rgba(102, 126, 234, 0.1)' : 'rgba(102, 126, 234, 0.05)',
                                                        transform: 'translateY(-1px)',
                                                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.2)'
                                                    }
                                                }}
                                            >
                                                Continue with {provider}
                                            </Button>
                                        ))}
                                    </Box>
                                </>
                            )}
                        </Stack>
                    </form>
                        </Stack>
                        </CardContent>
                    </Card>
                </Container>
            </Box>
            {loading && <BackdropLoader open={loading} />}
        </>
    )
}

export default RegisterPage
