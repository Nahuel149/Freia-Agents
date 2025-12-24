import { ManualAgentDefinition } from './types'
import { handleHotelChat, HOTEL_ALLOWED_COLLECTIONS, HOTEL_ALLOWED_OPS, HOTEL_TOOL_SPECS } from './hotelAgent'
import { handleQuintasChat, QUINTAS_ALLOWED_COLLECTIONS, QUINTAS_ALLOWED_OPS, QUINTAS_TOOL_SPECS } from './quintasAgent'
import { getManualAgentModel } from './config'

export const manualAgents: ManualAgentDefinition[] = [
    {
        id: 'quintas',
        name: 'Quintas El Rincon de Mi Mundo',
        description: 'Atencion automatizada para consultas de alquiler, disponibilidad y reglas.',
        status: 'active',
        version: 'v1',
        llmModel: getManualAgentModel(),
        tools: QUINTAS_TOOL_SPECS,
        allowedCollections: QUINTAS_ALLOWED_COLLECTIONS,
        allowedOps: QUINTAS_ALLOWED_OPS,
        handler: handleQuintasChat
    },
    {
        id: 'gran-sol',
        name: 'Hotel Gran Sol',
        description: 'Gestion automatizada de reservas, cambios y atencion al huesped.',
        status: 'active',
        version: 'v1',
        llmModel: getManualAgentModel(),
        tools: HOTEL_TOOL_SPECS,
        allowedCollections: HOTEL_ALLOWED_COLLECTIONS,
        allowedOps: HOTEL_ALLOWED_OPS,
        handler: handleHotelChat
    }
]

export const getManualAgentById = (agentId: string) => {
    return manualAgents.find((agent) => agent.id === agentId)
}
