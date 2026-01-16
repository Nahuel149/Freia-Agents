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
})
