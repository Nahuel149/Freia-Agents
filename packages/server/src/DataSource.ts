import 'reflect-metadata'
import path from 'path'
import * as fs from 'fs'
import { DataSource } from 'typeorm'
import { getUserHome } from './utils'
import { entities } from './database/entities'

import { mysqlMigrations } from './database/migrations/mysql'
import { mariadbMigrations } from './database/migrations/mariadb'
import { postgresMigrations } from './database/migrations/postgres'
import logger from './utils/logger'

let appDataSource: DataSource

export const init = async (): Promise<void> => {
    logger.info(`[DataSource] Initializing database with type: ${process.env.DATABASE_TYPE || 'postgres (default)'}`)

    let flowisePath = path.join(getUserHome(), '.flowise')
    if (!fs.existsSync(flowisePath)) {
        fs.mkdirSync(flowisePath)
    }

    // Log environment variables for debugging
    logger.info(`[DataSource] DATABASE_TYPE: ${process.env.DATABASE_TYPE || 'undefined'}`)
    logger.info(`[DataSource] DATABASE_PATH: ${process.env.DATABASE_PATH || 'undefined'}`)
    logger.info(`[DataSource] DATABASE_HOST: ${process.env.DATABASE_HOST || 'undefined'}`)
    logger.info(`[DataSource] DATABASE_PORT: ${process.env.DATABASE_PORT || 'undefined'}`)

    switch (process.env.DATABASE_TYPE) {
        case 'sqlite':
            throw new Error(
                'SQLite support has been removed. Please set DATABASE_TYPE=postgres and configure the appropriate environment variables.'
            )
        case 'mysql':
            appDataSource = new DataSource({
                type: 'mysql',
                host: process.env.DATABASE_HOST,
                port: parseInt(process.env.DATABASE_PORT || '3306'),
                username: process.env.DATABASE_USER,
                password: process.env.DATABASE_PASSWORD,
                database: process.env.DATABASE_NAME,
                charset: 'utf8mb4',
                synchronize: false,
                migrationsRun: false,
                entities: Object.values(entities),
                migrations: mysqlMigrations,
                ssl: getDatabaseSSLFromEnv()
            })
            break
        case 'mariadb':
            appDataSource = new DataSource({
                type: 'mariadb',
                host: process.env.DATABASE_HOST,
                port: parseInt(process.env.DATABASE_PORT || '3306'),
                username: process.env.DATABASE_USER,
                password: process.env.DATABASE_PASSWORD,
                database: process.env.DATABASE_NAME,
                charset: 'utf8mb4',
                synchronize: false,
                migrationsRun: false,
                entities: Object.values(entities),
                migrations: mariadbMigrations,
                ssl: getDatabaseSSLFromEnv()
            })
            break
        case 'postgres':
            appDataSource = new DataSource({
                type: 'postgres',
                host: process.env.DATABASE_HOST,
                port: parseInt(process.env.DATABASE_PORT || '5432'),
                username: process.env.DATABASE_USER,
                password: process.env.DATABASE_PASSWORD,
                database: process.env.DATABASE_NAME,
                ssl: getDatabaseSSLFromEnv(),
                synchronize: false,
                migrationsRun: false,
                entities: Object.values(entities),
                migrations: postgresMigrations,
                extra: {
                    idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '120000'),
                    max: parseInt(process.env.DATABASE_POOL_MAX || '10'),
                    min: parseInt(process.env.DATABASE_POOL_MIN || '2'),
                    connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECT_TIMEOUT || '30000'),
                    acquireTimeoutMillis: parseInt(process.env.DATABASE_ACQUIRE_TIMEOUT || '60000')
                },
                logging: ['error', 'warn', 'info', 'log'],
                logger: 'advanced-console',
                logNotifications: true,
                poolErrorHandler: (err) => {
                    logger.error(`Database pool error: ${JSON.stringify(err)}`)
                },
                applicationName: 'Flowise'
            })
            break
        default:
            logger.info(`[DataSource] Using default Postgres configuration (DATABASE_TYPE not set or invalid)`)
            appDataSource = new DataSource({
                type: 'postgres',
                host: process.env.DATABASE_HOST || 'localhost',
                port: parseInt(process.env.DATABASE_PORT || '5432'),
                username: process.env.DATABASE_USER,
                password: process.env.DATABASE_PASSWORD,
                database: process.env.DATABASE_NAME,
                ssl: getDatabaseSSLFromEnv(),
                synchronize: false,
                migrationsRun: false,
                entities: Object.values(entities),
                migrations: postgresMigrations,
                extra: {
                    idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '120000'),
                    max: parseInt(process.env.DATABASE_POOL_MAX || '10'),
                    min: parseInt(process.env.DATABASE_POOL_MIN || '2'),
                    connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECT_TIMEOUT || '30000'),
                    acquireTimeoutMillis: parseInt(process.env.DATABASE_ACQUIRE_TIMEOUT || '60000')
                }
            })
            break
    }
}

export function getDataSource(): DataSource {
    if (appDataSource === undefined) {
        init()
    }
    return appDataSource
}

export const getDatabaseSSLFromEnv = () => {
    if (process.env.DATABASE_SSL_KEY_BASE64) {
        return {
            rejectUnauthorized: false,
            ca: Buffer.from(process.env.DATABASE_SSL_KEY_BASE64, 'base64')
        }
    } else if (process.env.DATABASE_SSL === 'true') {
        // For cloud providers like Render, we need to allow self-signed certificates
        return {
            rejectUnauthorized: false
        }
    }
    return undefined
}
