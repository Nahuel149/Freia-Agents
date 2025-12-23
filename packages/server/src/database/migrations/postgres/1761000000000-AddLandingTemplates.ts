import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddLandingTemplates1761000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS landing_templates (
                id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                slug varchar NOT NULL UNIQUE,
                name varchar NOT NULL,
                config jsonb NOT NULL DEFAULT '{}'::jsonb,
                owner_workspace_id varchar NULL,
                created_at timestamp NOT NULL DEFAULT now(),
                updated_at timestamp NOT NULL DEFAULT now()
            );
        `)

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS user_templates (
                id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id varchar NULL,
                template_id uuid NOT NULL,
                workspace_id varchar NULL,
                created_at timestamp NOT NULL DEFAULT now(),
                updated_at timestamp NOT NULL DEFAULT now(),
                CONSTRAINT fk_user_templates_template FOREIGN KEY (template_id) REFERENCES landing_templates(id) ON DELETE CASCADE
            );
        `)

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_templates_user ON user_templates (user_id);`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_templates_template ON user_templates (template_id);`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_templates_workspace ON user_templates (workspace_id);`)
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_user_templates_user ON user_templates (user_id, template_id);`)
        await queryRunner.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS uq_user_templates_workspace ON user_templates (workspace_id, template_id) WHERE workspace_id IS NOT NULL;`
        )

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
        })

        const gomeriaConfig = JSON.stringify({
            vertical: 'Automotor',
            summary: 'Agente para venta y cambio de neumáticos, stock, reservas de turnos y seguimiento de órdenes.',
            aliases: ['gomerias', 'landing3', 'neumaticos'],
            hero: {
                badge: 'Demo Freia · Gomerías',
                title: 'Asistente para venta y cambios de neumáticos',
                subtitle: 'Cotiza Pirelli, Michelin, Bridgestone y más; verifica stock, agenda turnos y coordina servicios en minutos.',
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
                    bullets: [
                        'Agenda instalación/alineación/balanceo',
                        'Propone fechas/horarios alternativos',
                        'Confirma y envía comprobante'
                    ]
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
                INSERT INTO landing_templates (slug, name, config, owner_workspace_id)
                VALUES 
                    ('hotel-gran-sol', 'Cadena de Hoteles', $1::jsonb, 'oss-mode'),
                    ('gomerias-arg', 'Gomerías Argentina', $2::jsonb, 'oss-mode'),
                    ('retail-placeholder', 'Retail (plantilla base)', $3::jsonb, 'oss-mode')
                ON CONFLICT (slug) DO UPDATE SET 
                    name = EXCLUDED.name,
                    config = EXCLUDED.config,
                    owner_workspace_id = EXCLUDED.owner_workspace_id;
            `,
            [hotelConfig, gomeriaConfig, retailConfig]
        )

        await queryRunner.query(`
            INSERT INTO user_templates (user_id, template_id, workspace_id, created_at, updated_at)
            SELECT 'oss-admin', id, 'oss-mode', now(), now()
            FROM landing_templates
            WHERE slug IN ('hotel-gran-sol', 'gomerias-arg', 'retail-placeholder')
            ON CONFLICT DO NOTHING;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS user_templates;`)
        await queryRunner.query(`DROP TABLE IF EXISTS landing_templates;`)
    }
}
