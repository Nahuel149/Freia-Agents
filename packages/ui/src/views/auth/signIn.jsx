import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link, useLocation, useNavigate } from 'react-router-dom'

// material-ui
import { Stack, useTheme, Typography, Box, Alert, Button, Divider, Icon, Container, Card, CardContent } from '@mui/material'
import { IconExclamationCircle } from '@tabler/icons-react'
import { LoadingButton } from '@mui/lab'
import { useTranslation } from 'react-i18next'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import { Input } from '@/ui-component/input/Input'

// Hooks
import useApi from '@/hooks/useApi'
import { useConfig } from '@/store/context/ConfigContext'

// API
import authApi from '@/api/auth'
import accountApi from '@/api/account.api'
import loginMethodApi from '@/api/loginmethod'
import ssoApi from '@/api/sso'

// utils
import useNotifier from '@/utils/useNotifier'

// store
import { loginSuccess, logoutSuccess } from '@/store/reducers/authSlice'
import { store } from '@/store'

// icons
import AzureSSOLoginIcon from '@/assets/images/microsoft-azure.svg'
import GoogleSSOLoginIcon from '@/assets/images/google.svg'
import Auth0SSOLoginIcon from '@/assets/images/auth0.svg'
import GithubSSOLoginIcon from '@/assets/images/github.svg'

// ==============================|| SignInPage ||============================== //

const SignInPage = () => {
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)
    useNotifier()
    // OSS mode: Enterprise license checks removed
    const { isCloud, isOpenSource } = useConfig()
    const { t } = useTranslation()

    const usernameInput = {
        label: t('auth.signin.email'),
        name: 'username',
        type: 'email',
        placeholder: 'user@company.com'
    }
    const passwordInput = {
        label: t('auth.signin.password'),
        name: 'password',
        type: 'password',
        placeholder: '********'
    }
    const [usernameVal, setUsernameVal] = useState('')
    const [passwordVal, setPasswordVal] = useState('')
    const [configuredSsoProviders, setConfiguredSsoProviders] = useState([])
    const [authError, setAuthError] = useState(undefined)
    const [loading, setLoading] = useState(false)
    const [showResendButton, setShowResendButton] = useState(false)
    const [successMessage, setSuccessMessage] = useState('')

    const loginApi = useApi(authApi.login)
    const ssoLoginApi = useApi(ssoApi.ssoLogin)
    const getDefaultProvidersApi = useApi(loginMethodApi.getDefaultLoginMethods)
    const navigate = useNavigate()
    const location = useLocation()
    const resendVerificationApi = useApi(accountApi.resendVerificationEmail)

    const doLogin = (event) => {
        event.preventDefault()
        setLoading(true)
        const body = {
            email: usernameVal,
            password: passwordVal
        }
        loginApi.request(body)
    }

    useEffect(() => {
        if (loginApi.error) {
            setLoading(false)
            const status = loginApi.error?.response?.status
            const data = loginApi.error?.response?.data
            if (status === 401 && data?.redirectUrl) {
                window.location.href = data.redirectUrl
            } else if (data?.message) {
                setAuthError(data.message)
            } else {
                setAuthError(loginApi.error.message || 'Network error, please try again later.')
            }
        }
    }, [loginApi.error])

    useEffect(() => {
        store.dispatch(logoutSuccess())
        if (!isOpenSource) {
            getDefaultProvidersApi.request()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        // Parse the "user" query parameter from the URL
        const queryParams = new URLSearchParams(location.search)
        const errorData = queryParams.get('error')
        if (!errorData) return
        const parsedErrorData = JSON.parse(decodeURIComponent(errorData))
        setAuthError(parsedErrorData.message)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search])

    useEffect(() => {
        if (loginApi.data) {
            setLoading(false)
            store.dispatch(loginSuccess(loginApi.data))
            navigate(location.state?.path || '/agentflows')
            //navigate(0)
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loginApi.data])

    useEffect(() => {
        if (ssoLoginApi.data) {
            store.dispatch(loginSuccess(ssoLoginApi.data))
            navigate(location.state?.path || '/agentflows')
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
        if (authError === 'User Email Unverified') {
            setShowResendButton(true)
        } else {
            setShowResendButton(false)
        }
    }, [authError])

    const signInWithSSO = (ssoProvider) => {
        window.location.href = `/api/v1/${ssoProvider}/login`
    }

    const handleResendVerification = async () => {
        try {
            await resendVerificationApi.request({ email: usernameVal })
            setAuthError(undefined)
            setSuccessMessage(t('auth.signin.verificationSent'))
            setShowResendButton(false)
        } catch (error) {
            setAuthError(error.response?.data?.message || 'Failed to send verification email.')
        }
    }

    return (
        <Box
            sx={{
                minHeight: '100vh',
                height: '100vh',
                width: '100vw',
                position: 'fixed',
                top: 0,
                left: 0,
                background: customization.isDarkMode
                    ? 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                overflow: 'auto',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: customization.isDarkMode
                        ? 'radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.15) 0%, transparent 50%)'
                        : 'radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)',
                    pointerEvents: 'none'
                }
            }}
        >
            <Container maxWidth='sm' sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', py: 4, position: 'relative', zIndex: 1 }}>
                <Card
                    sx={{
                        width: '100%',
                        maxWidth: '480px',
                        mx: 'auto',
                        background: customization.isDarkMode
                            ? 'rgba(30, 30, 46, 0.8)'
                            : 'rgba(255, 255, 255, 0.9)',
                        backdropFilter: 'blur(20px)',
                        border: customization.isDarkMode
                            ? '1px solid rgba(255, 255, 255, 0.1)'
                            : '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '24px',
                        boxShadow: customization.isDarkMode
                            ? '0 20px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)'
                            : '0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.2)'
                    }}
                >
                    <CardContent sx={{ p: 4 }}>
                        <Stack flexDirection='column' sx={{ gap: 3 }}>
                    {successMessage && (
                        <Alert variant='filled' severity='success' onClose={() => setSuccessMessage('')}>
                            {successMessage}
                        </Alert>
                    )}
                    {authError && (
                        <Alert icon={<IconExclamationCircle />} variant='filled' severity='error'>
                            {authError}
                        </Alert>
                    )}
                    {showResendButton && (
                        <Stack sx={{ gap: 1 }}>
                            <Button variant='text' onClick={handleResendVerification}>
                                {t('auth.signin.resendVerification')}
                            </Button>
                        </Stack>
                    )}
                    <Stack sx={{ gap: 2, textAlign: 'center', mb: 1 }}>
                        <Typography 
                            variant='h3' 
                            sx={{ 
                                fontWeight: 700,
                                fontSize: { xs: '2rem', sm: '2.5rem' },
                                background: customization.isDarkMode
                                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                mb: 1
                            }}
                        >
                            {t('auth.signin.title')}
                        </Typography>
                        {isCloud && (
                            <Typography 
                                variant='body1' 
                                sx={{ 
                                    color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
                                    fontSize: '1rem'
                                }}
                            >
                                {t('auth.signin.noAccount')}{' '}
                                <Link 
                                    style={{ 
                                        color: customization.isDarkMode ? '#667eea' : '#764ba2',
                                        textDecoration: 'none',
                                        fontWeight: 600
                                    }} 
                                    to='/register'
                                >
                                    {t('auth.signin.signUpForFree')}
                                </Link>
                                .
                            </Typography>
                        )}
                        {/* OSS mode: Enterprise license invitation UI removed */}
                    </Stack>
                    <form onSubmit={doLogin}>
                        <Stack sx={{ width: '100%', flexDirection: 'column', alignItems: 'left', justifyContent: 'center', gap: 3 }}>
                            <Box sx={{ mb: 1 }}>
                                <Typography 
                                    variant='body1' 
                                    sx={{ 
                                        fontWeight: 600,
                                        color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
                                        mb: 1
                                    }}
                                >
                                    {t('auth.signin.email')}<span style={{ color: '#f44336' }}>&nbsp;*</span>
                                </Typography>
                                <Input
                                    inputParam={usernameInput}
                                    onChange={(newValue) => setUsernameVal(newValue)}
                                    value={usernameVal}
                                    showDialog={false}
                                />
                            </Box>
                            <Box sx={{ mb: 1 }}>
                                <Typography 
                                    variant='body1' 
                                    sx={{ 
                                        fontWeight: 600,
                                        color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
                                        mb: 1
                                    }}
                                >
                                    {t('auth.signin.password')}<span style={{ color: '#f44336' }}>&nbsp;*</span>
                                </Typography>
                                <Input inputParam={passwordInput} onChange={(newValue) => setPasswordVal(newValue)} value={passwordVal} />
                                <Typography 
                                    variant='body2' 
                                    sx={{ 
                                        color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
                                        mt: 1, 
                                        textAlign: 'right'
                                    }}
                                >
                                    <Link 
                                        style={{ 
                                            color: customization.isDarkMode ? '#667eea' : '#764ba2',
                                            textDecoration: 'none',
                                            fontWeight: 600
                                        }} 
                                        to='/forgot-password'
                                    >
                                        {t('auth.signin.forgotPassword')}
                                    </Link>
                                </Typography>
                                <Typography 
                                    variant='body2' 
                                    sx={{ 
                                        color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
                                        mt: 1, 
                                        textAlign: 'right'
                                    }}
                                >
                                    <Link 
                                        style={{ 
                                            color: customization.isDarkMode ? '#667eea' : '#764ba2',
                                            textDecoration: 'none',
                                            fontWeight: 600
                                        }} 
                                        to='/register'
                                    >
                                        Create Account
                                    </Link>
                                </Typography>
                                {isCloud && (
                                    <Typography variant='body2' sx={{ color: theme.palette.grey[600], mt: 1, textAlign: 'right' }}>
                                        <a
                                            href='https://docs.flowiseai.com/migration-guide/cloud-migration'
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            style={{ color: theme.palette.primary.main }}
                                        >
                                            {t('auth.signin.migrateExisting')}
                                        </a>
                                    </Typography>
                                )}
                            </Box>
                            <LoadingButton
                                loading={loading}
                                variant='contained'
                                type='submit'
                                sx={{
                                    borderRadius: '12px',
                                    height: '48px',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
                                    border: 'none',
                                    fontWeight: 600,
                                    fontSize: '1rem',
                                    textTransform: 'none',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        background: 'linear-gradient(135deg, #5a67d8 0%, #667eea 100%)',
                                        boxShadow: '0 12px 40px rgba(102, 126, 234, 0.4)',
                                        transform: 'translateY(-2px)'
                                    },
                                    '&:active': {
                                        transform: 'translateY(0px)'
                                    }
                                }}
                            >
                                {t('auth.signin.login')}
                            </LoadingButton>
                            {configuredSsoProviders && configuredSsoProviders.length > 0 && (
                                <Divider 
                                    sx={{ 
                                        width: '100%',
                                        borderColor: customization.isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                                        '& .MuiDivider-wrapper': {
                                            color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                                            fontWeight: 500
                                        }
                                    }}
                                >
                                    {t('auth.signin.or')}
                                </Divider>
                            )}
                            {configuredSsoProviders &&
                                configuredSsoProviders.map(
                                    (ssoProvider) =>
                                        //https://learn.microsoft.com/en-us/entra/identity-platform/howto-add-branding-in-apps
                                        ssoProvider === 'azure' && (
                                            <Button
                                                key={ssoProvider}
                                                variant='outlined'
                                                onClick={() => signInWithSSO(ssoProvider)}
                                                startIcon={
                                                    <Icon>
                                                        <img src={AzureSSOLoginIcon} alt={'MicrosoftSSO'} width={20} height={20} />
                                                    </Icon>
                                                }
                                                sx={{
                                                    borderRadius: '12px',
                                                    height: '48px',
                                                    width: '100%',
                                                    background: customization.isDarkMode
                                                        ? 'rgba(255, 255, 255, 0.05)'
                                                        : 'rgba(255, 255, 255, 0.8)',
                                                    backdropFilter: 'blur(10px)',
                                                    border: customization.isDarkMode
                                                        ? '1px solid rgba(255, 255, 255, 0.1)'
                                                        : '1px solid rgba(0, 0, 0, 0.1)',
                                                    color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
                                                    fontWeight: 500,
                                                    textTransform: 'none',
                                                    transition: 'all 0.3s ease',
                                                    '&:hover': {
                                                        borderColor: customization.isDarkMode ? 'rgba(102, 126, 234, 0.5)' : 'rgba(118, 75, 162, 0.5)',
                                                        background: customization.isDarkMode
                                                            ? 'rgba(102, 126, 234, 0.1)'
                                                            : 'rgba(118, 75, 162, 0.1)',
                                                        transform: 'translateY(-1px)',
                                                        boxShadow: '0 4px 20px rgba(102, 126, 234, 0.2)'
                                                    }
                                                }}
                                            >
                                                {t('auth.sso.azure')}
                                            </Button>
                                        )
                                )}
                            {configuredSsoProviders &&
                                configuredSsoProviders.map(
                                    (ssoProvider) =>
                                        ssoProvider === 'google' && (
                                            <Button
                                                key={ssoProvider}
                                                variant='outlined'
                                                onClick={() => signInWithSSO(ssoProvider)}
                                                startIcon={
                                                    <Icon>
                                                        <img src={GoogleSSOLoginIcon} alt={'GoogleSSO'} width={20} height={20} />
                                                    </Icon>
                                                }
                                                sx={{
                                                    borderRadius: '12px',
                                                    height: '48px',
                                                    width: '100%',
                                                    background: customization.isDarkMode
                                                        ? 'rgba(255, 255, 255, 0.05)'
                                                        : 'rgba(255, 255, 255, 0.8)',
                                                    backdropFilter: 'blur(10px)',
                                                    border: customization.isDarkMode
                                                        ? '1px solid rgba(255, 255, 255, 0.1)'
                                                        : '1px solid rgba(0, 0, 0, 0.1)',
                                                    color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
                                                    fontWeight: 500,
                                                    textTransform: 'none',
                                                    transition: 'all 0.3s ease',
                                                    '&:hover': {
                                                        borderColor: customization.isDarkMode ? 'rgba(102, 126, 234, 0.5)' : 'rgba(118, 75, 162, 0.5)',
                                                        background: customization.isDarkMode
                                                            ? 'rgba(102, 126, 234, 0.1)'
                                                            : 'rgba(118, 75, 162, 0.1)',
                                                        transform: 'translateY(-1px)',
                                                        boxShadow: '0 4px 20px rgba(102, 126, 234, 0.2)'
                                                    }
                                                }}
                                            >
                                                {t('auth.sso.google')}
                                            </Button>
                                        )
                                )}
                            {configuredSsoProviders &&
                                configuredSsoProviders.map(
                                    (ssoProvider) =>
                                        ssoProvider === 'auth0' && (
                                            <Button
                                                key={ssoProvider}
                                                variant='outlined'
                                                onClick={() => signInWithSSO(ssoProvider)}
                                                startIcon={
                                                    <Icon>
                                                        <img src={Auth0SSOLoginIcon} alt={'Auth0SSO'} width={20} height={20} />
                                                    </Icon>
                                                }
                                                sx={{
                                                    borderRadius: '12px',
                                                    height: '48px',
                                                    width: '100%',
                                                    background: customization.isDarkMode
                                                        ? 'rgba(255, 255, 255, 0.05)'
                                                        : 'rgba(255, 255, 255, 0.8)',
                                                    backdropFilter: 'blur(10px)',
                                                    border: customization.isDarkMode
                                                        ? '1px solid rgba(255, 255, 255, 0.1)'
                                                        : '1px solid rgba(0, 0, 0, 0.1)',
                                                    color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
                                                    fontWeight: 500,
                                                    textTransform: 'none',
                                                    transition: 'all 0.3s ease',
                                                    '&:hover': {
                                                        borderColor: customization.isDarkMode ? 'rgba(102, 126, 234, 0.5)' : 'rgba(118, 75, 162, 0.5)',
                                                        background: customization.isDarkMode
                                                            ? 'rgba(102, 126, 234, 0.1)'
                                                            : 'rgba(118, 75, 162, 0.1)',
                                                        transform: 'translateY(-1px)',
                                                        boxShadow: '0 4px 20px rgba(102, 126, 234, 0.2)'
                                                    }
                                                }}
                                            >
                                                {t('auth.sso.auth0')}
                                            </Button>
                                        )
                                )}
                            {configuredSsoProviders &&
                                configuredSsoProviders.map(
                                    (ssoProvider) =>
                                        ssoProvider === 'github' && (
                                            <Button
                                                key={ssoProvider}
                                                variant='outlined'
                                                onClick={() => signInWithSSO(ssoProvider)}
                                                startIcon={
                                                    <Icon>
                                                        <img src={GithubSSOLoginIcon} alt={'GithubSSO'} width={20} height={20} />
                                                    </Icon>
                                                }
                                                sx={{
                                                    borderRadius: '12px',
                                                    height: '48px',
                                                    width: '100%',
                                                    background: customization.isDarkMode
                                                        ? 'rgba(255, 255, 255, 0.05)'
                                                        : 'rgba(255, 255, 255, 0.8)',
                                                    backdropFilter: 'blur(10px)',
                                                    border: customization.isDarkMode
                                                        ? '1px solid rgba(255, 255, 255, 0.1)'
                                                        : '1px solid rgba(0, 0, 0, 0.1)',
                                                    color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
                                                    fontWeight: 500,
                                                    textTransform: 'none',
                                                    transition: 'all 0.3s ease',
                                                    '&:hover': {
                                                        borderColor: customization.isDarkMode ? 'rgba(102, 126, 234, 0.5)' : 'rgba(118, 75, 162, 0.5)',
                                                        background: customization.isDarkMode
                                                            ? 'rgba(102, 126, 234, 0.1)'
                                                            : 'rgba(118, 75, 162, 0.1)',
                                                        transform: 'translateY(-1px)',
                                                        boxShadow: '0 4px 20px rgba(102, 126, 234, 0.2)'
                                                    }
                                                }}
                                            >
                                                {t('auth.sso.github')}
                                            </Button>
                                        )
                                )}
                        </Stack>
                    </form>
                </Stack>
                        </CardContent>
                </Card>
            </Container>
        </Box>
    )
}

export default SignInPage
