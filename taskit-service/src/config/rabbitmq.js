import amqp from 'amqplib'
import { logger } from './winston.js'

let connection = null
let channel = null

/**
 * Connects to RabbitMQ and creates a channel.
 */
/**
 * Establishes a connection to RabbitMQ, creates a channel, and asserts the 'tasks' exchange.
 * Handles connection errors and automatically retries on failure.
 * Logs connection status and errors using the provided logger.
 *
 * @async
 * @function connect
 * @returns {Promise<void>} Resolves when the connection and channel are established.
 */
async function connect () {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://admin:password@rabbitmq:5672')

    channel = await connection.createChannel()

    await channel.assertExchange('tasks', 'topic', { durable: true })

    logger.info('RabbitMQ is connected')

    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error', err)
    })

    connection.on('close', () => {
      logger.info('RabbitMQ connection closed')
    })
  } catch (error) {
    logger.error('Failed to connect to RabbitMQ:', error)
    setTimeout(connect, 5000)
  }
}

/**
 * Publishes an event message to the 'tasks' exchange using the provided routing key.
 *
 * @param {string} routingKey - The routing key (topic) to publish the message to.
 * @param {any} message - The message payload to be sent; it will be JSON-stringified.
 * @returns {Promise<void>} Resolves when the publish attempt has been made.
 */
export async function publishEvent (routingKey, message) {
  try {
    if (!channel) {
      logger.error('Rabbit channel not available')
      return
    }

    const messageBuffer = Buffer.from(JSON.stringify(message))

    channel.publish('tasks', routingKey, messageBuffer, {
      persistent: true,
      contentType: 'application/json'
    })

    logger.info(`Event published: ${routingKey}`, message)
  } catch (error) {
    logger.error('Failed to publish event:', error)
  }
}

/**
 * Closes the RabbitMQ connection.
 *
 * @returns {Promise<void>} Resolves when the connection and channel are closed.
 */
export async function close () {
  try {
    if (channel) {
      await channel.close()
    }
    if (connection) {
      await connection.close()
    }
    logger.info('RabbitMQ connection closed gracefully')
  } catch (error) {
    logger.error('Error closing RabbitMQ connection:', error)
  }
}

await connect()

export default {
  publishEvent,
  close
}
