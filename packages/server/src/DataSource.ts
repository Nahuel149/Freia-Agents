import 'reflect-metadata'
import path from 'path'
import * as fs from 'fs'
import { DataSource } from 'typeorm'
import { getUserHome } from './utils'
import { entities } from './database/entities'
import { sqliteMigrations } from './database/migrations/sqlite'
import { mysqlMigrations } from './database/migrations/mysql'
import { mariadbMigrations } from './database/migrations/mariadb'
import { postgresMigrations } from './database/migrations/postgres'
import logger from './utils/logger'

let appDataSource: DataSource

export const init = async (): Promise<void> => {
    logger.info(`[DataSource] Initializing database with type: ${process.env.DATABASE_TYPE || 'sqlite (default)'}`)
    
    let homePath
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
            homePath = process.env.DATABASE_PATH ?? flowisePath
            logger.info(`[DataSource] SQLite database path: ${homePath}`)
            
            // Ensure the database directory exists and is writable
            try {
                if (!fs.existsSync(homePath)) {
                    fs.mkdirSync(homePath, { recursive: true })
                    logger.info(`[DataSource] Created database directory: ${homePath}`)
                }
                
                const dbFile = path.resolve(homePath, 'database.sqlite')
                logger.info(`[DataSource] SQLite database file: ${dbFile}`)
                
                appDataSource = new DataSource({
                    type: 'sqlite',
                    database: dbFile,
                    synchronize: false,
                    migrationsRun: false,
                    entities: Object.values(entities),
                    migrations: sqliteMigrations
                })
            } catch (error) {
                logger.error(`[DataSource] Failed to setup SQLite database: ${error instanceof Error ? error.message : String(error)}`)
                throw error
            }
            break
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
                    idleTimeoutMillis: 120000
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
            logger.info(`[DataSource] Using default SQLite configuration (DATABASE_TYPE not set or invalid)`)
            homePath = process.env.DATABASE_PATH ?? flowisePath
            logger.info(`[DataSource] Default SQLite database path: ${homePath}`)
            
            // Ensure the database directory exists and is writable
            try {
                if (!fs.existsSync(homePath)) {
                    fs.mkdirSync(homePath, { recursive: true })
                    logger.info(`[DataSource] Created default database directory: ${homePath}`)
                }
                
                const dbFile = path.resolve(homePath, 'database.sqlite')
                logger.info(`[DataSource] Default SQLite database file: ${dbFile}`)
                
                appDataSource = new DataSource({
                    type: 'sqlite',
                    database: dbFile,
                    synchronize: false,
                    migrationsRun: false,
                    entities: Object.values(entities),
                    migrations: sqliteMigrations
                })
            } catch (error) {
                logger.error(`[DataSource] Failed to setup default SQLite database: ${error instanceof Error ? error.message : String(error)}`)
                throw error
            }
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
        return true
    }
    return undefined
}
