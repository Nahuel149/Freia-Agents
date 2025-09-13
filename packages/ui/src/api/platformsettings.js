import client from './client'

// Use '/app-settings' to avoid potential ad-block rules on '/settings'
const getSettings = () => client.get('/app-settings')

export default {
    getSettings
}
