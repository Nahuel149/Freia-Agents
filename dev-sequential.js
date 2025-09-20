const { spawn } = require('child_process');
const fetch = require('node-fetch');

// Health check function to verify server is ready
const checkServerHealth = async () => {
    try {
        const response = await fetch('http://localhost:3000/api/v1/ping', {
            method: 'GET',
            timeout: 5000
        });
        return response.ok && response.status === 200;
    } catch (error) {
        return false;
    }
};

// Wait for server to be ready with timeout
const waitForServer = async (maxWaitTime = 60000) => {
    const startTime = Date.now();
    console.log('🔍 Waiting for server to be ready...');
    
    while (Date.now() - startTime < maxWaitTime) {
        if (await checkServerHealth()) {
            console.log('✅ Server is ready!');
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 2000)); // Check every 2 seconds
    }
    
    console.log('❌ Server failed to start within timeout period');
    return false;
};

// Start server process
const startServer = () => {
    console.log('🚀 Starting server...');
    const serverProcess = spawn('pnpm', ['dev'], {
        stdio: 'inherit',
        shell: true,
        cwd: 'packages/server'
    });

    serverProcess.on('error', (error) => {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    });

    return serverProcess;
};

// Start UI process
const startUI = () => {
    console.log('🎨 Starting UI...');
    const uiProcess = spawn('pnpm', ['dev'], {
        stdio: 'inherit',
        shell: true,
        cwd: 'packages/ui'
    });

    uiProcess.on('error', (error) => {
        console.error('❌ Failed to start UI:', error);
        process.exit(1);
    });

    return uiProcess;
};

// Main sequential startup function
const main = async () => {
    let serverProcess = null;
    let uiProcess = null;

    // Graceful shutdown handler
    const shutdown = () => {
        console.log('\n🛑 Shutting down processes...');
        if (uiProcess) {
            uiProcess.kill('SIGTERM');
        }
        if (serverProcess) {
            serverProcess.kill('SIGTERM');
        }
        process.exit(0);
    };

    // Handle shutdown signals
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    try {
        // Step 1: Start server
        serverProcess = startServer();

        // Step 2: Wait for server to be ready
        const serverReady = await waitForServer();
        
        if (!serverReady) {
            console.error('❌ Server failed to start. Exiting...');
            if (serverProcess) {
                serverProcess.kill('SIGTERM');
            }
            process.exit(1);
        }

        // Step 3: Start UI once server is ready
        uiProcess = startUI();

        console.log('🎉 Both server and UI are now running!');
        console.log('📱 UI: http://localhost:8080');
        console.log('🔧 Server: http://localhost:3000');

        // Keep the process alive
        process.stdin.resume();

    } catch (error) {
        console.error('❌ Error during startup:', error);
        shutdown();
    }
};

// Run the main function
main().catch(console.error);