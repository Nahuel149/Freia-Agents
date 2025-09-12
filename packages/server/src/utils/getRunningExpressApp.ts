let Server: any = null

export const getRunningExpressApp = function () {
    if (!Server) {
        Server = require('../index')
    }
    const runningExpressInstance = Server.getInstance()
    if (
        typeof runningExpressInstance === 'undefined' ||
        typeof runningExpressInstance.nodesPool === 'undefined' ||
        typeof runningExpressInstance.telemetry === 'undefined'
    ) {
        throw new Error(`Error: getRunningExpressApp failed!`)
    }
    return runningExpressInstance
}
