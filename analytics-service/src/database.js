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
    console.log('✅ Analytics DB connected')
  } catch (error) {
    console.error('❌ Analytics DB connection error:', error)
    process.exit(1)
  }
}

/**
 * Saves a metric event to the database.
 *
 * @param {object} metricData - The event object to save.  ← ÄNDRA PARAMETER-NAMN!
 */
export async function saveMetric (metricData) {  // ← ÄNDRA HÄR!
  try {
    await db.collection('metrics').insertOne({
      ...metricData,  // ← ÄNDRA HÄR!
      processed_at: new Date()
    })
    console.log(`📊 Saved metric: ${metricData.event_type || metricData.routingKey}`)  // ← ÄNDRA HÄR!
  } catch (error) {
    console.error('❌ Error saving metric:', error)
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
      { $match: { event_type: 'task.updated', done: true } },  // ← FIXA: kolla done=true
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
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