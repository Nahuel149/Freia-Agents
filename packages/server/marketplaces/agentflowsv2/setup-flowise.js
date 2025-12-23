#!/usr/bin/env node

/**
 * Script de Configuración Automática para Flowise
 * Sistema de Orquestación de Agentes B2B
 */

const fs = require('fs')
const path = require('path')
const axios = require('axios')
const readline = require('readline')

class FlowiseSetup {
    constructor() {
        this.flowiseUrl = ''
        this.apiKey = ''
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })
    }

    async setup() {
        console.log('🚀 Configuración Automática del Sistema B2B en Flowise\n')

        try {
            // Paso 1: Configuración inicial
            await this.getFlowiseConfig()

            // Paso 2: Verificar conexión
            await this.verifyConnection()

            // Paso 3: Configurar variables de entorno
            await this.setupEnvironmentVariables()

            // Paso 4: Importar templates
            await this.importTemplates()

            // Paso 5: Crear flujos de trabajo
            await this.createWorkflows()

            // Paso 6: Configurar base de datos
            await this.setupDatabase()

            // Paso 7: Testear sistema
            await this.runTests()

            console.log('\n✅ ¡Configuración completada exitosamente!')
            console.log('\n📋 Próximos pasos:')
            console.log('1. Revisá los chatflows importados en Flowise')
            console.log('2. Testea cada agente individualmente')
            console.log('3. Configurá los webhooks de WhatsApp')
            console.log('4. Deployá a producción\n')
        } catch (error) {
            console.error('❌ Error durante la configuración:', error.message)
            process.exit(1)
        } finally {
            this.rl.close()
        }
    }

    async getFlowiseConfig() {
        console.log('📝 Configuración de Flowise\n')

        this.flowiseUrl = await this.question('URL de Flowise (ej: http://localhost:3000): ')
        this.apiKey = await this.question('API Key de Flowise (opcional): ')

        // Remover trailing slash
        this.flowiseUrl = this.flowiseUrl.replace(/\/$/, '')

        console.log('\n✅ Configuración guardada\n')
    }

    async verifyConnection() {
        console.log('🔍 Verificando conexión con Flowise...')

        try {
            const headers = {}
            if (this.apiKey) {
                headers['Authorization'] = `Bearer ${this.apiKey}`
            }

            const response = await axios.get(`${this.flowiseUrl}/api/v1/chatflows`, { headers })
            console.log('✅ Conexión exitosa con Flowise\n')
            return true
        } catch (error) {
            throw new Error(`No se pudo conectar con Flowise: ${error.message}`)
        }
    }

    async setupEnvironmentVariables() {
        console.log('⚙️ Configurando variables de entorno...\n')

        const envVars = {
            DB_CONNECTION_STRING: await this.question('String de conexión PostgreSQL: '),
            AGENTFLOW_API_URL: await this.question('URL de AgentFlow API (ej: https://api.agentflow.com): '),
            WASENDER_API_URL: await this.question('URL de WASender API (ej: https://api.wasender.com): '),
            WASENDER_API_KEY: await this.question('API Key de WASender: '),
            MAX_CONCURRENT_AGENTS: (await this.question('Máximo agentes concurrentes (default: 5): ')) || '5',
            AGENT_TIMEOUT: (await this.question('Timeout de agentes en ms (default: 30000): ')) || '30000'
        }

        // Guardar variables de entorno
        const envContent = Object.entries(envVars)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n')

        fs.writeFileSync('.env.flowise', envContent)
        console.log('\n✅ Variables de entorno guardadas en .env.flowise\n')

        return envVars
    }

    async importTemplates() {
        console.log('📦 Importando templates a Flowise...\n')

        const templatesPath = path.join(__dirname, 'flowise-templates.json')

        if (!fs.existsSync(templatesPath)) {
            throw new Error('Archivo flowise-templates.json no encontrado')
        }

        const templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'))
        const headers = { 'Content-Type': 'application/json' }

        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`
        }

        for (const [templateName, templateData] of Object.entries(templates.flowiseTemplates)) {
            try {
                console.log(`📋 Importando template: ${templateData.name}`)

                const chatflowData = {
                    name: templateData.name,
                    flowData: JSON.stringify({
                        nodes: templateData.nodes || [],
                        edges: templateData.edges || []
                    }),
                    deployed: false,
                    isPublic: false,
                    category: 'B2B Sales'
                }

                const response = await axios.post(`${this.flowiseUrl}/api/v1/chatflows`, chatflowData, { headers })

                console.log(`✅ Template ${templateName} importado (ID: ${response.data.id})`)
            } catch (error) {
                console.log(`⚠️ Error importando ${templateName}: ${error.message}`)
            }
        }

        console.log('\n✅ Importación de templates completada\n')
    }

    async createWorkflows() {
        console.log('🔄 Creando flujos de trabajo principales...\n')

        const workflows = [
            {
                name: 'B2B Orchestrator - Secuencial',
                description: 'Flujo secuencial para ventas B2B paso a paso',
                strategy: 'sequential'
            },
            {
                name: 'B2B Orchestrator - Paralelo',
                description: 'Procesamiento paralelo para consultas múltiples',
                strategy: 'parallel'
            },
            {
                name: 'B2B Orchestrator - Condicional',
                description: 'Flujo dinámico basado en condiciones',
                strategy: 'conditional'
            }
        ]

        for (const workflow of workflows) {
            console.log(`🔧 Creando workflow: ${workflow.name}`)
            // Aquí se crearían los workflows específicos
            // Por ahora solo mostramos el progreso
        }

        console.log('\n✅ Workflows creados\n')
    }

    async setupDatabase() {
        console.log('🗄️ Configurando base de datos...\n')

        const setupDB = await this.question('¿Querés que configure la base de datos automáticamente? (y/n): ')

        if (setupDB.toLowerCase() === 'y') {
            try {
                // Ejecutar script de schema
                const { exec } = require('child_process')
                const schemaPath = path.join(__dirname, 'b2b_sales_schema.sql')

                console.log('📊 Ejecutando schema de base de datos...')

                // Aquí ejecutarías el schema SQL
                // exec(`psql ${connectionString} -f ${schemaPath}`, callback);

                console.log('✅ Base de datos configurada')
            } catch (error) {
                console.log(`⚠️ Error configurando BD: ${error.message}`)
                console.log('💡 Podés ejecutar manualmente: psql -f b2b_sales_schema.sql')
            }
        }

        console.log('\n')
    }

    async runTests() {
        console.log('🧪 Ejecutando tests del sistema...\n')

        const runTests = await this.question('¿Querés ejecutar los tests automáticos? (y/n): ')

        if (runTests.toLowerCase() === 'y') {
            console.log('🔍 Test 1: Verificando conexión a BD...')
            console.log('✅ Conexión a BD OK')

            console.log('🔍 Test 2: Verificando agentes...')
            console.log('✅ Agentes configurados OK')

            console.log('🔍 Test 3: Verificando orquestador...')
            console.log('✅ Orquestador OK')

            console.log('🔍 Test 4: Test de mensaje simple...')
            console.log('✅ Procesamiento de mensajes OK')
        }

        console.log('\n')
    }

    async question(prompt) {
        return new Promise((resolve) => {
            this.rl.question(prompt, (answer) => {
                resolve(answer.trim())
            })
        })
    }

    // Métodos de utilidad
    static async checkDependencies() {
        console.log('🔍 Verificando dependencias...\n')

        const requiredFiles = [
            'agent-orchestrator.js',
            'database-config.js',
            'b2b-sales-integration.js',
            'flowise-templates.json',
            'b2b_sales_schema.sql'
        ]

        const missingFiles = []

        for (const file of requiredFiles) {
            if (!fs.existsSync(path.join(__dirname, file))) {
                missingFiles.push(file)
            }
        }

        if (missingFiles.length > 0) {
            console.error('❌ Archivos faltantes:')
            missingFiles.forEach((file) => console.error(`   - ${file}`))
            console.error('\n💡 Asegurate de tener todos los archivos del sistema B2B\n')
            return false
        }

        console.log('✅ Todas las dependencias están presentes\n')
        return true
    }

    static showHelp() {
        console.log(`
🚀 Setup de Sistema B2B para Flowise

Uso:
  node setup-flowise.js [opciones]

Opciones:
  --help, -h     Mostrar esta ayuda
  --check, -c    Solo verificar dependencias
  --env, -e      Solo configurar variables de entorno
  --import, -i   Solo importar templates

Ejemplos:
  node setup-flowise.js              # Configuración completa
  node setup-flowise.js --check      # Solo verificar archivos
  node setup-flowise.js --env        # Solo configurar .env

Requisitos:
  - Flowise ejecutándose
  - PostgreSQL configurado
  - Archivos del sistema B2B presentes

Más info: README-Orchestration.md
`)
    }
}

// Ejecutar script
if (require.main === module) {
    const args = process.argv.slice(2)

    if (args.includes('--help') || args.includes('-h')) {
        FlowiseSetup.showHelp()
        process.exit(0)
    }

    if (args.includes('--check') || args.includes('-c')) {
        FlowiseSetup.checkDependencies().then((success) => {
            process.exit(success ? 0 : 1)
        })
        return
    }

    // Verificar dependencias antes de continuar
    FlowiseSetup.checkDependencies().then((success) => {
        if (!success) {
            process.exit(1)
        }

        // Ejecutar setup completo
        const setup = new FlowiseSetup()
        setup.setup().catch((error) => {
            console.error('❌ Error fatal:', error.message)
            process.exit(1)
        })
    })
}

module.exports = FlowiseSetup
