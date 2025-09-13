import express from 'express'

const router = express.Router()

// Test route to verify router is working
router.get('/test-route', async (req, res) => {
    return res.json({ message: 'loginmethod router is working' })
})

// GET /loginmethod/default - Get default login methods for OSS mode
router.get('/default', async (req, res) => {
    try {
        // In OSS mode, return a simple default login method configuration
        const defaultLoginMethod = {
            id: 'default',
            name: 'default',
            status: 'ENABLE',
            config: {
                enabled: true,
                type: 'local'
            }
        }
        
        return res.json([defaultLoginMethod])
    } catch (error) {
        console.error('Error getting default login methods:', error)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// PUT /loginmethod - Update login methods (no-op in OSS mode)
router.put('/', async (req, res) => {
    try {
        // In OSS mode, just return success without actually updating anything
        return res.json({ success: true, message: 'Login method updated (OSS mode)' })
    } catch (error) {
        console.error('Error updating login methods:', error)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// POST /loginmethod/test - Test login method (no-op in OSS mode)
router.post('/test', async (req, res) => {
    try {
        // In OSS mode, just return success
        return res.json({ success: true, message: 'Login method test successful (OSS mode)' })
    } catch (error) {
        console.error('Error testing login method:', error)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

export default router