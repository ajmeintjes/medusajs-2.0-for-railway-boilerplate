import { migrate } from 'payload/database'
import { payload } from '../src/payload'
import { logger } from '../src/utilities/logger'

const init = async (): Promise<void> => {
  try {
    logger.info('Running database migrations...')
    await migrate({ payload })
    logger.info('Database migrations completed successfully')
    process.exit(0)
  } catch (error) {
    logger.error('Error running database migrations:', error)
    process.exit(1)
  }
}

init()
