import moment from 'moment-timezone'
import { getManualAgentsCollections, getManualAgentsDb } from './mongo'

type CreateHoldInput = {
    propertyId: string
    start: string
    end: string
    leadId?: string
    holdHours?: number
    notes?: string
}

type ConfirmPaymentInput = {
    propertyId: string
    start: string
    end: string
    leadId?: string
    paymentRef?: string
    amount?: number
    currency?: string
}

type CalendarDoc = {
    blockedDates?: string[]
    globalBlackoutDates?: Array<{ start: string; end: string }>
}

const rangesOverlap = (start: moment.Moment, end: moment.Moment, rangeStart: moment.Moment, rangeEnd: moment.Moment) => {
    return start.isSameOrBefore(rangeEnd, 'day') && end.isSameOrAfter(rangeStart, 'day')
}

const hasBlockedDatesInRange = (calendar: CalendarDoc, start: moment.Moment, end: moment.Moment) => {
    const blockedDates = calendar.blockedDates || []
    const hasBlockedDate = blockedDates.some((dateStr) => {
        const date = moment(dateStr, 'YYYY-MM-DD', true)
        if (!date.isValid()) return false
        return date.isSameOrAfter(start, 'day') && date.isSameOrBefore(end, 'day')
    })
    if (hasBlockedDate) return true

    const blackoutDates = calendar.globalBlackoutDates || []
    return blackoutDates.some((block) => {
        const blockStart = moment(block.start, 'YYYY-MM-DD', true)
        const blockEnd = moment(block.end, 'YYYY-MM-DD', true)
        if (!blockStart.isValid() || !blockEnd.isValid()) return false
        return rangesOverlap(start, end, blockStart, blockEnd)
    })
}

export const createHold = async (input: CreateHoldInput) => {
    const db = await getManualAgentsDb()
    const collections = getManualAgentsCollections()
    const calendarCollection = db.collection(collections.quintasCalendar)
    const logCollection = db.collection(collections.manualAgentCalendarLogs)

    const startDate = moment(input.start, 'YYYY-MM-DD', true)
    const endDate = moment(input.end, 'YYYY-MM-DD', true)
    if (!startDate.isValid() || !endDate.isValid() || endDate.isBefore(startDate, 'day')) {
        return { ok: false, reason: 'invalid_date' as const }
    }

    const calendarDocs = (await calendarCollection.find({ propertyId: input.propertyId }).toArray()) as CalendarDoc[]
    const isBlocked = calendarDocs.some((calendar) => hasBlockedDatesInRange(calendar, startDate, endDate))
    if (isBlocked) {
        return { ok: false, reason: 'date_blocked' as const }
    }

    const holdHours = input.holdHours || 24
    const holdExpires = new Date(Date.now() + holdHours * 60 * 60 * 1000)

    const conflict = await calendarCollection.findOne({
        propertyId: input.propertyId,
        events: {
            $elemMatch: {
                start: { $lte: input.end },
                end: { $gte: input.start },
                $or: [{ status: 'booked' }, { status: 'hold', holdExpires: { $gt: new Date() } }]
            }
        }
    })

    if (conflict) {
        return { ok: false, reason: 'date_unavailable' as const }
    }

    await calendarCollection.updateOne(
        { propertyId: input.propertyId, year: new Date(input.start).getFullYear() },
        {
            $push: {
                events: {
                    start: input.start,
                    end: input.end,
                    status: 'hold',
                    holdExpires,
                    leadId: input.leadId,
                    notes: input.notes
                }
            },
            $set: { updatedAt: new Date() }
        },
        { upsert: true }
    )

    await logCollection.insertOne({
        type: 'hold_created',
        propertyId: input.propertyId,
        start: input.start,
        end: input.end,
        leadId: input.leadId,
        holdExpires,
        notes: input.notes || null,
        createdAt: new Date()
    })

    return { ok: true, holdExpires }
}

export const confirmPayment = async (input: ConfirmPaymentInput) => {
    const db = await getManualAgentsDb()
    const collections = getManualAgentsCollections()
    const calendarCollection = db.collection(collections.quintasCalendar)
    const logCollection = db.collection(collections.manualAgentCalendarLogs)

    const alreadyBooked = await calendarCollection.findOne({
        propertyId: input.propertyId,
        events: { $elemMatch: { status: 'booked', start: input.start, end: input.end } }
    })
    if (alreadyBooked) {
        return { ok: true, alreadyBooked: true as const }
    }

    const result = await calendarCollection.updateOne(
        {
            propertyId: input.propertyId,
            events: {
                $elemMatch: {
                    status: 'hold',
                    start: input.start,
                    end: input.end,
                    holdExpires: { $gt: new Date() }
                }
            }
        },
        {
            $set: {
                'events.$[evt].status': 'booked',
                'events.$[evt].paymentRef': input.paymentRef,
                'events.$[evt].paidAt': new Date(),
                updatedAt: new Date()
            }
        },
        {
            arrayFilters: [{ 'evt.status': 'hold', 'evt.start': input.start, 'evt.end': input.end }]
        }
    )

    if (!result.matchedCount) {
        return { ok: false, reason: 'hold_expired' as const }
    }

    await logCollection.insertOne({
        type: 'payment_confirmed',
        propertyId: input.propertyId,
        start: input.start,
        end: input.end,
        leadId: input.leadId,
        paymentRef: input.paymentRef,
        amount: input.amount,
        currency: input.currency,
        createdAt: new Date()
    })

    return { ok: true }
}
