import { Client } from 'pg'
import { payload } from '../src/payload'
import { logger } from '../src/utilities/logger'

const reset = async (): Promise<void> => {
  try {
    logger.info('Resetting database...')
    
    // Get the schema from environment or use default
    const schema = process.env.DATABASE_SCHEMA || 'payload_cms'
    
    // Create a new client to drop and recreate the schema
    const client = new Client({
      connectionString: process.env.DATABASE_URI,
    })
    
    await client.connect()
    
    // Drop the schema and all its objects
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    logger.info(`Dropped schema: ${schema}`)
    
    // Recreate the schema
    await client.query(`CREATE SCHEMA "${schema}"`)
    logger.info(`Recreated schema: ${schema}`)
    
    // Close the client
    await client.end()
    
    // Run migrations to recreate tables
    logger.info('Running migrations...')
    await migrate({ payload })
    
    logger.info('Database reset completed successfully')
    process.exit(0)
  } catch (error) {
    logger.error('Error resetting database:', error)
    process.exit(1)
  }
}

reset()
