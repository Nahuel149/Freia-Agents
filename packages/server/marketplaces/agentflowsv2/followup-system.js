// Sistema de seguimiento automático para B2B Sales
const B2BSalesDB = require('./database-config');
const AddressManager = require('./address-manager');

class FollowUpSystem {
    constructor(dbConnectionString) {
        this.db = new B2BSalesDB(dbConnectionString);
        this.addressManager = new AddressManager(dbConnectionString);
        this.isRunning = false;
        this.intervalId = null;
    }

    // Inicializar el sistema de seguimiento
    async initialize() {
        try {
            // Crear tabla de seguimientos si no existe (ya está en el schema)
            console.log('Follow-up system initialized');
        } catch (error) {
            console.error('Error initializing follow-up system:', error);
        }
    }

    // Programar seguimiento para cliente que no cerró
    async scheduleFollowUp(customerData, flowState) {
        try {
            const {
                phoneNumber, firstName, lastName, productInterest, 
                lastInteraction, negotiationAttempts = 0
            } = customerData;

            // Buscar o crear cliente
            let customer = await this.db.findCustomerByPhone(phoneNumber);
            if (!customer) {
                customer = await this.db.upsertCustomer({
                    phoneNumber,
                    firstName,
                    lastName
                });
            }

            // Calcular cuándo hacer el seguimiento
            const delayHours = parseInt(flowState.followUpDelayHours || '24');
            const scheduledAt = new Date();
            scheduledAt.setHours(scheduledAt.getHours() + delayHours);

            // Ajustar a horario comercial si es necesario
            const adjustedTime = this.adjustToBusinessHours(scheduledAt, flowState);

            const followUpData = {
                customerId: customer.id,
                phoneNumber,
                saleId: null, // No hay venta aún
                followUpType: 'negotiation_followup',
                scheduledAt: adjustedTime,
                attemptNumber: negotiationAttempts + 1,
                maxAttempts: parseInt(flowState.followUpMaxAttempts || '3'),
                messageSent: this.generateFollowUpMessage({
                    firstName: firstName || 'Cliente',
                    productInterest,
                    attemptNumber: negotiationAttempts + 1
                }),
                nextAction: 'send_followup_message'
            };

            const followUp = await this.db.scheduleFollowUp(followUpData);
            console.log(`Follow-up scheduled for ${phoneNumber} at ${adjustedTime}`);
            
            return followUp;
        } catch (error) {
            console.error('Error scheduling follow-up:', error);
            return null;
        }
    }

    // Ajustar hora al horario comercial
    adjustToBusinessHours(dateTime, flowState) {
        const businessStart = flowState.businessHoursStart || '09:00';
        const businessEnd = flowState.businessHoursEnd || '18:00';
        const workDays = (flowState.followUpDaysOfWeek || '1,2,3,4,5').split(',').map(d => parseInt(d));

        const [startHour, startMin] = businessStart.split(':').map(n => parseInt(n));
        const [endHour, endMin] = businessEnd.split(':').map(n => parseInt(n));

        let adjustedDate = new Date(dateTime);

        // Si es fin de semana o día no laboral, mover al próximo día laboral
        while (!workDays.includes(adjustedDate.getDay())) {
            adjustedDate.setDate(adjustedDate.getDate() + 1);
        }

        // Si es antes del horario comercial, ajustar al inicio
        if (adjustedDate.getHours() < startHour || 
            (adjustedDate.getHours() === startHour && adjustedDate.getMinutes() < startMin)) {
            adjustedDate.setHours(startHour, startMin, 0, 0);
        }
        // Si es después del horario comercial, mover al próximo día laboral
        else if (adjustedDate.getHours() > endHour || 
                (adjustedDate.getHours() === endHour && adjustedDate.getMinutes() > endMin)) {
            adjustedDate.setDate(adjustedDate.getDate() + 1);
            // Verificar que el próximo día sea laboral
            while (!workDays.includes(adjustedDate.getDay())) {
                adjustedDate.setDate(adjustedDate.getDate() + 1);
            }
            adjustedDate.setHours(startHour, startMin, 0, 0);
        }

        return adjustedDate;
    }

    // Generar mensaje de seguimiento personalizado
    generateFollowUpMessage(data) {
        const { firstName, productInterest, attemptNumber } = data;
        
        const messages = {
            1: [
                `¡Hola ${firstName}! Te escribo porque ayer estuvimos charlando sobre ${productInterest}. ¿Pudiste pensarlo? Tengo buenas noticias sobre stock y precios 😊`,
                `¡Buenas ${firstName}! ¿Cómo andás? Ayer quedamos en que ibas a consultar sobre ${productInterest}. ¿Te puedo ayudar con algo más?`,
                `¡Hola ${firstName}! Espero que estés bien. Te quería comentar que revisé el tema de ${productInterest} y tengo algunas opciones que te pueden interesar.`
            ],
            2: [
                `¡Hola ${firstName}! ¿Cómo va todo? Te escribo porque sé que estás buscando ${productInterest}. ¿Hay algo específico que te preocupa o querés que te aclare?`,
                `¡Buenas ${firstName}! No quiero ser pesado, pero tengo una promo especial en ${productInterest} que creo que te puede convenir. ¿Te interesa que te cuente?`,
                `¡Hola ${firstName}! ¿Pudiste avanzar con el tema de ${productInterest}? Si tenés alguna duda o querés negociar el precio, charlamos sin problema.`
            ],
            3: [
                `¡Hola ${firstName}! Esta es mi última consulta sobre ${productInterest}. Si no te interesa ahora, no hay drama. Pero si querés, te dejo mi mejor precio y lo charlamos.`,
                `¡Buenas ${firstName}! Te hago la última oferta por ${productInterest}. Si no te cierra, entiendo perfectamente. ¿Qué te parece?`,
                `¡Hola ${firstName}! No te voy a molestar más después de esto, pero tengo una última propuesta para ${productInterest} que creo que no vas a poder rechazar 😄`
            ]
        };

        const attemptMessages = messages[Math.min(attemptNumber, 3)] || messages[3];
        return attemptMessages[Math.floor(Math.random() * attemptMessages.length)];
    }

    // Procesar seguimientos pendientes
    async processPendingFollowUps() {
        try {
            const pendingFollowUps = await this.db.getPendingFollowUps(20);
            
            for (const followUp of pendingFollowUps) {
                await this.executeFollowUp(followUp);
                // Pequeña pausa entre mensajes para no saturar
                await this.sleep(2000);
            }

            return pendingFollowUps.length;
        } catch (error) {
            console.error('Error processing pending follow-ups:', error);
            return 0;
        }
    }

    // Ejecutar un seguimiento específico
    async executeFollowUp(followUp) {
        try {
            console.log(`Executing follow-up for ${followUp.phone_number}`);
            
            // Aquí se integraría con Wasender o el sistema de mensajería
            const messageData = {
                phoneNumber: followUp.phone_number,
                message: followUp.message_sent,
                followUpId: followUp.id
            };

            // Simular envío de mensaje (en producción sería llamada a Wasender)
            const messageSent = await this.sendWhatsAppMessage(messageData);
            
            if (messageSent) {
                // Marcar como completado y programar próximo seguimiento si es necesario
                await this.db.completeFollowUp(
                    followUp.id, 
                    'Message sent successfully', 
                    'wait_for_response'
                );

                // Si no es el último intento, programar el siguiente
                if (followUp.attempt_number < followUp.max_attempts) {
                    const nextAttempt = new Date();
                    const intervalHours = 48; // 2 días entre intentos
                    nextAttempt.setHours(nextAttempt.getHours() + intervalHours);

                    await this.db.scheduleFollowUp({
                        customerId: followUp.customer_id,
                        phoneNumber: followUp.phone_number,
                        saleId: followUp.sale_id,
                        followUpType: followUp.follow_up_type,
                        scheduledAt: nextAttempt,
                        attemptNumber: followUp.attempt_number + 1,
                        maxAttempts: followUp.max_attempts,
                        messageSent: this.generateFollowUpMessage({
                            firstName: followUp.first_name || 'Cliente',
                            productInterest: 'los productos que consultaste',
                            attemptNumber: followUp.attempt_number + 1
                        }),
                        nextAction: 'send_followup_message'
                    });
                }
            }
        } catch (error) {
            console.error(`Error executing follow-up for ${followUp.phone_number}:`, error);
        }
    }

    // Simular envío de WhatsApp (integrar con Wasender)
    async sendWhatsAppMessage(messageData) {
        try {
            // En producción, aquí iría la integración con Wasender
            console.log(`📱 Sending WhatsApp to ${messageData.phoneNumber}: ${messageData.message}`);
            
            // Simular éxito (en producción verificar respuesta de Wasender)
            return true;
        } catch (error) {
            console.error('Error sending WhatsApp message:', error);
            return false;
        }
    }

    // Iniciar el procesamiento automático
    startAutomaticProcessing(intervalMinutes = 15) {
        if (this.isRunning) {
            console.log('Follow-up system is already running');
            return;
        }

        this.isRunning = true;
        console.log(`Starting automatic follow-up processing every ${intervalMinutes} minutes`);
        
        this.intervalId = setInterval(async () => {
            const processed = await this.processPendingFollowUps();
            if (processed > 0) {
                console.log(`Processed ${processed} follow-ups`);
            }
        }, intervalMinutes * 60 * 1000);
    }

    // Detener el procesamiento automático
    stopAutomaticProcessing() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('Follow-up system stopped');
    }

    // Obtener estadísticas de seguimientos
    async getFollowUpStats() {
        try {
            const query = `
                SELECT 
                    follow_up_type,
                    status,
                    COUNT(*) as count,
                    AVG(attempt_number) as avg_attempts
                FROM follow_ups 
                WHERE created_at >= NOW() - INTERVAL '30 days'
                GROUP BY follow_up_type, status
                ORDER BY follow_up_type, status;
            `;
            
            const result = await this.db.pool.query(query);
            return result.rows;
        } catch (error) {
            console.error('Error getting follow-up stats:', error);
            return [];
        }
    }

    // Función auxiliar para pausas
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = FollowUpSystem;

// Ejemplo de uso:
// const followUpSystem = new FollowUpSystem();
// await followUpSystem.initialize();
// followUpSystem.startAutomaticProcessing(15); // Cada 15 minutos