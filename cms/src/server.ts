import { getPayload } from 'payload'
import { logger } from './utilities/logger'
import { config } from 'dotenv'
import path from 'path'
import payloadConfig from './payload.config'

// Load environment variables
config({
  path: path.resolve(process.cwd(), '.env'),
})

const start = async (): Promise<void> => {
  try {
    logger.info('Starting Payload CMS...')
    
    // Initialize Payload
    const payload = await getPayload({
      config: payloadConfig,
    })

    // Log that Payload is ready
    logger.info('Payload CMS is running...')
    
  } catch (error) {
    logger.error('Error starting Payload CMS:', error)
    process.exit(1)
  }
}

start()
