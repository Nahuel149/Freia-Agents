#!/usr/bin/env node

const { spawn } = require('child_process')
const axios = require('axios')
const path = require('path')

// Configuration
const SERVER_PORT = 3000
const UI_PORT = 8080
const MAX_RETRIES = 60 // 60 retries = 2 minutes max wait time
const RETRY_INTERVAL = 2000 // 2 seconds between retries

console.log('🚀 Starting Flowise in sequential mode...\n')

// Function to check if server is ready
async function checkServerHealth() {
    try {
        const response = await axios.get(`http://localhost:${SERVER_PORT}/api/v1/ping`, {
            timeout: 5000
        })
        return response.status === 200
    } catch (error) {
        return false
    }
}

// Function to wait for server to be ready
async function waitForServer() {
    console.log('⏳ Waiting for server to be ready...')

    for (let i = 0; i < MAX_RETRIES; i++) {
        const isReady = await checkServerHealth()

        if (isReady) {
            console.log('✅ Server is ready!\n')
            return true
        }

        process.stdout.write(`   Attempt ${i + 1}/${MAX_RETRIES} - Server not ready yet...\r`)
        await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL))
    }

    console.log('\n❌ Server failed to start within the expected time.')
    return false
}

// Function to start a process
function startProcess(command, args, cwd, label) {
    console.log(`🔄 Starting ${label}...`)

    const process = spawn(command, args, {
        cwd,
        stdio: 'inherit',
        shell: true
    })

    process.on('error', (error) => {
        console.error(`❌ Error starting ${label}:`, error)
    })

    return process
}

// Main execution
async function main() {
    try {
        // Start the server
        const serverProcess = startProcess('pnpm', ['dev'], path.join(__dirname, '..', 'packages', 'server'), 'Server')

        // Wait for server to be ready
        const serverReady = await waitForServer()

        if (!serverReady) {
            console.log('❌ Aborting UI startup due to server startup failure.')
            process.exit(1)
        }

        // Start the UI
        const uiProcess = startProcess('pnpm', ['dev'], path.join(__dirname, '..', 'packages', 'ui'), 'UI')

        console.log('🎉 Both server and UI are now running!')
        console.log(`📊 Server: http://localhost:${SERVER_PORT}`)
        console.log(`🎨 UI: http://localhost:${UI_PORT}`)

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down...')
            serverProcess.kill('SIGINT')
            uiProcess.kill('SIGINT')
            process.exit(0)
        })

        process.on('SIGTERM', () => {
            console.log('\n🛑 Shutting down...')
            serverProcess.kill('SIGTERM')
            uiProcess.kill('SIGTERM')
            process.exit(0)
        })
    } catch (error) {
        console.error('❌ Error in sequential startup:', error)
        process.exit(1)
    }
}

main()
