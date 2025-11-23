import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddLandingTemplates1761000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`landing_templates\` (
                \`id\` varchar(36) NOT NULL,
                \`slug\` varchar(255) NOT NULL,
                \`name\` varchar(255) NOT NULL,
                \`config\` json NOT NULL,
                \`owner_workspace_id\` varchar(255) DEFAULT NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                UNIQUE KEY \`UQ_landing_templates_slug\` (\`slug\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;
        `)

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`user_templates\` (
                \`id\` varchar(36) NOT NULL,
                \`user_id\` varchar(255) DEFAULT NULL,
                \`template_id\` varchar(36) NOT NULL,
                \`workspace_id\` varchar(255) DEFAULT NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`),
                KEY \`IDX_user_templates_user\` (\`user_id\`),
                KEY \`IDX_user_templates_template\` (\`template_id\`),
                KEY \`IDX_user_templates_workspace\` (\`workspace_id\`),
                UNIQUE KEY \`UQ_user_templates_user\` (\`user_id\`, \`template_id\`),
                UNIQUE KEY \`UQ_user_templates_workspace\` (\`workspace_id\`, \`template_id\`),
                CONSTRAINT \`FK_user_templates_template\` FOREIGN KEY (\`template_id\`) REFERENCES \`landing_templates\`(\`id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;
        `)

        const hotelConfig = JSON.stringify({
            vertical: 'Hoteles',
            summary: 'Agente conversacional para reservas, cambios, cancelaciones y atención al huésped.',
            aliases: ['hoteles', 'landing1'],
            hero: {
                badge: 'Demo Freia · Hoteles',
                title: 'Asistente 24/7 para tu cadena hotelera',
                subtitle:
                    'Reserva, cambios, cancelaciones y atención pre/durante la estadía con reglas de negocio, disponibilidad en vivo y confirmaciones seguras.',
                chatLabel: 'Probar demo',
                chatLink: 'https://example.com/chat-hoteles',
                secondaryLabel: 'Ver API',
                secondaryLink: '/api-docs',
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
            howItWorks: ['Input del huésped', 'Consulta Inventario/Disponibilidad/Reglas', 'LLM aplica reglas y calcula tarifa', 'Confirmación con HITL opcional y envío'],
            value: ['Multilingüe y 24/7', 'Integrable con PMS/CRMs', 'Memoria en Mongo, vectores en Pinecone', 'Modo demo con link externo al chat']
        })

        const gomeriaConfig = JSON.stringify({
            vertical: 'Automotor',
            summary: 'Agente para venta y cambio de neumáticos, stock, reservas de turnos y seguimiento de órdenes.',
            aliases: ['gomerias', 'landing3', 'neumaticos'],
            hero: {
                badge: 'Demo Freia · Gomerías',
                title: 'Asistente para venta y cambios de neumáticos',
                subtitle:
                    'Cotiza Pirelli, Michelin, Bridgestone y más; verifica stock, agenda turnos y coordina servicios en minutos.',
                chatLabel: 'Probar demo',
                chatLink: 'https://example.com/chat-gomerias',
                secondaryLabel: 'Ver API',
                secondaryLink: '/api-docs',
                image: '/assets/Demo.png'
            },
            kpis: [
                { label: 'Autoservicio en consultas', value: '65%' },
                { label: 'Upsell en servicios', value: '+20%' },
                { label: 'Errores de stock', value: '-90%' }
            ],
            features: [
                {
                    icon: '🛞',
                    title: 'Catálogo y stock',
                    desc: 'Disponibilidad por medida, marca y modelo. Alternativas cuando no hay stock.'
                },
                {
                    icon: '📅',
                    title: 'Turnos y reservas',
                    desc: 'Agenda instalación, alineación/balanceo y rotación; confirma fecha/hora.'
                },
                {
                    icon: '💳',
                    title: 'Cotización y pagos',
                    desc: 'Calcula total con promos; valida métodos de pago simulados.'
                }
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
                { title: 'Postventa', bullets: ['Seguimiento de orden', 'Reclamos o cambios de fecha', 'Recordatorios de rotación'] }
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
        })

        const retailConfig = JSON.stringify({
            vertical: 'Retail',
            summary: 'Plantilla base para catálogos, stock y órdenes.',
            aliases: ['retail', 'landing2'],
            hero: {
                badge: 'Demo Freia · Retail',
                title: 'Asistente de ventas omnicanal',
                subtitle: 'Consulta catálogo, stock y órdenes con recomendaciones.',
                chatLabel: 'Probar demo',
                chatLink: 'https://example.com/chat-retail',
                secondaryLabel: 'Ver API',
                secondaryLink: '/api-docs',
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
        })

        await queryRunner.query(
            `
                INSERT INTO \`landing_templates\` (id, slug, name, config, owner_workspace_id, created_at, updated_at)
                VALUES 
                    (UUID(), 'hotel-gran-sol', 'Cadena de Hoteles', ?, 'oss-mode', NOW(6), NOW(6)),
                    (UUID(), 'gomerias-arg', 'Gomerías Argentina', ?, 'oss-mode', NOW(6), NOW(6)),
                    (UUID(), 'retail-placeholder', 'Retail (plantilla base)', ?, 'oss-mode', NOW(6), NOW(6))
                ON DUPLICATE KEY UPDATE 
                    name = VALUES(name),
                    config = VALUES(config),
                    owner_workspace_id = VALUES(owner_workspace_id),
                    updated_at = NOW(6);
            `,
            [hotelConfig, gomeriaConfig, retailConfig]
        )

        await queryRunner.query(`
            INSERT IGNORE INTO \`user_templates\` (id, user_id, template_id, workspace_id, created_at, updated_at)
            SELECT UUID(), 'oss-admin', lt.id, 'oss-mode', NOW(6), NOW(6)
            FROM landing_templates lt
            WHERE lt.slug IN ('hotel-gran-sol', 'gomerias-arg', 'retail-placeholder');
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS `user_templates`;')
        await queryRunner.query('DROP TABLE IF EXISTS `landing_templates`;')
    }
}
