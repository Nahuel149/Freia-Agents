// Sistema de gestión de direcciones para B2B Sales
const B2BSalesDB = require('./database-config')

class AddressManager {
    constructor(dbConnectionString) {
        this.db = new B2BSalesDB(dbConnectionString)
    }

    // Crear tabla de direcciones si no existe
    async initializeAddressTable() {
        try {
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS customer_addresses (
                    id SERIAL PRIMARY KEY,
                    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
                    phone_number VARCHAR(20) NOT NULL,
                    address_label VARCHAR(100), -- 'Casa', 'Trabajo', 'Depósito', etc.
                    full_address TEXT NOT NULL,
                    city VARCHAR(100),
                    province VARCHAR(100),
                    postal_code VARCHAR(20),
                    is_default BOOLEAN DEFAULT FALSE,
                    delivery_instructions TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_addresses_customer_id ON customer_addresses(customer_id);
                CREATE INDEX IF NOT EXISTS idx_addresses_phone ON customer_addresses(phone_number);
                CREATE INDEX IF NOT EXISTS idx_addresses_default ON customer_addresses(is_default);
            `

            await this.db.pool.query(createTableQuery)
            console.log('Address table initialized successfully')
        } catch (error) {
            console.error('Error initializing address table:', error)
        }
    }

    // Obtener todas las direcciones de un cliente
    async getCustomerAddresses(phoneNumber) {
        try {
            const query = `
                SELECT ca.*, c.first_name, c.last_name
                FROM customer_addresses ca
                JOIN customers c ON ca.customer_id = c.id
                WHERE ca.phone_number = $1
                ORDER BY ca.is_default DESC, ca.created_at DESC;
            `

            const result = await this.db.pool.query(query, [phoneNumber])
            return result.rows
        } catch (error) {
            console.error('Error getting customer addresses:', error)
            return []
        }
    }

    // Obtener dirección por defecto del cliente
    async getDefaultAddress(phoneNumber) {
        try {
            const query = `
                SELECT ca.*
                FROM customer_addresses ca
                WHERE ca.phone_number = $1 AND ca.is_default = TRUE
                LIMIT 1;
            `

            const result = await this.db.pool.query(query, [phoneNumber])
            return result.rows[0] || null
        } catch (error) {
            console.error('Error getting default address:', error)
            return null
        }
    }

    // Agregar nueva dirección
    async addAddress(addressData) {
        try {
            const { customerId, phoneNumber, addressLabel, fullAddress, city, province, postalCode, isDefault, deliveryInstructions } =
                addressData

            // Si es dirección por defecto, quitar el default de las otras
            if (isDefault) {
                await this.db.pool.query('UPDATE customer_addresses SET is_default = FALSE WHERE phone_number = $1', [phoneNumber])
            }

            const query = `
                INSERT INTO customer_addresses (
                    customer_id, phone_number, address_label, full_address, city,
                    province, postal_code, is_default, delivery_instructions
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *;
            `

            const result = await this.db.pool.query(query, [
                customerId,
                phoneNumber,
                addressLabel,
                fullAddress,
                city,
                province,
                postalCode,
                isDefault,
                deliveryInstructions
            ])

            return result.rows[0]
        } catch (error) {
            console.error('Error adding address:', error)
            return null
        }
    }

    // Actualizar dirección existente
    async updateAddress(addressId, updateData) {
        try {
            const { addressLabel, fullAddress, city, province, postalCode, isDefault, deliveryInstructions } = updateData

            // Si se marca como default, quitar default de las otras del mismo cliente
            if (isDefault) {
                const phoneQuery = 'SELECT phone_number FROM customer_addresses WHERE id = $1'
                const phoneResult = await this.db.pool.query(phoneQuery, [addressId])

                if (phoneResult.rows[0]) {
                    await this.db.pool.query('UPDATE customer_addresses SET is_default = FALSE WHERE phone_number = $1 AND id != $2', [
                        phoneResult.rows[0].phone_number,
                        addressId
                    ])
                }
            }

            const query = `
                UPDATE customer_addresses 
                SET address_label = COALESCE($2, address_label),
                    full_address = COALESCE($3, full_address),
                    city = COALESCE($4, city),
                    province = COALESCE($5, province),
                    postal_code = COALESCE($6, postal_code),
                    is_default = COALESCE($7, is_default),
                    delivery_instructions = COALESCE($8, delivery_instructions),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *;
            `

            const result = await this.db.pool.query(query, [
                addressId,
                addressLabel,
                fullAddress,
                city,
                province,
                postalCode,
                isDefault,
                deliveryInstructions
            ])

            return result.rows[0]
        } catch (error) {
            console.error('Error updating address:', error)
            return null
        }
    }

    // Establecer dirección como predeterminada
    async setDefaultAddress(addressId) {
        try {
            // Obtener teléfono del cliente
            const phoneQuery = 'SELECT phone_number FROM customer_addresses WHERE id = $1'
            const phoneResult = await this.db.pool.query(phoneQuery, [addressId])

            if (!phoneResult.rows[0]) {
                throw new Error('Address not found')
            }

            const phoneNumber = phoneResult.rows[0].phone_number

            // Quitar default de todas las direcciones del cliente
            await this.db.pool.query('UPDATE customer_addresses SET is_default = FALSE WHERE phone_number = $1', [phoneNumber])

            // Establecer la nueva dirección como default
            const query = `
                UPDATE customer_addresses 
                SET is_default = TRUE, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *;
            `

            const result = await this.db.pool.query(query, [addressId])
            return result.rows[0]
        } catch (error) {
            console.error('Error setting default address:', error)
            return null
        }
    }

    // Eliminar dirección
    async deleteAddress(addressId) {
        try {
            const query = 'DELETE FROM customer_addresses WHERE id = $1 RETURNING *'
            const result = await this.db.pool.query(query, [addressId])
            return result.rows[0]
        } catch (error) {
            console.error('Error deleting address:', error)
            return null
        }
    }

    // Buscar direcciones por texto
    async searchAddresses(phoneNumber, searchText) {
        try {
            const query = `
                SELECT * FROM customer_addresses 
                WHERE phone_number = $1 
                AND (full_address ILIKE $2 OR address_label ILIKE $2)
                ORDER BY is_default DESC, created_at DESC;
            `

            const result = await this.db.pool.query(query, [phoneNumber, `%${searchText}%`])
            return result.rows
        } catch (error) {
            console.error('Error searching addresses:', error)
            return []
        }
    }

    // Generar mensaje para el agente con opciones de dirección
    async generateAddressOptions(phoneNumber) {
        try {
            const addresses = await this.getCustomerAddresses(phoneNumber)

            if (addresses.length === 0) {
                return 'No tenés direcciones guardadas. Por favor, proporcioná la dirección de entrega.'
            }

            if (addresses.length === 1) {
                const addr = addresses[0]
                return `Tenés guardada la dirección: ${addr.full_address}${
                    addr.address_label ? ` (${addr.address_label})` : ''
                }. ¿Hacemos el envío ahí o preferís otra dirección?`
            }

            let message = 'Tenés estas direcciones guardadas:\n'
            addresses.forEach((addr, index) => {
                const defaultLabel = addr.is_default ? ' (habitual)' : ''
                const label = addr.address_label ? ` - ${addr.address_label}` : ''
                message += `${index + 1}. ${addr.full_address}${label}${defaultLabel}\n`
            })
            message += '¿A cuál querés que hagamos el envío o preferís una dirección nueva?'

            return message
        } catch (error) {
            console.error('Error generating address options:', error)
            return 'Error al consultar direcciones. Por favor, proporcioná la dirección de entrega.'
        }
    }
}

module.exports = AddressManager

// Ejemplo de uso:
// const addressManager = new AddressManager();
// await addressManager.initializeAddressTable();
// const options = await addressManager.generateAddressOptions('+5491123456789');
