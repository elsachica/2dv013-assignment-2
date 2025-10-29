import amqp from 'amqplib'
import { saveMetric } from './database.js'

/**
 * Starts the RabbitMQ consumer to listen for task events.
 */
export async function startConsumer () {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://admin:password@rabbitmq:5672')
    const channel = await connection.createChannel()

    const exchange = 'tasks'
    const queue = 'analytics-queue'

    await channel.assertExchange(exchange, 'topic', { durable: true })
    await channel.assertQueue(queue, { durable: true })
    await channel.bindQueue(queue, exchange, 'task.*')

    console.log('🐰 Analytics Consumer started, waiting for events...')

    channel.consume(queue, async (msg) => {
      if (msg !== null) {
        try {
          const eventData = JSON.parse(msg.content.toString())
          const routingKey = msg.fields.routingKey
          
          console.log('📥 Received event:', eventData)

          // Lägg till event_type från routing key
          await saveMetric({
            event_type: routingKey,  // ← LÄGG TILL!
            ...eventData
          })

          channel.ack(msg)
        } catch (error) {
          console.error('❌ Error processing message:', error)
          channel.nack(msg, false, false)
        }
      }
    })

    connection.on('error', (err) => {
      console.error('RabbitMQ connection error:', err)
    })

    connection.on('close', () => {
      console.log('RabbitMQ connection closed, reconnecting...')
      setTimeout(startConsumer, 5000)
    })

  } catch (error) {
    console.error('Failed to start consumer:', error)
    setTimeout(startConsumer, 5000)
  }
}