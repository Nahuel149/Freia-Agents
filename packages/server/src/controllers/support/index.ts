import { Request, Response, NextFunction } from 'express'
import nodemailer from 'nodemailer'
import logger from '../../utils/logger'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { SupportTicket } from '../../database/entities/SupportTicket'

const buildTransporter = () => {
    const host = process.env.SMTP_HOST
    const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined
    const secure = process.env.SMTP_SECURE === 'true'
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS

    if (host && port && user && pass) {
        return nodemailer.createTransport({ host, port, secure, auth: { user, pass } })
    }
    if (user && pass) {
        return nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
    }
    return null
}

const submitTicket = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email, category, subject, message } = req.body || {}
        if (!message) return res.status(400).json({ message: 'Message is required' })

        const to = process.env.SUPPORT_EMAIL_TO || 'freia-agents@gmail.com'
        const from = process.env.SUPPORT_EMAIL_FROM || process.env.SMTP_USER || 'no-reply@support.local'
        const _subject = subject || `[${category || 'Support'}] New ticket`

        const files = Array.isArray((req as any).files) ? ((req as any).files as any[]) : []
        const hasLocalPaths = files.some((f: any) => f.path)
        const uploadedLinks = files
            .filter((f: any) => f.location)
            .map((f: any) => `- ${f.originalname} (${f.mimetype}): ${f.location}`)
            .join('\n')

        const html = `
            <div>
                <p><strong>Category:</strong> ${category || 'N/A'}</p>
                <p><strong>From:</strong> ${name || 'Anonymous'} ${email ? '&lt;' + email + '&gt;' : ''}</p>
                <p><strong>Message:</strong></p>
                <pre style="white-space:pre-wrap">${String(message)}</pre>
                ${files.length ? `<p><strong>Attachments:</strong> ${files.length} file(s)</p>` : ''}
                ${uploadedLinks ? `<pre>${uploadedLinks}</pre>` : ''}
            </div>
        `

        const text = `Category: ${category || 'N/A'}\nFrom: ${name || 'Anonymous'} ${email ? '<' + email + '>' : ''}\n\n${String(
            message
        )}\n\n${uploadedLinks ? 'Attachments (links):\n' + uploadedLinks : ''}`

        const transporter = buildTransporter()
        if (!transporter) {
            logger.warn('[support] Email transporter not configured. Falling back to log output.')
            logger.info(`[support] Ticket to=${to} subject=${_subject} body=${text}`)
            return res.json({ message: 'Ticket logged (email not configured). We will follow up shortly.' })
        }

        const attachments = hasLocalPaths
            ? files.filter((f: any) => f.path).map((f: any) => ({ filename: f.originalname, path: f.path, contentType: f.mimetype }))
            : undefined

        await transporter.sendMail({ to, from, replyTo: email || from, subject: _subject, text, html, attachments })

        // Persist ticket to DB
        try {
            const app = getRunningExpressApp()
            const repo = app.AppDataSource.getRepository(SupportTicket)
            const ticket = new SupportTicket()
            Object.assign(ticket, {
                name,
                email,
                category,
                subject,
                message,
                status: 'OPEN',
                attachments: files.length
                    ? JSON.stringify(
                          files.map((f: any) => ({
                              originalname: f.originalname,
                              mimetype: f.mimetype,
                              size: f.size,
                              location: f.location,
                              path: f.path
                          }))
                      )
                    : null
            })
            await repo.save(ticket)
        } catch (e) {
            logger.warn(`[support] failed to persist ticket: ${e}`)
        }
        return res.json({ message: 'Support ticket submitted successfully' })
    } catch (err) {
        logger.error(`[support] Failed to submit ticket: ${err}`)
        next(err)
    }
}

export default { submitTicket }
