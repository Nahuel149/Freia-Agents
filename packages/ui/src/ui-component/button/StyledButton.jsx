import { styled } from '@mui/material/styles'
import { Button } from '@mui/material'
import MuiToggleButton from '@mui/material/ToggleButton'

export const StyledButton = styled(Button)(({ theme, color = 'primary' }) => {
    const paletteColor = theme.palette[color] ?? theme.palette.primary
    const textColor = paletteColor?.contrastText ?? (theme.palette.mode === 'dark' ? '#ffffff' : '#000000')
    const backgroundColor = paletteColor?.main ?? theme.palette.primary.main

    return {
        color: textColor,
        backgroundColor,
        '&:hover': {
            backgroundColor,
            backgroundImage: `linear-gradient(rgb(0 0 0/10%) 0 0)`
        }
    }
})

export const StyledToggleButton = styled(MuiToggleButton)(({ theme, color = 'primary' }) => {
    const paletteColor = theme.palette[color] ?? theme.palette.primary
    const textColor = paletteColor?.contrastText ?? (theme.palette.mode === 'dark' ? '#ffffff' : '#000000')

    return {
        '&.Mui-selected, &.Mui-selected:hover': {
            color: textColor,
            backgroundColor: paletteColor?.main ?? theme.palette.primary.main
        }
    }
})
