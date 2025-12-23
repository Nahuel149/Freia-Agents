import axios from 'axios'
import { baseURL, ErrorMessage } from '@/store/constant'
import AuthUtils from '@/utils/authUtils'

const apiClient = axios.create({
    baseURL: `${baseURL}/api/v1`,
    headers: {
        'Content-type': 'application/json',
        'x-request-from': 'internal'
    },
    withCredentials: true
})

// Attach a correlation id to each request if not present
apiClient.interceptors.request.use((config) => {
    try {
        const hasId = config.headers && (config.headers['x-request-id'] || config.headers['X-Request-Id'])
        if (!hasId) {
            const id =
                typeof crypto !== 'undefined' && crypto.randomUUID
                    ? crypto.randomUUID()
                    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
            if (!config.headers) config.headers = {}
            config.headers['x-request-id'] = id
        }
        const token = localStorage.getItem('token')
        if (token && config.headers) {
            config.headers['Authorization'] = `Bearer ${token}`
        }
    } catch (_e) {
        // no-op
    }
    return config
})

apiClient.interceptors.response.use(
    function (response) {
        return response
    },
    async (error) => {
        try {
            const reqId = error?.response?.headers?.['x-request-id'] || error?.config?.headers?.['x-request-id']
            if (reqId) {
                console.error(
                    '[HTTP]',
                    error?.config?.method?.toUpperCase(),
                    error?.config?.url,
                    'reqId=',
                    reqId,
                    'status=',
                    error?.response?.status,
                    'message=',
                    error?.message
                )
            }
        } catch (_e) {}
        // Check if error.response exists (network errors don't have response)
        if (error.response && error.response.status === 401) {
            // check if refresh is needed
            if (error.response.data.message === ErrorMessage.TOKEN_EXPIRED && error.response.data.retry === true) {
                const originalRequest = error.config
                // call api to get new token
                const response = await axios.post(`${baseURL}/api/v1/auth/refreshToken`, {}, { withCredentials: true })
                if (response.data.id) {
                    // retry the original request
                    return apiClient.request(originalRequest)
                }
            }
            localStorage.removeItem('username')
            localStorage.removeItem('password')
            AuthUtils.removeCurrentUser()
        }

        return Promise.reject(error)
    }
)

export default apiClient
