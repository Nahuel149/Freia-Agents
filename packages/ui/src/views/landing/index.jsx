import { Box, Button, Container, Grid, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'

const LandingPage = () => {
    const navigate = useNavigate()
    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Container maxWidth='md' sx={{ textAlign: 'center', py: 10 }}>
                <Typography variant='h2' fontWeight={900} gutterBottom>
                    Bienvenido a Freia
                </Typography>
                <Typography variant='h6' color='text.secondary' gutterBottom>
                    Selecciona una demo para explorar las capacidades del agente.
                </Typography>
                <Grid container spacing={3} sx={{ mt: 4 }}>
                    <Grid item xs={12} sm={6}>
                        <Button fullWidth variant='contained' size='large' onClick={() => navigate('/demo/hoteles')}>
                            Demo Hoteles
                        </Button>
                    </Grid>
                </Grid>
            </Container>
        </Box>
    )
}

export default LandingPage
