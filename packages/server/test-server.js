const { start } = require('./dist/index.js');

console.log('Starting Flowise server...');

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

start()
    .then(() => {
        console.log('Server started successfully!');
        // Keep the process running
        process.stdin.resume();
    })
    .catch((err) => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });