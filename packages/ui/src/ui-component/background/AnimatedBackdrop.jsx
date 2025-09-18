import { memo } from 'react'
import { Box, useTheme } from '@mui/material'
import { keyframes } from '@mui/system'

const float = keyframes`
    0% {
        transform: translate3d(-10%, -10%, 0) scale(1);
    }
    50% {
        transform: translate3d(6%, -12%, 0) scale(1.06);
    }
    100% {
        transform: translate3d(-10%, -10%, 0) scale(1);
    }
`

const drift = keyframes`
    0% {
        transform: translate3d(0, 0, 0) scale(1);
    }
    50% {
        transform: translate3d(-4%, 2%, 0) scale(1.04);
    }
    100% {
        transform: translate3d(0, 0, 0) scale(1);
    }
`

const pulse = keyframes`
    0% {
        opacity: 0.35;
    }
    50% {
        opacity: 0.6;
    }
    100% {
        opacity: 0.35;
    }
`

const AnimatedBackdrop = () => {
    const theme = useTheme()
    const isDark = theme?.customization?.isDarkMode
    const palette = isDark
        ? {
              base: 'rgba(79, 70, 229, 0.42)',
              accent: 'rgba(14, 165, 233, 0.35)',
              highlight: 'rgba(236, 72, 153, 0.32)',
              glow: 'rgba(16, 185, 129, 0.28)',
              star: 'rgba(148, 163, 184, 0.14)'
          }
        : {
              base: 'rgba(99, 102, 241, 0.32)',
              accent: 'rgba(14, 116, 144, 0.3)',
              highlight: 'rgba(236, 72, 153, 0.26)',
              glow: 'rgba(59, 130, 246, 0.24)',
              star: 'rgba(37, 99, 235, 0.1)'
          }

    return (
        <Box
            aria-hidden
            sx={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
                pointerEvents: 'none',
                zIndex: 0,
                opacity: isDark ? 0.85 : 0.75,
                transition: 'opacity 0.6s ease'
            }}
        >
            <Box
                sx={{
                    position: 'absolute',
                    width: { xs: '80vw', md: '55vw' },
                    height: { xs: '80vw', md: '55vw' },
                    top: { xs: '-25vw', md: '-18vw' },
                    left: { xs: '-30vw', md: '-18vw' },
                    background: `radial-gradient(circle at center, ${palette.base} 0%, transparent 70%)`,
                    filter: 'blur(70px)',
                    mixBlendMode: 'screen',
                    animation: `${float} 24s ease-in-out infinite`,
                    '@media (prefers-reduced-motion: reduce)': {
                        animation: 'none'
                    }
                }}
            />

            <Box
                sx={{
                    position: 'absolute',
                    width: { xs: '70vw', md: '45vw' },
                    height: { xs: '70vw', md: '45vw' },
                    bottom: { xs: '-30vw', md: '-20vw' },
                    right: { xs: '-25vw', md: '-15vw' },
                    background: `radial-gradient(circle at center, ${palette.accent} 0%, transparent 70%)`,
                    filter: 'blur(80px)',
                    mixBlendMode: 'screen',
                    animation: `${drift} 30s ease-in-out infinite`,
                    '@media (prefers-reduced-motion: reduce)': {
                        animation: 'none'
                    }
                }}
            />

            <Box
                sx={{
                    position: 'absolute',
                    width: { xs: '60vw', md: '38vw' },
                    height: { xs: '60vw', md: '38vw' },
                    top: { xs: '30vh', md: '35vh' },
                    left: { xs: '10vw', md: '22vw' },
                    background: `radial-gradient(circle at center, ${palette.highlight} 0%, transparent 65%)`,
                    filter: 'blur(60px)',
                    mixBlendMode: 'screen',
                    animation: `${pulse} 18s ease-in-out infinite`,
                    '@media (prefers-reduced-motion: reduce)': {
                        animation: 'none'
                    }
                }}
            />

            <Box
                sx={{
                    position: 'absolute',
                    inset: '-40%',
                    backgroundImage: `radial-gradient(${palette.star} 1px, transparent 1px)`,
                    backgroundSize: '140px 140px',
                    opacity: isDark ? 0.5 : 0.35,
                    animation: `${drift} 60s linear infinite`,
                    '@media (prefers-reduced-motion: reduce)': {
                        animation: 'none'
                    }
                }}
            />

            <Box
                sx={{
                    position: 'absolute',
                    width: '65%',
                    maxWidth: '820px',
                    height: '55%',
                    right: '-15%',
                    top: '5%',
                    background: `linear-gradient(120deg, transparent 10%, ${palette.glow} 45%, transparent 90%)`,
                    filter: 'blur(100px)',
                    opacity: 0.6,
                    transform: 'rotate(8deg)',
                    mixBlendMode: 'screen'
                }}
            />
        </Box>
    )
}

export default memo(AnimatedBackdrop)
