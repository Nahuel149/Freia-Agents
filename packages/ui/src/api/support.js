import client from './client'

const submitTicket = (payload) => {
    if (payload instanceof FormData) {
        return client.post('/support/tickets', payload, { headers: { 'Content-Type': 'multipart/form-data' } })
    }
    const fd = new FormData()
    Object.entries(payload || {}).forEach(([k, v]) => fd.append(k, v))
    return client.post('/support/tickets', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}

export default {
    submitTicket,
    getTickets: (params={}) => client.get('/support/tickets', { params }),
    getTicket: (id) => client.get(`/support/tickets/${id}`),
    updateTicket: (id, body) => client.patch(`/support/tickets/${id}`, body)
}
