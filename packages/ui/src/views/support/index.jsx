import { useState } from 'react'
import { Box, Button, Grid, MenuItem, TextField, Typography, Alert, List, ListItem, ListItemText, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Chip, Stack, Divider } from '@mui/material'
import { IconTrash, IconCheck, IconX } from '@tabler/icons-react'
import MainCard from '@/ui-component/cards/MainCard'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import useApi from '@/hooks/useApi'
import supportApi from '@/api/support'
import dayjs from 'dayjs'

const categories = [
    { value: 'Problem', label: 'Problem / Bug' },
    { value: 'Feedback', label: 'Feedback' },
    { value: 'Question', label: 'Question' },
    { value: 'Other', label: 'Other' }
]

const Support = () => {
    const submitTicketApi = useApi(supportApi.submitTicket)
    const listTicketsApi = useApi(supportApi.getTickets)
    const updateTicketApi = useApi(supportApi.updateTicket)
    const [form, setForm] = useState({ category: 'Problem', subject: '', message: '', name: '', email: '' })
    const [files, setFiles] = useState([])
    const [success, setSuccess] = useState('')
    const [tickets, setTickets] = useState([])
    const [detailOpen, setDetailOpen] = useState(false)
    const [selected, setSelected] = useState(null)

    const onChange = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

    const onFileChange = (e) => {
        const selected = Array.from(e.target.files || [])
        setFiles((prev) => [...prev, ...selected])
        e.target.value = '' // reset input
    }

    const removeFile = (index) => setFiles((prev) => prev.filter((_, i) => i !== index))

    const onSubmit = async () => {
        setSuccess('')
        try {
            const fd = new FormData()
            Object.entries(form).forEach(([k, v]) => fd.append(k, v))
            files.forEach((f) => fd.append('files', f, f.name))
            await submitTicketApi.request(fd)
            setSuccess('Your message has been sent. We will get back to you soon.')
            setForm({ category: 'Problem', subject: '', message: '', name: '', email: '' })
            setFiles([])
        } catch (_e) {}
    }

    const refreshTickets = async () => {
        try {
            const res = await listTicketsApi.request({ limit: 50 })
            setTickets(res.data?.data || [])
        } catch (_e) {}
    }

    // initial load
    useState(() => {
        refreshTickets()
    }, [])

    const openDetail = (ticket) => {
        setSelected(ticket)
        setDetailOpen(true)
    }

    const setStatus = async (status) => {
        if (!selected) return
        try {
            const res = await updateTicketApi.request(selected.id, { status })
            const updated = res.data
            setSelected(updated)
            setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
        } catch (_e) {}
    }

    return (
        <MainCard>
            <ViewHeader title='Support' description='Contact us with issues, feedback, or questions.' />
            <Box sx={{ p: 2 }}>
                {success && (
                    <Alert severity='success' sx={{ mb: 2 }}>
                        {success}
                    </Alert>
                )}
                <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                        <TextField select fullWidth label='Category' value={form.category} onChange={onChange('category')}>
                            {categories.map((c) => (
                                <MenuItem key={c.value} value={c.value}>
                                    {c.label}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <TextField fullWidth label='Subject' value={form.subject} onChange={onChange('subject')} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <TextField fullWidth label='Your Name' value={form.name} onChange={onChange('name')} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <TextField fullWidth type='email' label='Your Email' value={form.email} onChange={onChange('email')} />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label='Message'
                            value={form.message}
                            onChange={onChange('message')}
                            multiline
                            rows={6}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <Button variant='outlined' component='label'>
                            Add attachments
                            <input hidden type='file' multiple onChange={onFileChange} />
                        </Button>
                        {files.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                                <Typography variant='body2' color='text.secondary'>Selected files:</Typography>
                                <List dense>
                                    {files.map((f, idx) => (
                                        <ListItem key={idx}
                                            secondaryAction={
                                                <IconButton edge='end' aria-label='delete' onClick={() => removeFile(idx)}>
                                                    <IconTrash size={16} />
                                                </IconButton>
                                            }
                                        >
                                            <ListItemText primary={f.name} secondary={`${f.type || 'unknown'} • ${(f.size/1024).toFixed(1)} KB`} />
                                        </ListItem>
                                    ))}
                                </List>
                            </Box>
                        )}
                    </Grid>
                    <Grid item xs={12}>
                        <Button variant='contained' onClick={onSubmit} disabled={submitTicketApi.loading || !form.message}>
                            {submitTicketApi.loading ? 'Sending…' : 'Send'}
                        </Button>
                    </Grid>
                </Grid>
                <Typography variant='body2' color='text.secondary' sx={{ mt: 2 }}>
                    We will deliver your message to our support email (freia-agents@gmail.com).
                </Typography>

                <Box sx={{ mt: 4 }}>
                    <Typography variant='h4' gutterBottom>
                        Ticket History
                    </Typography>
                    {listTicketsApi.loading ? (
                        <Typography>Loading…</Typography>
                    ) : tickets.length === 0 ? (
                        <Typography color='text.secondary'>No tickets yet.</Typography>
                    ) : (
                        <Box sx={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: 8 }}>Created</th>
                                        <th style={{ textAlign: 'left', padding: 8 }}>Category</th>
                                        <th style={{ textAlign: 'left', padding: 8 }}>Subject</th>
                                        <th style={{ textAlign: 'left', padding: 8 }}>Status</th>
                                        <th style={{ textAlign: 'left', padding: 8 }}>Attachments</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tickets.map((t) => {
                                        const att = t.attachments ? JSON.parse(t.attachments) : []
                                        return (
                                            <tr key={t.id} style={{ borderTop: '1px solid #eee', cursor: 'pointer' }} onClick={() => openDetail(t)}>
                                                <td style={{ padding: 8 }}>{dayjs(t.createdDate).format('YYYY-MM-DD HH:mm')}</td>
                                                <td style={{ padding: 8 }}>{t.category || '-'}</td>
                                                <td style={{ padding: 8 }}>{t.subject || '-'}</td>
                                                <td style={{ padding: 8 }}>
                                                    <Chip size='small' label={t.status} color={t.status === 'CLOSED' ? 'default' : 'success'} />
                                                </td>
                                                <td style={{ padding: 8 }}>
                                                    {att.length ? (
                                                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                                                            {att.map((a, idx) => (
                                                                <li key={idx}>
                                                                    {a.location ? (
                                                                        <a href={a.location} target='_blank' rel='noreferrer'>
                                                                            {a.originalname}
                                                                        </a>
                                                                    ) : (
                                                                        a.originalname
                                                                    )}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        '-'
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </Box>
                    )}
                </Box>
                <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} fullWidth maxWidth='md'>
                    <DialogTitle>Ticket Detail</DialogTitle>
                    <DialogContent dividers>
                        {!selected ? (
                            <Typography>Loading…</Typography>
                        ) : (
                            <Box>
                                <Stack direction='row' spacing={1} alignItems='center' sx={{ mb: 1 }}>
                                    <Chip label={selected.status} color={selected.status === 'CLOSED' ? 'default' : 'success'} />
                                    <Divider flexItem orientation='vertical' sx={{ mx: 1 }} />
                                    <Typography variant='body2' color='text.secondary'>
                                        {dayjs(selected.createdDate).format('YYYY-MM-DD HH:mm')}
                                    </Typography>
                                </Stack>
                                <Typography variant='h6' gutterBottom>
                                    {selected.subject || '(No subject)'}
                                </Typography>
                                <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                                    From: {selected.name || 'Anonymous'} {selected.email ? `<${selected.email}>` : ''}
                                </Typography>
                                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{selected.message}</Typography>
                                {selected.attachments && (
                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant='subtitle2'>Attachments</Typography>
                                        <List dense>
                                            {JSON.parse(selected.attachments).map((a, idx) => (
                                                <ListItem key={idx}>
                                                    <ListItemText
                                                        primary={a.location ? <a href={a.location} target='_blank' rel='noreferrer'>{a.originalname}</a> : a.originalname}
                                                        secondary={`${a.mimetype || ''} • ${(a.size/1024).toFixed(1)} KB`}
                                                    />
                                                </ListItem>
                                            ))}
                                        </List>
                                    </Box>
                                )}
                            </Box>
                        )}
                    </DialogContent>
                    <DialogActions>
                        {selected && selected.status !== 'CLOSED' ? (
                            <Button color='error' startIcon={<IconX size={16} />} onClick={() => setStatus('CLOSED')} disabled={updateTicketApi.loading}>
                                Mark Closed
                            </Button>
                        ) : (
                            <Button color='success' startIcon={<IconCheck size={16} />} onClick={() => setStatus('OPEN')} disabled={updateTicketApi.loading}>
                                Reopen
                            </Button>
                        )}
                        <Button onClick={() => setDetailOpen(false)}>Close</Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </MainCard>
    )
}

export default Support
