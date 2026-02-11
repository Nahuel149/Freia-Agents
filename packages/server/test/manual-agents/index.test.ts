import { __test__ as hotelTest } from '../../src/manual-agents/hotelAgent'
import { __test__ as quintasTest } from '../../src/manual-agents/quintasAgent'

describe('manual agents date helpers', () => {
    beforeAll(() => {
        jest.useFakeTimers().setSystemTime(new Date('2025-01-15T12:00:00Z'))
    })

    afterAll(() => {
        jest.useRealTimers()
    })

    test('parseShortDate rolls to next year when in the past', () => {
        const pastDate = hotelTest.parseShortDate(1, 1)
        const futureDate = hotelTest.parseShortDate(20, 1)
        expect(pastDate.format('YYYY-MM-DD')).toBe('2026-01-01')
        expect(futureDate.format('YYYY-MM-DD')).toBe('2025-01-20')
    })

    test('findAmbiguousShortDate detects ambiguous short dates', () => {
        expect(hotelTest.findAmbiguousShortDate('Vamos el 3/4')).toEqual({ raw: '3/4', first: 3, second: 4 })
        expect(quintasTest.findAmbiguousShortDate('2025-03-04')).toBeNull()
    })

    test('extractDates respects month-first preference', () => {
        const hotelMonthFirst = hotelTest.extractDates('Need 03/04/2025', { preferMonthFirst: true })
        const quintaMonthFirst = quintasTest.extractDates('Need 03/04/2025', { preferMonthFirst: true })
        const hotelDayFirst = hotelTest.extractDates('Need 03/04/2025', { preferMonthFirst: false })
        expect(hotelMonthFirst[0].format('YYYY-MM-DD')).toBe('2025-03-04')
        expect(quintaMonthFirst[0].format('YYYY-MM-DD')).toBe('2025-03-04')
        expect(hotelDayFirst[0].format('YYYY-MM-DD')).toBe('2025-04-03')
    })

    test('extractStayLengthDetails returns unit and count', () => {
        expect(hotelTest.extractStayLengthDetails('quiero 2 noches')).toEqual({ value: 2, unit: 'nights' })
        expect(quintasTest.extractStayLengthDetails('necesito 3 dias')).toEqual({ value: 3, unit: 'days' })
    })

    test('hotel reservation id and reminder extraction', () => {
        expect(hotelTest.extractReservationId('mi reserva es grs-20250110-ab12c')).toBe('GRS-20250110-AB12C')
        const reminderIso = hotelTest.extractReminderAt('recordame manana 08:30')
        expect(reminderIso).toMatch(/^\d{4}-\d{2}-\d{2}T/)
        expect(Date.parse(reminderIso)).toBeGreaterThan(Date.parse('2025-01-15T12:00:00Z'))
    })

    test('activities date resolver handles tomorrow and explicit dates', () => {
        const tomorrow = hotelTest.resolveActivitiesDate('que actividades hay manana?', 'es')
        const explicit = hotelTest.resolveActivitiesDate('what activities are available on 2025-01-20?', 'en')
        expect(tomorrow?.format('YYYY-MM-DD')).toBe('2025-01-16')
        expect(explicit?.format('YYYY-MM-DD')).toBe('2025-01-20')
    })

    test('daily activities answer includes location and plan lines', () => {
        const answer = hotelTest.buildDailyActivitiesAnswer({
            date: hotelTest.extractDates('2025-01-20')[0],
            sede: 'Palermo',
            language: 'es',
            services: [],
            defaultSedeUsed: false
        })
        expect(answer).toContain('Palermo')
        expect(answer).toContain('agenda mock')
        expect(answer).toContain('09:30')
    })

    test('hotel cancellation lock days resolve from policies', () => {
        const rules = [
            { tarifa: 'refundable', diasLimite: 3, penalidadPorc: 0 },
            { tarifa: 'refundable', diasLimite: 0, penalidadPorc: 50 },
            { tarifa: 'no_reembolsable', diasLimite: 365, penalidadPorc: 100 }
        ]
        expect(hotelTest.resolveCancellationLockDays(rules, 'refundable')).toBe(3)
        expect(hotelTest.resolveCancellationLockDays(rules, 'no_reembolsable')).toBe(365)
        expect(hotelTest.resolveCancellationLockDays(rules, 'desconocida')).toBe(0)
    })

    test('formatStaySpan uses human-friendly dates', () => {
        const hotelLabel = hotelTest.formatStaySpan('2025-01-05', '2025-01-10', 'en')
        const quintaLabel = quintasTest.formatStaySpan('2025-01-05', '2025-01-10', 'es-AR')
        expect(hotelLabel).toContain('check-in')
        expect(hotelLabel).not.toContain('2025-01-05')
        expect(quintaLabel).toContain('ingreso')
        expect(quintaLabel).not.toContain('2025-01-05')
    })

    test('stale date context detection', () => {
        expect(
            hotelTest.isDateContextStale({
                start: '2025-02-01',
                end: '2025-02-03',
                dateContextUpdatedAt: '2025-01-10'
            })
        ).toBe(false)
        expect(
            hotelTest.isDateContextStale({
                start: '2025-02-01',
                end: '2025-02-03',
                dateContextUpdatedAt: '2024-12-01'
            })
        ).toBe(true)
        expect(
            quintasTest.isDateContextStale({
                start: '2025-02-01',
                end: '2025-02-03',
                lastRangeUpdatedAt: '2024-12-01'
            })
        ).toBe(true)
    })
})

describe('manual agents availability replies', () => {
    test('hotel min nights response when below minimum', () => {
        const answer = hotelTest.buildMinNightsAnswer({ nights: 2, minNights: 3 }, 'es')
        expect(answer).toContain('minimo')
    })

    test('quintas min nights response when below minimum', () => {
        const answer = quintasTest.buildMinNightsReply({ start: '2025-01-10', minNights: 3, locale: 'es-AR' })
        expect(answer).toContain('minimo')
    })

    test('no availability messaging', () => {
        expect(hotelTest.buildNoAvailabilityAnswer('en')).toBe('No availability for those dates.')
        expect(quintasTest.formatAvailabilitySections([], [], 'es-AR')).toBe('No hay disponibilidad para esas fechas.')
    })

    test('quintas hold summary line uses formatted dates', () => {
        const line = quintasTest.buildHoldSummaryLine({
            start: '2025-01-05',
            end: '2025-01-10',
            propertyName: 'Quinta A',
            guests: 4,
            locale: 'es-AR'
        })
        expect(line).toContain('Resumen:')
        expect(line).toContain('ingreso')
        expect(line).not.toContain('2025-01-05')
    })

    test('quintas seasonal min-stay rules override property minimum', () => {
        const seasonalStart = quintasTest.extractDates('24/12/2025')[0]
        const seasonalEnd = quintasTest.extractDates('25/12/2025')[0]
        const seasonal = quintasTest.resolveMinNightsForRange({
            start: seasonalStart,
            end: seasonalEnd,
            propertyMinNights: 1,
            restrictions: {
                minStayRules: [{ start: '2025-12-23', end: '2025-12-31', minNights: 3, reason: 'Fiestas' }]
            }
        })
        expect(seasonal.minNights).toBe(3)
        expect(seasonal.minReason).toBe('Fiestas')

        const offSeasonStart = quintasTest.extractDates('10/02/2025')[0]
        const offSeasonEnd = quintasTest.extractDates('11/02/2025')[0]
        const noSeasonal = quintasTest.resolveMinNightsForRange({
            start: offSeasonStart,
            end: offSeasonEnd,
            propertyMinNights: 2,
            restrictions: {
                minStayRules: [{ start: '2025-12-23', end: '2025-12-31', minNights: 3, reason: 'Fiestas' }]
            }
        })
        expect(noSeasonal.minNights).toBe(2)
    })

    test('quintas habitual discount breakdown applies only when enabled and habitual', () => {
        const discounted = quintasTest.calculateDiscountBreakdown({
            pricePerNight: 100,
            nights: 2,
            restrictions: { discounts: { enabled: true, habitualPct: 10 } },
            isHabitual: true
        })
        expect(discounted.totalAmount).toBe(200)
        expect(discounted.discountPct).toBe(10)
        expect(discounted.discountAmount).toBe(20)
        expect(discounted.finalTotalAmount).toBe(180)
        expect(discounted.finalPricePerNight).toBe(90)

        const notHabitual = quintasTest.calculateDiscountBreakdown({
            pricePerNight: 100,
            nights: 2,
            restrictions: { discounts: { enabled: true, habitualPct: 10 } },
            isHabitual: false
        })
        expect(notHabitual.discountPct).toBe(0)
        expect(notHabitual.discountAmount).toBe(0)
        expect(notHabitual.finalTotalAmount).toBe(200)

        const customDiscount = quintasTest.calculateDiscountBreakdown({
            pricePerNight: 100,
            nights: 2,
            restrictions: { discounts: { enabled: true, habitualPct: 10 } },
            isHabitual: true,
            customDiscountPct: 15
        })
        expect(customDiscount.discountPct).toBe(15)
        expect(customDiscount.finalTotalAmount).toBe(170)
    })
})

describe('manual agents conversational signals', () => {
    test('short acknowledgements and declines support common variants', () => {
        expect(hotelTest.isShortAckOnly('ok dale')).toBe(true)
        expect(hotelTest.isShortAckOnly('sounds good')).toBe(true)
        expect(hotelTest.isShortAckOnly('okeeey')).toBe(true)
        expect(hotelTest.isShortNoOnly('no gracias')).toBe(true)
        expect(hotelTest.isShortNoOnly('nop')).toBe(true)
        expect(quintasTest.isShortAckOnly('de una')).toBe(true)
        expect(quintasTest.isShortAckOnly('okiii')).toBe(true)
        expect(quintasTest.isShortNoOnly('paso')).toBe(true)
    })

    test('polite confirmation with thanks is treated as ack, not social thanks-only', () => {
        expect(hotelTest.isPoliteAckOnly('si gracias')).toBe(true)
        expect(quintasTest.isPoliteAckOnly('ok gracias')).toBe(true)
        expect(hotelTest.isThanksOnly('si gracias')).toBe(false)
        expect(quintasTest.isThanksOnly('ok gracias')).toBe(false)
    })

    test('greeting and thanks remain social-only', () => {
        expect(hotelTest.isGreetingOnly('hola')).toBe(true)
        expect(hotelTest.isGreetingOnly('holaaaa')).toBe(true)
        expect(hotelTest.isGreetingOnly('hola quiero reservar')).toBe(false)
        expect(quintasTest.isThanksOnly('muchas gracias')).toBe(true)
        expect(quintasTest.isThanksOnly('gracias, que precio tienen?')).toBe(false)
    })

    test('small-talk and data-scope questions are detected', () => {
        expect(hotelTest.isSmallTalkOnly('como estas?')).toBe(true)
        expect(quintasTest.isSmallTalkOnly('how are you')).toBe(true)
        expect(hotelTest.isDataScopeQuestion('que datos tenes en la base?')).toBe(true)
        expect(quintasTest.isDataScopeQuestion('what data do you have?')).toBe(true)
    })

    test('unsupported realtime mock-data requests are detected', () => {
        expect(hotelTest.isUnsupportedMockDataQuestion('tenes clima en tiempo real?')).toBe(true)
        expect(quintasTest.isUnsupportedMockDataQuestion('do you have live traffic data?')).toBe(true)
    })

    test('quintas KPI intent detects market and outbound language', () => {
        expect(quintasTest.isMarketKpiIntent('Necesito KPI de ocupacion y comparativa contra competencia')).toBe(true)
        expect(quintasTest.isMarketKpiIntent('Do we need outbound this week?')).toBe(true)
        expect(quintasTest.isMarketKpiIntent('Quiero reservar para el sabado')).toBe(false)
    })

    test('quintas outbound execution intent and discount extraction', () => {
        expect(quintasTest.isOutboundExecutionIntent('activa outbound y manda promociones ahora')).toBe(true)
        expect(quintasTest.isOutboundExecutionIntent('quiero reservar para manana')).toBe(false)
        expect(quintasTest.isDiscountNegotiationIntent('me haces descuento?')).toBe(true)
        expect(quintasTest.extractNegotiatedDiscountPct('si nos dejas 12% cerramos hoy')).toBe(12)
        expect(quintasTest.extractNegotiatedDiscountPct('descuento de 8')).toBe(8)
        expect(quintasTest.extractNegotiatedDiscountPct('somos 15 personas')).toBeUndefined()
    })

    test('quintas service request intent and type detection', () => {
        expect(quintasTest.isServiceRequestIntent('necesito mas toallas y limpieza')).toBe(true)
        expect(quintasTest.detectServiceRequestType('necesito mas toallas y limpieza')).toBe('amenities')
        expect(quintasTest.isServiceRequestIntent('el aire acondicionado no funciona')).toBe(true)
        expect(quintasTest.detectServiceRequestType('el aire acondicionado no funciona')).toBe('maintenance')
        expect(quintasTest.isServiceRequestIntent('quiero reservar para el sabado')).toBe(false)
    })

    test('quintas payment-proof intent and reference extraction', () => {
        expect(quintasTest.isPaymentProofIntent('Ya hice la transferencia, te adjunto comprobante TRX-88991')).toBe(true)
        expect(quintasTest.isPaymentProofIntent('I already paid, sent receipt ref: tx-123456')).toBe(true)
        expect(quintasTest.isPaymentProofIntent('como pago por transferencia?')).toBe(false)
        expect(quintasTest.extractPaymentReference('Te mando comprobante ref: trx-88991')).toBe('TRX-88991')
    })

    test('goodbye and restart requests are detected', () => {
        expect(hotelTest.isGoodbyeOnly('chau')).toBe(true)
        expect(quintasTest.isGoodbyeOnly('bye')).toBe(true)
        expect(hotelTest.isRestartRequest('arranquemos de cero')).toBe(true)
        expect(quintasTest.isRestartRequest('start over')).toBe(true)
    })

    test('help, human handoff, and off-topic are detected', () => {
        expect(hotelTest.isHelpOnly('help')).toBe(true)
        expect(quintasTest.isHelpOnly('que podes hacer?')).toBe(true)
        expect(hotelTest.isHumanHandoffRequest('quiero hablar con un humano')).toBe(true)
        expect(quintasTest.isHumanHandoffRequest('speak to human')).toBe(true)
        expect(hotelTest.isClearlyOffTopic('quien gana la nba?')).toBe(true)
        expect(quintasTest.isClearlyOffTopic('recetame un medicamento')).toBe(true)
        expect(hotelTest.isClearlyOffTopic('tengo codigo de descuento')).toBe(false)
        expect(quintasTest.isClearlyOffTopic('tengo codigo de descuento')).toBe(false)
    })
})

describe('manual agents reservation failure replies', () => {
    test('hotel buildReservationFailureAnswer maps key reasons', () => {
        expect(
            hotelTest.buildReservationFailureAnswer({
                reason: 'missing_guests',
                language: 'en'
            })
        ).toContain('guest count')
        expect(
            hotelTest.buildReservationFailureAnswer({
                reason: 'capacity_exceeded',
                maxGuests: 4,
                language: 'es'
            })
        ).toContain('4')
        expect(
            hotelTest.buildReservationFailureAnswer({
                reason: 'cancellation_locked',
                lockDays: 3,
                language: 'en'
            })
        ).toContain('3 days')
        expect(
            hotelTest.buildReservationFailureAnswer({
                reason: 'missing_guest',
                language: 'es'
            })
        ).toContain('nombre completo')
        expect(
            hotelTest.buildReservationFailureAnswer({
                reason: 'reservation_ambiguous',
                language: 'en'
            })
        ).toContain('multiple reservations')
        expect(
            hotelTest.buildReservationFailureAnswer({
                reason: 'missing_reservation_lookup',
                language: 'es'
            })
        ).toContain('ID de reserva o email')
    })

    test('quintas buildHoldFailureAnswer maps key reasons', () => {
        expect(
            quintasTest.buildHoldFailureAnswer({
                reason: 'invalid_date',
                locale: 'es-AR'
            })
        ).toContain('YYYY-MM-DD')
        expect(
            quintasTest.buildHoldFailureAnswer({
                reason: 'property_not_found',
                locale: 'en-US'
            })
        ).toContain("couldn't find")
        expect(
            quintasTest.buildHoldFailureAnswer({
                reason: 'date_blocked',
                locale: 'es-AR'
            })
        ).toContain('bloqueadas')
    })
})
