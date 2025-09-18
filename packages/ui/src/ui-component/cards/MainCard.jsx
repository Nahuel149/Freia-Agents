import PropTypes from 'prop-types'
import { forwardRef } from 'react'

// material-ui
import { Card, CardContent, CardHeader, Divider, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// constant
const headerSX = {
    '& .MuiCardHeader-action': { mr: 0 }
}

// ==============================|| CUSTOM MAIN CARD ||============================== //

const MainCard = forwardRef(function MainCard(
    {
        boxShadow,
        children,
        content = true,
        contentClass = '',
        contentSX = {
            px: 2,
            py: 0
        },
        darkTitle,
        maxWidth = 'full',
        secondary,
        shadow,
        sx = {},
        title,
        ...others
    },
    ref
) {
    const theme = useTheme()
    const isDark = theme?.customization?.isDarkMode
    const surfaceBackground = isDark
        ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.78) 0%, rgba(30, 41, 59, 0.74) 100%)'
        : 'linear-gradient(135deg, rgba(255, 255, 255, 0.94) 0%, rgba(244, 247, 255, 0.9) 100%)'
    const surfaceBorder = isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.28)'
    const restingShadow = isDark ? '0 20px 55px rgba(8, 12, 30, 0.45)' : '0 18px 45px rgba(79, 70, 229, 0.12)'
    const hoverShadow = isDark ? '0 26px 70px rgba(8, 12, 30, 0.55)' : '0 24px 60px rgba(79, 70, 229, 0.16)'
    const otherProps = { ...others, border: others.border === false ? undefined : others.border }
    return (
        <Card
            ref={ref}
            {...otherProps}
            sx={{
                position: 'relative',
                overflow: 'hidden',
                background: surfaceBackground,
                border: `1px solid ${surfaceBorder}`,
                boxShadow: boxShadow ? shadow || restingShadow : restingShadow,
                backdropFilter: 'blur(22px) saturate(140%)',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                ':before': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    opacity: 0.35,
                    background: isDark
                        ? 'radial-gradient(circle at top, rgba(59, 130, 246, 0.16) 0%, transparent 55%)'
                        : 'radial-gradient(circle at top, rgba(59, 130, 246, 0.14) 0%, transparent 60%)',
                    pointerEvents: 'none'
                },
                ':hover': {
                    boxShadow: boxShadow ? shadow || hoverShadow : hoverShadow,
                    transform: 'translateY(-4px)'
                },
                maxWidth: maxWidth === 'sm' ? '800px' : maxWidth === 'md' ? '960px' : '1280px',
                mx: 'auto',
                ...sx
            }}
        >
            {/* card header and action */}
            {!darkTitle && title && <CardHeader sx={headerSX} title={title} action={secondary} />}
            {darkTitle && title && <CardHeader sx={headerSX} title={<Typography variant='h3'>{title}</Typography>} action={secondary} />}

            {/* content & header divider */}
            {title && <Divider />}

            {/* card content */}
            {content && (
                <CardContent sx={contentSX} className={contentClass}>
                    {children}
                </CardContent>
            )}
            {!content && children}
        </Card>
    )
})

MainCard.propTypes = {
    border: PropTypes.bool,
    boxShadow: PropTypes.bool,
    maxWidth: PropTypes.oneOf(['full', 'sm', 'md']),
    children: PropTypes.node,
    content: PropTypes.bool,
    contentClass: PropTypes.string,
    contentSX: PropTypes.object,
    darkTitle: PropTypes.bool,
    secondary: PropTypes.oneOfType([PropTypes.node, PropTypes.string, PropTypes.object]),
    shadow: PropTypes.string,
    sx: PropTypes.object,
    title: PropTypes.oneOfType([PropTypes.node, PropTypes.string, PropTypes.object])
}

export default MainCard
