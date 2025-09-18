export default function componentStyleOverrides(theme) {
    const bgColor = theme.colors?.grey50
    const isDarkMode = theme?.customization?.isDarkMode
    const hoverBackground = isDarkMode
        ? 'linear-gradient(135deg, rgba(79, 70, 229, 0.28) 0%, rgba(56, 189, 248, 0.2) 100%)'
        : 'linear-gradient(135deg, rgba(99, 102, 241, 0.18) 0%, rgba(56, 189, 248, 0.15) 100%)'
    const activeShadow = isDarkMode
        ? '0 12px 30px rgba(59, 130, 246, 0.18)'
        : '0 10px 24px rgba(79, 70, 229, 0.18)'
    const baseRadius = theme?.customization?.borderRadius || 12
    return {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    backgroundColor: theme?.customization?.isDarkMode ? '#050817' : '#f5f7ff',
                    backgroundImage: theme?.customization?.isDarkMode
                        ? 'radial-gradient(120% 120% at 20% 0%, rgba(56, 189, 248, 0.16) 0%, rgba(15, 23, 42, 0) 55%), radial-gradient(140% 140% at 80% 20%, rgba(236, 72, 153, 0.12) 0%, rgba(2, 6, 23, 0) 55%), linear-gradient(180deg, rgba(2, 6, 23, 1) 0%, rgba(5, 11, 24, 0.94) 45%, rgba(5, 11, 24, 1) 100%)'
                        : 'radial-gradient(120% 120% at 12% 12%, rgba(125, 211, 252, 0.35) 0%, rgba(244, 247, 255, 0) 55%), radial-gradient(140% 140% at 85% 15%, rgba(196, 181, 253, 0.3) 0%, rgba(244, 247, 255, 0) 60%), linear-gradient(180deg, rgba(244, 247, 255, 1) 0%, rgba(230, 239, 255, 0.94) 45%, rgba(228, 235, 255, 1) 100%)',
                    backgroundAttachment: 'fixed',
                    color: theme?.customization?.isDarkMode ? 'rgba(226, 232, 240, 0.92)' : 'rgba(15, 23, 42, 0.9)',
                    transition: 'background 0.6s ease, color 0.6s ease',
                    minHeight: '100vh',
                    scrollbarWidth: 'thin',
                    scrollbarColor: theme?.customization?.isDarkMode
                        ? `${theme.colors?.grey500} ${theme.colors?.darkPrimaryMain}`
                        : `${theme.colors?.grey300} ${theme.paper}`,
                    '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
                        width: 12,
                        height: 12,
                        backgroundColor: theme?.customization?.isDarkMode ? theme.colors?.darkPrimaryMain : theme.paper
                    },
                    '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
                        borderRadius: 8,
                        backgroundColor: theme?.customization?.isDarkMode ? theme.colors?.grey500 : theme.colors?.grey300,
                        minHeight: 24,
                        border: `3px solid ${theme?.customization?.isDarkMode ? theme.colors?.darkPrimaryMain : theme.paper}`
                    },
                    '&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus': {
                        backgroundColor: theme?.customization?.isDarkMode ? theme.colors?.darkPrimary200 : theme.colors?.grey500
                    },
                    '&::-webkit-scrollbar-thumb:active, & *::-webkit-scrollbar-thumb:active': {
                        backgroundColor: theme?.customization?.isDarkMode ? theme.colors?.darkPrimary200 : theme.colors?.grey500
                    },
                    '&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover': {
                        backgroundColor: theme?.customization?.isDarkMode ? theme.colors?.darkPrimary200 : theme.colors?.grey500
                    },
                    '&::-webkit-scrollbar-corner, & *::-webkit-scrollbar-corner': {
                        backgroundColor: theme?.customization?.isDarkMode ? theme.colors?.darkPrimaryMain : theme.paper
                    }
                }
            }
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    fontWeight: 500,
                    borderRadius: '4px'
                }
            }
        },
        MuiSvgIcon: {
            styleOverrides: {
                root: {
                    color: theme?.customization?.isDarkMode ? theme.colors?.paper : 'inherit',
                    background: theme?.customization?.isDarkMode ? theme.colors?.darkPrimaryLight : 'inherit'
                }
            }
        },
        MuiPaper: {
            defaultProps: {
                elevation: 0
            },
            styleOverrides: {
                root: {
                    backgroundImage: 'none'
                },
                rounded: {
                    borderRadius: `${theme?.customization?.borderRadius}px`
                }
            }
        },
        MuiCardHeader: {
            styleOverrides: {
                root: {
                    color: theme.colors?.textDark,
                    padding: '24px'
                },
                title: {
                    fontSize: '1.125rem'
                }
            }
        },
        MuiCardContent: {
            styleOverrides: {
                root: {
                    padding: '24px'
                }
            }
        },
        MuiCardActions: {
            styleOverrides: {
                root: {
                    padding: '24px'
                }
            }
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    color: theme.darkTextPrimary,
                    borderRadius: `${baseRadius + 6}px`,
                    paddingTop: '10px',
                    paddingBottom: '10px',
                    margin: '6px 12px',
                    position: 'relative',
                    transition: 'transform 0.25s ease, background 0.3s ease, box-shadow 0.3s ease',
                    '&.Mui-selected': {
                        color: theme.menuSelected,
                        background: hoverBackground,
                        boxShadow: activeShadow,
                        transform: 'translateY(-2px)',
                        '&:hover': {
                            background: hoverBackground
                        },
                        '& .MuiListItemIcon-root': {
                            color: theme.menuSelected
                        }
                    },
                    '&:hover': {
                        background: hoverBackground,
                        color: theme.menuSelected,
                        transform: 'translateY(-1px)',
                        boxShadow: activeShadow,
                        '& .MuiListItemIcon-root': {
                            color: theme.menuSelected
                        }
                    }
                }
            }
        },
        MuiListItemIcon: {
            styleOverrides: {
                root: {
                    color: theme.darkTextPrimary,
                    minWidth: '36px'
                }
            }
        },
        MuiListItemText: {
            styleOverrides: {
                primary: {
                    color: theme.textDark
                }
            }
        },
        MuiInputBase: {
            styleOverrides: {
                input: {
                    color: theme.textDark,
                    '&::placeholder': {
                        color: theme.darkTextSecondary,
                        fontSize: '0.875rem'
                    },
                    '&.Mui-disabled': {
                        WebkitTextFillColor: theme?.customization?.isDarkMode ? theme.colors?.grey500 : theme.darkTextSecondary
                    }
                }
            }
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    background: theme?.customization?.isDarkMode ? theme.colors?.darkPrimary800 : bgColor,
                    borderRadius: `${theme?.customization?.borderRadius}px`,
                    '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: theme.colors?.grey400
                    },
                    '&:hover $notchedOutline': {
                        borderColor: theme.colors?.primaryLight
                    },
                    '&.MuiInputBase-multiline': {
                        padding: 1
                    }
                },
                input: {
                    fontWeight: 500,
                    background: theme?.customization?.isDarkMode ? theme.colors?.darkPrimary800 : bgColor,
                    padding: '15.5px 14px',
                    borderRadius: `${theme?.customization?.borderRadius}px`,
                    '&.MuiInputBase-inputSizeSmall': {
                        padding: '10px 14px',
                        '&.MuiInputBase-inputAdornedStart': {
                            paddingLeft: 0
                        }
                    }
                },
                inputAdornedStart: {
                    paddingLeft: 4
                },
                notchedOutline: {
                    borderRadius: `${theme?.customization?.borderRadius}px`
                }
            }
        },
        MuiSlider: {
            styleOverrides: {
                root: {
                    '&.Mui-disabled': {
                        color: theme.colors?.grey300
                    }
                },
                mark: {
                    backgroundColor: theme.paper,
                    width: '4px'
                },
                valueLabel: {
                    color: theme?.colors?.primaryLight
                }
            }
        },
        MuiDivider: {
            styleOverrides: {
                root: {
                    borderColor: theme.divider,
                    opacity: 1
                }
            }
        },
        MuiAvatar: {
            styleOverrides: {
                root: {
                    color: theme.colors?.primaryDark,
                    background: theme.colors?.primary200
                }
            }
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    '&.MuiChip-deletable .MuiChip-deleteIcon': {
                        color: 'inherit'
                    }
                }
            }
        },
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    color: theme?.customization?.isDarkMode ? theme.colors?.paper : theme.paper,
                    background: theme.colors?.grey700
                }
            }
        },
        MuiAutocomplete: {
            styleOverrides: {
                option: {
                    '&:hover': {
                        background: theme?.customization?.isDarkMode ? '#233345 !important' : ''
                    }
                }
            }
        }
    }
}
