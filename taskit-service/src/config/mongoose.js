/**
 * @file This module contains the configuration for the Mongoose ODM.
 * @module config/mongoose
 * @author Elsa Gas Wikström
 * @version 3.1.0
 */

import mongoose from 'mongoose'
import { logger } from './winston.js'

/**
 * Establishes a connection to a database.
 *
 * @param {string} connectionString - The connection string.
 * @returns {Promise<mongoose.Mongoose>} Resolves to a Mongoose instance if connection succeeded.
 */
export const connectToDatabase = async (connectionString) => {
  const { connection } = mongoose

  mongoose.set('strict', 'throw')

  mongoose.set('strictQuery', true)

  connection.on('connected', () => logger.info('Mongoose connected to MongoDB.'))
  connection.on('error', (err) => logger.info(`Mongoose connection error: ${err}`))
  connection.on('disconnected', () => logger.info('Mongoose disconnected from MongoDB.'))

  for (const signalEvent of ['SIGINT', 'SIGTERM']) {
    process.on(signalEvent, () => {
      (async () => {
        await connection.close()
        logger.info(`Mongoose disconnected from MongoDB through ${signalEvent}.`)
        process.exit(0)
      })()
    })
  }

  logger.info('Mongoose connecting to MongoDB.')
  return mongoose.connect(connectionString)
}
