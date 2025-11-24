import { useState } from 'react'

type Props = {
    amountCents: number
    currency: string
    countryCode: string
    orderId: string
    customerEmail: string
}

const CheckoutButton = ({ amountCents, currency, countryCode, orderId, customerEmail }: Props) => {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleClick = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/v1/payments/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amountCents, currency, countryCode, orderId, customerEmail })
            })
            const data = await res.json()
            if (data.redirectUrl) {
                window.location.href = data.redirectUrl
            } else if (data.checkoutId) {
                window.location.href = `https://mobbex.com/p/${data.checkoutId}`
            } else {
                throw new Error('No se recibió redirectUrl ni checkoutId')
            }
        } catch (err: any) {
            setError(err?.message || 'Error de checkout')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div>
            <button onClick={handleClick} disabled={loading}>
                {loading ? 'Procesando...' : 'Pagar'}
            </button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    )
}

export default CheckoutButton
