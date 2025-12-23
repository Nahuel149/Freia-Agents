// Sistema de programación de follow-ups con horarios configurables
const B2BSalesDB = require('./database-config')
const FollowUpSystem = require('./followup-system')

class ScheduledFollowUps {
    constructor(dbConnectionString) {
        this.db = new B2BSalesDB(dbConnectionString)
        this.followUpSystem = new FollowUpSystem(dbConnectionString)
        this.schedulerRunning = false
        this.schedulerInterval = null
    }

    // Inicializar el sistema de programación
    async initialize() {
        try {
            await this.db.initialize()
            await this.followUpSystem.initialize()
            console.log('Scheduled follow-ups system initialized')
        } catch (error) {
            console.error('Error initializing scheduled follow-ups:', error)
        }
    }

    // Programar follow-up personalizado
    async scheduleCustomFollowUp(config) {
        try {
            const {
                customerId,
                phoneNumber,
                saleId = null,
                followUpType,
                message,
                scheduledDateTime,
                maxAttempts = 1,
                intervalHours = 24,
                businessHoursOnly = true,
                workDaysOnly = true,
                priority = 'medium',
                tags = [],
                metadata = {}
            } = config

            // Validar que el cliente existe
            const customer = await this.db.findCustomerById(customerId)
            if (!customer) {
                throw new Error(`Customer with ID ${customerId} not found`)
            }

            // Ajustar fecha/hora si es necesario
            let adjustedDateTime = new Date(scheduledDateTime)
            if (businessHoursOnly || workDaysOnly) {
                const flowState = {
                    businessHoursStart: '09:00',
                    businessHoursEnd: '18:00',
                    followUpDaysOfWeek: workDaysOnly ? '1,2,3,4,5' : '0,1,2,3,4,5,6'
                }
                adjustedDateTime = this.followUpSystem.adjustToBusinessHours(adjustedDateTime, flowState)
            }

            const followUpData = {
                customerId,
                phoneNumber: phoneNumber || customer.phone_number,
                saleId,
                followUpType,
                scheduledAt: adjustedDateTime,
                attemptNumber: 1,
                maxAttempts,
                messageSent: message,
                nextAction: 'send_followup_message',
                priority,
                tags: tags.join(','),
                metadata: JSON.stringify(metadata),
                intervalHours
            }

            const followUp = await this.db.scheduleFollowUp(followUpData)

            console.log(`📅 Custom follow-up scheduled: ID ${followUp.id} for ${adjustedDateTime}`)
            return followUp
        } catch (error) {
            console.error('Error scheduling custom follow-up:', error)
            throw error
        }
    }

    // Programar follow-ups en lote
    async scheduleBulkFollowUps(followUps) {
        const results = {
            successful: [],
            failed: []
        }

        for (const config of followUps) {
            try {
                const followUp = await this.scheduleCustomFollowUp(config)
                results.successful.push({
                    config,
                    followUp
                })
            } catch (error) {
                results.failed.push({
                    config,
                    error: error.message
                })
            }
        }

        console.log(`✅ Bulk scheduling completed: ${results.successful.length} successful, ${results.failed.length} failed`)
        return results
    }

    // Programar follow-ups recurrentes
    async scheduleRecurringFollowUp(config) {
        try {
            const {
                customerId,
                phoneNumber,
                followUpType,
                messageTemplate,
                startDate,
                endDate = null,
                recurrencePattern, // 'daily', 'weekly', 'monthly'
                recurrenceInterval = 1, // cada X días/semanas/meses
                maxOccurrences = null,
                businessHoursOnly = true,
                workDaysOnly = true,
                priority = 'medium'
            } = config

            const followUps = []
            let currentDate = new Date(startDate)
            let occurrenceCount = 0
            const endDateValue = endDate ? new Date(endDate) : null

            while (!maxOccurrences || occurrenceCount < maxOccurrences) {
                // Verificar condiciones de parada
                if (endDateValue && currentDate > endDateValue) break

                // Programar follow-up para esta fecha
                const followUpConfig = {
                    customerId,
                    phoneNumber,
                    followUpType: `${followUpType}_recurring`,
                    message: this.processMessageTemplate(messageTemplate, {
                        occurrenceNumber: occurrenceCount + 1,
                        date: currentDate
                    }),
                    scheduledDateTime: currentDate,
                    maxAttempts: 1,
                    businessHoursOnly,
                    workDaysOnly,
                    priority,
                    tags: ['recurring', followUpType],
                    metadata: {
                        recurrencePattern,
                        recurrenceInterval,
                        occurrenceNumber: occurrenceCount + 1,
                        originalStartDate: startDate
                    }
                }

                const followUp = await this.scheduleCustomFollowUp(followUpConfig)
                followUps.push(followUp)

                // Calcular próxima fecha
                currentDate = this.calculateNextRecurrence(currentDate, recurrencePattern, recurrenceInterval)
                occurrenceCount++
            }

            console.log(`🔄 Scheduled ${followUps.length} recurring follow-ups`)
            return followUps
        } catch (error) {
            console.error('Error scheduling recurring follow-up:', error)
            throw error
        }
    }

    // Procesar plantilla de mensaje
    processMessageTemplate(template, variables) {
        let message = template

        // Reemplazar variables
        Object.keys(variables).forEach((key) => {
            const placeholder = `{{${key}}}`
            message = message.replace(new RegExp(placeholder, 'g'), variables[key])
        })

        // Reemplazar fechas
        message = message.replace(/{{date}}/g, variables.date.toLocaleDateString('es-AR'))
        message = message.replace(/{{time}}/g, variables.date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }))

        return message
    }

    // Calcular próxima recurrencia
    calculateNextRecurrence(currentDate, pattern, interval) {
        const nextDate = new Date(currentDate)

        switch (pattern) {
            case 'daily':
                nextDate.setDate(nextDate.getDate() + interval)
                break
            case 'weekly':
                nextDate.setDate(nextDate.getDate() + interval * 7)
                break
            case 'monthly':
                nextDate.setMonth(nextDate.getMonth() + interval)
                break
            default:
                throw new Error(`Unknown recurrence pattern: ${pattern}`)
        }

        return nextDate
    }

    // Obtener follow-ups programados
    async getScheduledFollowUps(filters = {}) {
        try {
            const {
                customerId = null,
                followUpType = null,
                status = null,
                dateFrom = null,
                dateTo = null,
                priority = null,
                tags = null,
                limit = 50,
                offset = 0
            } = filters

            let query = `
                SELECT f.*, c.first_name, c.last_name, c.business_name
                FROM follow_ups f
                JOIN customers c ON f.customer_id = c.id
                WHERE 1=1
            `

            const params = []
            let paramCount = 0

            if (customerId) {
                query += ` AND f.customer_id = $${++paramCount}`
                params.push(customerId)
            }

            if (followUpType) {
                query += ` AND f.follow_up_type = $${++paramCount}`
                params.push(followUpType)
            }

            if (status) {
                query += ` AND f.status = $${++paramCount}`
                params.push(status)
            }

            if (dateFrom) {
                query += ` AND f.scheduled_at >= $${++paramCount}`
                params.push(dateFrom)
            }

            if (dateTo) {
                query += ` AND f.scheduled_at <= $${++paramCount}`
                params.push(dateTo)
            }

            if (priority) {
                query += ` AND f.priority = $${++paramCount}`
                params.push(priority)
            }

            if (tags) {
                query += ` AND f.tags LIKE $${++paramCount}`
                params.push(`%${tags}%`)
            }

            query += `
                ORDER BY f.scheduled_at ASC
                LIMIT $${++paramCount} OFFSET $${++paramCount}
            `

            params.push(limit, offset)

            const result = await this.db.pool.query(query, params)
            return result.rows
        } catch (error) {
            console.error('Error getting scheduled follow-ups:', error)
            return []
        }
    }

    // Cancelar follow-up programado
    async cancelFollowUp(followUpId, reason = '') {
        try {
            const query = `
                UPDATE follow_ups 
                SET status = 'cancelled',
                    completed_at = NOW(),
                    result = $2,
                    updated_at = NOW()
                WHERE id = $1 AND status = 'pending'
                RETURNING *;
            `

            const result = await this.db.pool.query(query, [followUpId, `Cancelled: ${reason}`])

            if (result.rows.length > 0) {
                console.log(`❌ Follow-up ${followUpId} cancelled: ${reason}`)
                return result.rows[0]
            }

            return null
        } catch (error) {
            console.error('Error cancelling follow-up:', error)
            return null
        }
    }

    // Reprogramar follow-up
    async rescheduleFollowUp(followUpId, newDateTime, reason = '') {
        try {
            const query = `
                UPDATE follow_ups 
                SET scheduled_at = $2,
                    updated_at = NOW(),
                    result = CONCAT(COALESCE(result, ''), '\nRescheduled: ', $3)
                WHERE id = $1 AND status = 'pending'
                RETURNING *;
            `

            const result = await this.db.pool.query(query, [followUpId, newDateTime, reason])

            if (result.rows.length > 0) {
                console.log(`📅 Follow-up ${followUpId} rescheduled to ${newDateTime}`)
                return result.rows[0]
            }

            return null
        } catch (error) {
            console.error('Error rescheduling follow-up:', error)
            return null
        }
    }

    // Iniciar procesador automático
    startScheduler(intervalMinutes = 5) {
        if (this.schedulerRunning) {
            console.log('Scheduler is already running')
            return
        }

        this.schedulerRunning = true
        console.log(`🚀 Starting follow-up scheduler (checking every ${intervalMinutes} minutes)`)

        this.schedulerInterval = setInterval(async () => {
            try {
                const processed = await this.followUpSystem.processPendingFollowUps()
                if (processed > 0) {
                    console.log(`⚡ Processed ${processed} scheduled follow-ups`)
                }
            } catch (error) {
                console.error('Error in scheduler:', error)
            }
        }, intervalMinutes * 60 * 1000)
    }

    // Detener procesador automático
    stopScheduler() {
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval)
            this.schedulerInterval = null
        }
        this.schedulerRunning = false
        console.log('📴 Follow-up scheduler stopped')
    }

    // Obtener estadísticas del programador
    async getSchedulerStats() {
        try {
            const query = `
                SELECT 
                    status,
                    follow_up_type,
                    priority,
                    COUNT(*) as count,
                    MIN(scheduled_at) as earliest_scheduled,
                    MAX(scheduled_at) as latest_scheduled
                FROM follow_ups 
                WHERE scheduled_at >= NOW() - INTERVAL '7 days'
                GROUP BY status, follow_up_type, priority
                ORDER BY status, follow_up_type, priority;
            `

            const result = await this.db.pool.query(query)
            return {
                stats: result.rows,
                schedulerRunning: this.schedulerRunning,
                lastCheck: new Date()
            }
        } catch (error) {
            console.error('Error getting scheduler stats:', error)
            return null
        }
    }
}

module.exports = ScheduledFollowUps

// Ejemplo de uso:
// const scheduler = new ScheduledFollowUps(process.env.DB_CONNECTION_STRING);
// await scheduler.initialize();
// scheduler.startScheduler(5); // Revisar cada 5 minutos
