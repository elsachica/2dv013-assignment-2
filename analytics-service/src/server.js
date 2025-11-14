import express from 'express'
import { connectDatabase, getTaskCounts, getTasksCompletedOverTime } from './database.js'
import { startConsumer } from './consumer.js'

const app = express()
const PORT = process.env.PORT || 4000

app.set('view engine', 'ejs')
app.set('views', './src/views')
app.use(express.static('./src/public'))
/**
 * Dashboard route - displays analytics.
 */
app.get('/', async (req, res) => {
  try {
    const taskCounts = await getTaskCounts()
    const completedOverTime = await getTasksCompletedOverTime()
    
    res.render('dashboard', {
      taskCounts,
      completedOverTime
    })
  } catch (error) {
    console.error('Error rendering dashboard:', error)
    res.status(500).send('Error loading dashboard')
  }
})

/**
 * Health check endpoint.
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'analytics' })
})

/**
 * Start the server.
 */
/**
 * Initializes the analytics service by connecting to the database,
 * starting the message consumer, and launching the server.
 * Logs a message when the server is running.
 * If any step fails, logs the error and exits the process.
 *
 * @async
 * @function start
 * @returns {Promise<void>} Resolves when the service has started successfully.
 */
async function start () {
  try {
    await connectDatabase()
    await startConsumer()
    
    app.listen(PORT, () => {
      console.log(`Analytics Dashboard running at http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('Failed to start Analytics Service:', error)
    process.exit(1)
  }
}

start()