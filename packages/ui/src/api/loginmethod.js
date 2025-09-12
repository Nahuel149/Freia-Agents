import client from '@/api/client'

// OSS Mode: Use default login methods without organization context
const getLoginMethods = () => client.get(`/loginmethod/default`)
const getDefaultLoginMethods = () => client.get(`/loginmethod/default`)
const updateLoginMethods = (body) => client.put(`/loginmethod`, body)

const testLoginMethod = (body) => client.post(`/loginmethod/test`, body)

export default {
    getLoginMethods,
    updateLoginMethods,
    testLoginMethod,
    getDefaultLoginMethods
}
