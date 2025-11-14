import { MongoClient } from 'mongodb'

const client = new MongoClient(process.env.ANALYTICS_DB_URL || 'mongodb://mongodb:27017')
let db

/**
 * Connects to the analytics MongoDB database.
 */
export async function connectDatabase () {
  try {
    await client.connect()
    db = client.db('jti-analytics')
    console.log('Analytics DB connected')
  } catch (error) {
    console.error('Analytics DB connection error:', error)
    process.exit(1)
  }
}

/**
 * Saves a metric event to the database.
 *
 * @param {object} metricData - The event object to save.
 */
export async function saveMetric (metricData) {
  try {
    await db.collection('metrics').insertOne({
      ...metricData,
      processed_at: new Date()
    })
    console.log(`Saved metric: ${metricData.event_type || metricData.routingKey}`)
  } catch (error) {
    console.error('Error saving metric:', error)
  }
}

/**
 * Gets tasks completed over time (aggregated by day).
 *
 * @returns {Promise<Array>} Array of objects with date and count.
 */
export async function getTasksCompletedOverTime () {
  return await db.collection('metrics')
    .aggregate([
      { $match: { event_type: 'task.updated', done: true, timestamp: { $type: "date" } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ])
    .toArray()
}

/**
 * Gets total task counts by type.
 *
 * @returns {Promise<object>} Object with created, completed, deleted counts.
 */
/**
 * Retrieves the count of task-related events from the 'metrics' collection.
 *
 * Aggregates the number of occurrences for each event type ('task.created', 'task.updated', 'task.deleted')
 * and returns an object containing the counts for each event type.
 *
 * @async
 * @function getTaskCounts
 * @returns {Promise<{created: number, updated: number, deleted: number}>} An object with the counts of created, updated, and deleted tasks.
 */
export async function getTaskCounts () {
  const metrics = await db.collection('metrics')
    .aggregate([
      { $group: { _id: '$event_type', count: { $sum: 1 } } }
    ])
    .toArray()

  return {
    created: metrics.find(m => m._id === 'task.created')?.count || 0,
    updated: metrics.find(m => m._id === 'task.updated')?.count || 0,
    deleted: metrics.find(m => m._id === 'task.deleted')?.count || 0
  }
}