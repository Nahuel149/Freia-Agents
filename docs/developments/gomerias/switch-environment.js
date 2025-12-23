const fs = require('fs')

// Configuraciones por entorno
const environments = {
    local: {
        API_BASE_URL: 'http://localhost:3000',
        API_KEY: 'local-dev-key'
    },
    production: {
        API_BASE_URL: 'https://freia-agents.onrender.com',
        API_KEY: 'freia-api-key-2024'
    }
}

// Obtener el entorno del argumento de línea de comandos
const environment = process.argv[2]

if (!environment || !environments[environment]) {
    console.log('❌ Uso: node switch-environment.js [local|production]')
    console.log('📝 Ejemplos:')
    console.log('   node switch-environment.js local')
    console.log('   node switch-environment.js production')
    process.exit(1)
}

const config = environments[environment]
const inputFile = 'ChatFlowAgentv2.0-with-tools.json'
const outputFile = `ChatFlowAgentv2.0-${environment}.json`

try {
    console.log(`🔄 Configurando para entorno: ${environment.toUpperCase()}`)

    // Leer el archivo original
    const data = fs.readFileSync(inputFile, 'utf8')
    let chatflow = JSON.parse(data)

    let updatedCount = 0

    // Actualizar todos los nodos
    if (chatflow.nodes) {
        chatflow.nodes.forEach((node) => {
            if (node.data && node.data.inputs) {
                // Actualizar URL
                if (node.data.inputs.url) {
                    const oldUrl = node.data.inputs.url
                    node.data.inputs.url = oldUrl
                        .replace(/\$\{FREIA_API_BASE_URL\}/g, config.API_BASE_URL)
                        .replace(/https:\/\/freia-agents\.onrender\.com/g, config.API_BASE_URL)
                        .replace(/http:\/\/localhost:3000/g, config.API_BASE_URL)

                    if (oldUrl !== node.data.inputs.url) {
                        updatedCount++
                    }
                }

                // Actualizar headers con API key
                if (node.data.inputs.headers) {
                    node.data.inputs.headers = node.data.inputs.headers
                        .replace(/\$\{FREIA_API_KEY\}/g, config.API_KEY)
                        .replace(/freia-api-key-2024/g, config.API_KEY)
                        .replace(/local-dev-key/g, config.API_KEY)
                }
            }
        })
    }

    // Guardar el archivo actualizado
    fs.writeFileSync(outputFile, JSON.stringify(chatflow, null, 2))

    console.log('✅ Configuración completada!')
    console.log(`📁 Archivo generado: ${outputFile}`)
    console.log(`🔗 API Base URL: ${config.API_BASE_URL}`)
    console.log(`🔑 API Key: [CONFIGURADA]`)
    console.log(`📊 Nodos actualizados: ${updatedCount}`)
} catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
}
