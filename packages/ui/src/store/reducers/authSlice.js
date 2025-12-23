// authSlice.js
import { createSlice } from '@reduxjs/toolkit'
import AuthUtils from '@/utils/authUtils'

const initialState = {
    user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null,
    isAuthenticated: 'true' === localStorage.getItem('isAuthenticated'),
    isGlobal: 'true' === localStorage.getItem('isGlobal'),
    token: localStorage.getItem('token'),
    permissions:
        localStorage.getItem('permissions') && localStorage.getItem('permissions') !== 'undefined'
            ? JSON.parse(localStorage.getItem('permissions'))
            : null,
    features:
        localStorage.getItem('features') && localStorage.getItem('features') !== 'undefined'
            ? JSON.parse(localStorage.getItem('features'))
            : null
}

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        loginSuccess: (state, action) => {
            AuthUtils.updateStateAndLocalStorage(state, action.payload)
        },
        logoutSuccess: (state) => {
            state.user = null
            state.token = null
            state.permissions = null
            state.features = null
            state.isAuthenticated = false
            state.isGlobal = false
            AuthUtils.removeCurrentUser()
        },
        // OSS Mode: Workspace switching and plan upgrades removed
        userProfileUpdated: (state, action) => {
            const user = AuthUtils.extractUser(action.payload)
            state.user.name = user.name
            state.user.email = user.email
            AuthUtils.updateCurrentUser(state.user)
        }
        // OSS Mode: Workspace name updates removed
    }
})

export const { loginSuccess, logoutSuccess, userProfileUpdated } = authSlice.actions
export default authSlice.reducer
