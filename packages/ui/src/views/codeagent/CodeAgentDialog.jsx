import { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import PropTypes from 'prop-types'

// material-ui
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
    Box,
    Stack,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Typography,
    Divider
} from '@mui/material'
import { useTheme } from '@mui/material/styles'

// third party
import * as Yup from 'yup'
import { Formik } from 'formik'

// project imports
import { StyledButton } from '@/ui-component/button/StyledButton'
import { BackdropLoader } from '@/ui-component/loading/BackdropLoader'

// API
import codeAgentApi from '@/api/codeAgent'

// Hooks
import useApi from '@/hooks/useApi'
import useNotifier from '@/utils/useNotifier'

// store
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'

// icons
import { IconCode } from '@tabler/icons-react'

const CodeAgentDialog = ({ show, dialogProps, onCancel, onConfirm }) => {
    const theme = useTheme()
    const dispatch = useDispatch()

    useNotifier()
    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const [loading, setLoading] = useState(false)

    const createCodeAgentApi = useApi(codeAgentApi.createCodeAgent)
    const updateCodeAgentApi = useApi(codeAgentApi.updateCodeAgent)

    const component = show ? 'dialog' : 'none'

    const validationSchema = Yup.object({
        name: Yup.string().required('Name is required').max(100, 'Name must be less than 100 characters'),
        description: Yup.string().max(500, 'Description must be less than 500 characters'),
        language: Yup.string().required('Language is required'),
        code: Yup.string().required('Code is required')
    })

    const initialValues = {
        name: dialogProps.data?.name || '',
        description: dialogProps.data?.description || '',
        language: dialogProps.data?.language || 'javascript',
        code: dialogProps.data?.code || getDefaultCode('javascript')
    }

    function getDefaultCode(language) {
        const templates = {
            javascript: `// CodeAgent JavaScript Template
// This code will be executed in a secure Node.js environment

// Export your main function
module.exports = async function(input, context) {
    // Your code here
    console.log('Hello from CodeAgent!');
    console.log('Input:', input);
    
    // You can use context for chat history, user info, etc.
    // context.chatHistory, context.user, context.sessionId
    
    // Return your response
    return {
        message: 'Hello! I processed your request.',
        data: input
    };
};`,
            python: `# CodeAgent Python Template
# This code will be executed in a secure Python environment

def main(input_data, context):
    """Main function that will be called by CodeAgent
    
    Args:
        input_data: The input from the user
        context: Context object with chat history, user info, etc.
    
    Returns:
        dict: Response object with message and data
    """
    print('Hello from CodeAgent!')
    print('Input:', input_data)
    
    # You can use context for chat history, user info, etc.
    # context['chat_history'], context['user'], context['session_id']
    
    # Return your response
    return {
        'message': 'Hello! I processed your request.',
        'data': input_data
    }`,
            typescript: `// CodeAgent TypeScript Template
// This code will be executed in a secure Node.js environment

interface Input {
    [key: string]: any;
}

interface Context {
    chatHistory?: any[];
    user?: any;
    sessionId?: string;
    [key: string]: any;
}

interface Response {
    message: string;
    data?: any;
}

// Export your main function
export default async function(input: Input, context: Context): Promise<Response> {
    // Your code here
    console.log('Hello from CodeAgent!');
    console.log('Input:', input);
    
    // You can use context for chat history, user info, etc.
    // context.chatHistory, context.user, context.sessionId
    
    // Return your response
    return {
        message: 'Hello! I processed your request.',
        data: input
    };
}`
        }
        return templates[language] || templates.javascript
    }

    const handleSubmit = async (values) => {
        try {
            setLoading(true)
            
            const codeAgentData = {
                name: values.name,
                description: values.description,
                language: values.language,
                code: values.code
            }

            if (dialogProps.type === 'ADD') {
                await createCodeAgentApi.request(codeAgentData)
                enqueueSnackbar({
                    message: 'CodeAgent created successfully',
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'success'
                    }
                })
            } else {
                await updateCodeAgentApi.request(dialogProps.data.id, codeAgentData)
                enqueueSnackbar({
                    message: 'CodeAgent updated successfully',
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'success'
                    }
                })
            }
            
            onConfirm()
        } catch (error) {
            console.error('Error saving CodeAgent:', error)
            enqueueSnackbar({
                message: `Failed to ${dialogProps.type === 'ADD' ? 'create' : 'update'} CodeAgent`,
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error'
                }
            })
        } finally {
            setLoading(false)
        }
    }

    const handleLanguageChange = (language, setFieldValue, values) => {
        setFieldValue('language', language)
        // Only update code if it's still the default template
        const currentDefault = getDefaultCode(values.language)
        if (values.code === currentDefault || !values.code.trim()) {
            setFieldValue('code', getDefaultCode(language))
        }
    }

    return (
        <Dialog
            open={show}
            onClose={onCancel}
            maxWidth='md'
            fullWidth
            sx={{
                '& .MuiDialog-paper': {
                    height: '80vh'
                }
            }}
        >
            <DialogTitle>
                <Box display='flex' alignItems='center' gap={1}>
                    <IconCode size={24} color={theme.palette.primary.main} />
                    <Typography variant='h4'>{dialogProps.title}</Typography>
                </Box>
            </DialogTitle>
            
            <Formik
                initialValues={initialValues}
                validationSchema={validationSchema}
                onSubmit={handleSubmit}
                enableReinitialize
            >
                {({ values, errors, touched, handleChange, handleBlur, handleSubmit, setFieldValue }) => (
                    <form onSubmit={handleSubmit}>
                        <DialogContent>
                            <Stack spacing={3}>
                                <TextField
                                    fullWidth
                                    label='Name'
                                    name='name'
                                    value={values.name}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    error={touched.name && Boolean(errors.name)}
                                    helperText={touched.name && errors.name}
                                    placeholder='Enter CodeAgent name'
                                />
                                
                                <TextField
                                    fullWidth
                                    label='Description'
                                    name='description'
                                    value={values.description}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    error={touched.description && Boolean(errors.description)}
                                    helperText={touched.description && errors.description}
                                    placeholder='Enter CodeAgent description'
                                    multiline
                                    rows={2}
                                />
                                
                                <FormControl fullWidth>
                                    <InputLabel>Language</InputLabel>
                                    <Select
                                        value={values.language}
                                        label='Language'
                                        onChange={(e) => handleLanguageChange(e.target.value, setFieldValue, values)}
                                    >
                                        <MenuItem value='javascript'>JavaScript</MenuItem>
                                        <MenuItem value='typescript'>TypeScript</MenuItem>
                                        <MenuItem value='python'>Python</MenuItem>
                                    </Select>
                                </FormControl>
                                
                                <Divider />
                                
                                <Typography variant='h6'>Code</Typography>
                                
                                <TextField
                                    fullWidth
                                    label='Code'
                                    name='code'
                                    value={values.code}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    error={touched.code && Boolean(errors.code)}
                                    helperText={touched.code && errors.code}
                                    placeholder='Enter your code here'
                                    multiline
                                    rows={15}
                                    sx={{
                                        '& .MuiInputBase-input': {
                                            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                                            fontSize: '14px'
                                        }
                                    }}
                                />
                            </Stack>
                        </DialogContent>
                        
                        <DialogActions>
                            <Button onClick={onCancel}>Cancel</Button>
                            <StyledButton
                                type='submit'
                                variant='contained'
                                color='primary'
                                disabled={loading}
                            >
                                {dialogProps.type === 'ADD' ? 'Create' : 'Update'}
                            </StyledButton>
                        </DialogActions>
                    </form>
                )}
            </Formik>
            
            <BackdropLoader open={loading} />
        </Dialog>
    )
}

CodeAgentDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func
}

export default CodeAgentDialog