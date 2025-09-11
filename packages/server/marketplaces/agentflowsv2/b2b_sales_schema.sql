-- Esquema de base de datos para B2B Sales Agents Demo
-- Schema will be created in the existing freia_postgres database

-- Tabla de clientes
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    default_address TEXT,
    default_payment_method VARCHAR(50),
    previous_purchases TEXT, -- JSON string con historial
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de ventas
CREATE TABLE sales (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    phone_number VARCHAR(20) NOT NULL,
    product_sku VARCHAR(100) NOT NULL,
    product_brand VARCHAR(100),
    product_model VARCHAR(100),
    wheel_size VARCHAR(50),
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,2),
    total_price DECIMAL(10,2),
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    final_price DECIMAL(10,2),
    payment_method VARCHAR(50),
    delivery_method VARCHAR(50),
    delivery_address TEXT,
    sale_status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, delivered, cancelled
    negotiation_attempts INTEGER DEFAULT 0,
    agent_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de seguimientos
CREATE TABLE follow_ups (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    phone_number VARCHAR(20) NOT NULL,
    sale_id INTEGER REFERENCES sales(id),
    follow_up_type VARCHAR(50) NOT NULL, -- initial_contact, negotiation_followup, post_sale
    scheduled_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, cancelled
    attempt_number INTEGER DEFAULT 1,
    max_attempts INTEGER DEFAULT 3,
    message_sent TEXT,
    customer_response TEXT,
    next_action VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar performance
CREATE INDEX idx_customers_phone ON customers(phone_number);
CREATE INDEX idx_sales_customer_id ON sales(customer_id);
CREATE INDEX idx_sales_phone ON sales(phone_number);
CREATE INDEX idx_sales_status ON sales(sale_status);
CREATE INDEX idx_followups_customer_id ON follow_ups(customer_id);
CREATE INDEX idx_followups_scheduled ON follow_ups(scheduled_at);
CREATE INDEX idx_followups_status ON follow_ups(status);

-- Función para actualizar timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para auto-actualizar updated_at
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_followups_updated_at BEFORE UPDATE ON follow_ups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Datos de ejemplo
INSERT INTO customers (phone_number, first_name, last_name, default_address, default_payment_method) VALUES
('+5491123456789', 'Juan', 'Pérez', 'Av. Corrientes 1234, CABA', 'Transferencia'),
('+5491198765432', 'María', 'González', 'Av. Santa Fe 5678, CABA', 'Tarjeta');