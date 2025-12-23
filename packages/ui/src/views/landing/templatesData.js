export const envOrDefault = (key, fallback) => {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
        return import.meta.env[key]
    }
    return fallback
}

const templates = [
    {
        id: 'hotel-gran-sol',
        aliases: ['hoteles', 'landing1'],
        name: 'Cadena de Hoteles',
        vertical: 'Hoteles',
        summary: 'Agente conversacional para reservas, cambios, cancelaciones y atención al huésped.',
        hero: {
            badge: 'Demo Freia · Hoteles',
            title: 'Asistente 24/7 para tu cadena hotelera',
            subtitle:
                'Reserva, cambios, cancelaciones y atención pre/durante la estadía con reglas de negocio, disponibilidad en vivo y confirmaciones seguras.',
            chatLabel: 'Probar demo',
            chatLink: envOrDefault('VITE_DEMO_HOTEL_CHAT_URL', 'https://example.com/chat-hoteles'),
            secondaryLabel: 'Ver API',
            secondaryLink: envOrDefault('VITE_DEMO_HOTEL_API_URL', '/api-docs'),
            image: '/assets/Demo.png'
        },
        kpis: [
            { label: 'Carga de recepción', value: '-70%' },
            { label: 'Conversión en reservas', value: '+30%' },
            { label: 'Errores en políticas', value: '0' }
        ],
        features: [
            {
                icon: '🏨',
                title: 'Reservas inteligentes',
                desc: 'Disponibilidad en vivo, mínima estadía en feriados, alternativas y confirmación.'
            },
            {
                icon: '🧾',
                title: 'Cambios y cancelaciones',
                desc: 'Recalcula tarifas, respeta reembolsables/no reembolsables y penalidades automáticas.'
            },
            {
                icon: '🧳',
                title: 'Atención al huésped',
                desc: 'Early/late check-in, traslados, room service, incidentes y upsell de servicios.'
            }
        ],
        flows: [
            {
                title: 'Reservas',
                bullets: ['Valida disponibilidad y mínima estadía', 'Sugiere fechas/alternativas', 'Genera confirmación con política']
            },
            {
                title: 'Cambios/Cancelaciones',
                bullets: ['Bloquea no reembolsables en ventana corta', 'Penalidad automática', 'Nuevo total transparente']
            },
            {
                title: 'Atención',
                bullets: ['Early/late check-in', 'Traslados, amenities, spa', 'Incidentes y room service']
            },
            {
                title: 'Backoffice',
                bullets: ['Leads y seguimientos', 'Notificaciones a staff', 'Reportes rápidos de ocupación/upsell']
            }
        ],
        howItWorks: [
            'Input del huésped',
            'Consulta Inventario/Disponibilidad/Reglas',
            'LLM aplica reglas y calcula tarifa',
            'Confirmación con HITL opcional y envío'
        ],
        value: [
            'Multilingüe y 24/7',
            'Integrable con PMS/CRMs',
            'Memoria en Mongo, vectores en Pinecone',
            'Modo demo con link externo al chat'
        ]
    },
    {
        id: 'gomerias-arg',
        aliases: ['gomerias', 'landing3', 'neumaticos'],
        name: 'Gomerías Argentina',
        vertical: 'Automotor',
        summary: 'Agente para venta y cambio de neumáticos, stock, reservas de turnos y seguimiento de órdenes.',
        hero: {
            badge: 'Demo Freia · Gomerías',
            title: 'Asistente para venta y cambios de neumáticos',
            subtitle: 'Cotiza Pirelli, Michelin, Bridgestone y más; verifica stock, agenda turnos y coordina servicios en minutos.',
            chatLabel: 'Probar demo',
            chatLink: envOrDefault('VITE_DEMO_GOMERIA_CHAT_URL', 'https://example.com/chat-gomerias'),
            secondaryLabel: 'Ver API',
            secondaryLink: envOrDefault('VITE_DEMO_GOMERIA_API_URL', '/api-docs'),
            image: '/assets/Demo.png'
        },
        kpis: [
            { label: 'Autoservicio en consultas', value: '65%' },
            { label: 'Upsell en servicios', value: '+20%' },
            { label: 'Errores de stock', value: '-90%' }
        ],
        features: [
            { icon: '🛞', title: 'Catálogo y stock', desc: 'Disponibilidad por medida, marca y modelo. Alternativas cuando no hay stock.' },
            { icon: '📅', title: 'Turnos y reservas', desc: 'Agenda instalación, alineación/balanceo y rotación; confirma fecha/hora.' },
            { icon: '💳', title: 'Cotización y pagos', desc: 'Calcula total con promos; valida métodos de pago simulados.' }
        ],
        flows: [
            {
                title: 'Cotización',
                bullets: [
                    'Busca neumáticos por medida/vehículo',
                    'Verifica stock y sugiere marcas (Pirelli, Michelin, Bridgestone)',
                    'Calcula total con promos'
                ]
            },
            {
                title: 'Turnos',
                bullets: ['Agenda instalación/alineación/balanceo', 'Propone fechas/horarios alternativos', 'Confirma y envía comprobante']
            },
            {
                title: 'Postventa',
                bullets: ['Seguimiento de orden', 'Reclamos o cambios de fecha', 'Recordatorios de rotación']
            }
        ],
        howItWorks: [
            'Input del cliente',
            'Consulta catálogo/stock (medida, marca, modelo)',
            'LLM sugiere alternativas y calcula total',
            'Agenda turno y confirma'
        ],
        value: [
            'Integrable con inventarios locales/ERP',
            'Multimarcas (Pirelli, Michelin, Bridgestone)',
            'Turnos y servicios en un chat',
            'Demo con chat externo listo'
        ]
    },
    {
        id: 'retail-placeholder',
        aliases: ['retail', 'landing2'],
        name: 'Retail (plantilla base)',
        vertical: 'Retail',
        summary: 'Plantilla base para catálogos, stock y órdenes.',
        hero: {
            badge: 'Demo Freia · Retail',
            title: 'Asistente de ventas omnicanal',
            subtitle: 'Consulta catálogo, stock y órdenes con recomendaciones.',
            chatLabel: 'Probar demo',
            chatLink: envOrDefault('VITE_DEMO_RETAIL_CHAT_URL', 'https://example.com/chat-retail'),
            secondaryLabel: 'Ver API',
            secondaryLink: envOrDefault('VITE_DEMO_RETAIL_API_URL', '/api-docs'),
            image: '/assets/Demo.png'
        },
        kpis: [
            { label: 'Autoservicio', value: '60%' },
            { label: 'Ticket medio', value: '+15%' },
            { label: 'Resoluciones 1er contacto', value: '90%' }
        ],
        features: [
            { icon: '🛒', title: 'Catálogo y stock', desc: 'Busca productos, variantes y disponibilidad.' },
            { icon: '💳', title: 'Órdenes y pagos', desc: 'Simula pagos y cambios en pedidos.' },
            { icon: '🚚', title: 'Despacho y devoluciones', desc: 'Estados de envío y devoluciones guiadas.' }
        ],
        flows: [
            { title: 'Descubrimiento', bullets: ['Filtro por categoría', 'Comparaciones rápidas', 'Alternativas si no hay stock'] },
            { title: 'Órdenes', bullets: ['Crear/editar pedido', 'Recalcular total', 'Confirmar con HITL'] },
            { title: 'Postventa', bullets: ['Seguimiento', 'Devoluciones guiadas', 'Recomendaciones cruzadas'] }
        ],
        howItWorks: ['Input del cliente', 'Consulta catálogo/stock', 'LLM guía la compra', 'Confirmación/seguimiento'],
        value: ['Plantilla lista para retail', 'Integrable vía API', 'Reutilizable para otros verticales']
    }
]

export default templates
