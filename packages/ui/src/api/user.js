import client from './client'

// OSS Mode - Simplified user API without workspace/organization management
// Enterprise features removed for single-user OSS mode

// users
const getUserById = (id) => client.get(`/user?id=${id}`)
const updateUser = (body) => client.put(`/user`, body)

export default {
    getUserById,
    updateUser
}
