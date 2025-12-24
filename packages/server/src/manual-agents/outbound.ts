import moment from 'moment-timezone'
import { ensureManualAgentsIndexes, getManualAgentsCollections, getManualAgentsDb } from './mongo'
import { ensureQuintasSeed } from './quintasData'

export const computeOutbound = async () => {
    await ensureQuintasSeed()
    const db = await getManualAgentsDb()
    const collections = getManualAgentsCollections()

    const leadsDoc = await db.collection(collections.quintasLeads).findOne({ type: 'seed' })
    const leads = (leadsDoc?.leads || []) as Array<{
        status?: string
        name?: string
        phone?: string
        notes?: string
        lastOutboundAt?: string | Date
        lastContactAt?: string | Date
        dateRequested?: string
    }>
    const templates = leadsDoc?.outreachTemplates || []
    const kpiConfig = leadsDoc?.kpiConfig || { occupancyTargetPct: 70 }

    const calendarDocs = await db.collection(collections.quintasCalendar).find({}).toArray()
    const daysWindow = 14
    const timezone = process.env.MANUAL_AGENT_OUTBOUND_TIMEZONE || 'America/Argentina/Buenos_Aires'
    const startDate = moment.tz(timezone).startOf('day')
    const endDate = moment.tz(timezone).add(daysWindow, 'days').startOf('day')
    const outboundCooldownDays = 7

    let totalSlots = 0
    let occupiedSlots = 0

    for (const doc of calendarDocs) {
        for (let day = startDate.clone(); day.isBefore(endDate); day.add(1, 'day')) {
            totalSlots += 1
            const dateStr = day.format('YYYY-MM-DD')
            const blocked = (doc.blockedDates || []).includes(dateStr)
            const events = doc.events || []
            const occupied =
                blocked ||
                events.some((event: any) => {
                    if (!['booked', 'hold'].includes(event.status)) return false
                    const start = moment(event.start, 'YYYY-MM-DD')
                    const end = moment(event.end, 'YYYY-MM-DD')
                    return day.isSameOrAfter(start, 'day') && day.isSameOrBefore(end, 'day')
                })
            if (occupied) occupiedSlots += 1
        }
    }

    const occupancyPct = totalSlots ? (occupiedSlots / totalSlots) * 100 : 0
    const shouldOutbound = occupancyPct < (kpiConfig.occupancyTargetPct || 70)

    const leadsToContact = leads.filter((lead) => {
        const statusOk = ['lost', 'open'].includes((lead.status || '').toLowerCase())
        if (!statusOk) return false
        const lastContact =
            lead.lastContactAt || lead.lastOutboundAt || (lead.dateRequested ? moment(lead.dateRequested, 'YYYY-MM-DD').toDate() : null)
        if (!lastContact) return true
        const lastMoment = moment(lastContact)
        if (!lastMoment.isValid()) return true
        return startDate.diff(lastMoment, 'days') >= outboundCooldownDays
    })

    return {
        occupancyPct,
        shouldOutbound,
        leads: leadsToContact,
        templates,
        windowDays: daysWindow,
        occupancyTargetPct: kpiConfig.occupancyTargetPct || 70,
        outboundCooldownDays
    }
}

export const runOutbound = async (options: { agentId?: string; source?: string } = {}) => {
    await ensureManualAgentsIndexes()
    const db = await getManualAgentsDb()
    const collections = getManualAgentsCollections()
    const result = await computeOutbound()
    const agentId = options.agentId || 'quintas'
    const source = options.source || 'manual'

    await db.collection(collections.manualAgentOutboundRuns).insertOne({
        agentId,
        source,
        occupancyPct: result.occupancyPct,
        shouldOutbound: result.shouldOutbound,
        leadCount: result.leads?.length || 0,
        templateCount: result.templates?.length || 0,
        windowDays: result.windowDays,
        occupancyTargetPct: result.occupancyTargetPct,
        createdAt: new Date()
    })

    return result
}
