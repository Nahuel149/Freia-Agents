import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

// material-ui
import { Alert, Box, Stack, Typography, useTheme, Container, Card, CardContent } from '@mui/material'

// project imports
import { StyledButton } from '@/ui-component/button/StyledButton'
import { Input } from '@/ui-component/input/Input'
import { BackdropLoader } from '@/ui-component/loading/BackdropLoader'

// API
import accountApi from '@/api/account.api'

// Hooks
import useApi from '@/hooks/useApi'

// utils
import useNotifier from '@/utils/useNotifier'

// Icons
import { IconCircleCheck, IconExclamationCircle } from '@tabler/icons-react'

// ==============================|| ForgotPasswordPage ||============================== //

const ForgotPasswordPage = () => {
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)
    const { t } = useTranslation()
    useNotifier()

    const usernameInput = {
        label: 'Correo electrónico',
        name: 'username',
        type: 'email',
        placeholder: 'user@company.com'
    }
    const [usernameVal, setUsernameVal] = useState('')
    // OSS mode: Enterprise license checks removed

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
                msg: errMessage ?? 'No se pudieron enviar las instrucciones, contacta a tu administrador.'
            })
            setLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [forgotPasswordApi.error])

    useEffect(() => {
        if (forgotPasswordApi.data) {
            setResponseMsg({
                type: 'success',
                msg: 'Instrucciones para restablecer la contraseña enviadas al correo.'
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
            <Container maxWidth='sm'>
                <Card
                    sx={{
                        backdropFilter: 'blur(20px)',
                        background: customization.isDarkMode ? 'rgba(14, 21, 41, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                        border: customization.isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                        borderRadius: '24px',
                        boxShadow: customization.isDarkMode ? '0 25px 60px rgba(0, 0, 0, 0.45)' : '0 25px 60px rgba(10, 86, 240, 0.18)',
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
                                    ¿Olvidaste tu contraseña?
                                </Typography>
                                <Typography
                                    variant='body1'
                                    sx={{
                                        color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
                                        maxWidth: '400px'
                                    }}
                                >
                                    ¿Tienes un código de reseteo?{' '}
                                    <Link
                                        style={{
                                            color: customization.isDarkMode ? '#667eea' : '#764ba2',
                                            textDecoration: 'none',
                                            fontWeight: 600
                                        }}
                                        to='/reset-password'
                                    >
                                        Cámbiala aquí
                                    </Link>
                                    .
                                </Typography>
                            </Stack>
                            <form onSubmit={sendResetRequest}>
                                <Stack
                                    sx={{ width: '100%', flexDirection: 'column', alignItems: 'left', justifyContent: 'center', gap: 3 }}
                                >
                                    <Box sx={{ mb: 1 }}>
                                        <Typography
                                            variant='body1'
                                            sx={{
                                                mb: 1.5,
                                                fontWeight: 600,
                                                color: customization.isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)'
                                            }}
                                        >
                                            Correo electrónico<span style={{ color: '#f44336' }}>&nbsp;*</span>
                                        </Typography>
                                        <Input
                                            inputParam={usernameInput}
                                            onChange={(newValue) => setUsernameVal(newValue)}
                                            value={usernameVal}
                                            showDialog={false}
                                        />
                                        {/* OSS mode: Enterprise license admin contact message removed */}
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
                                        Enviar instrucciones para restablecer
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
