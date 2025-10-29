import express from 'express'
import { connectDatabase, getTaskCounts, getTasksCompletedOverTime } from './database.js'  // ← Fixa stavfelet!
import { startConsumer } from './consumer.js'

const app = express()
const PORT = process.env.PORT || 4000

// Set up EJS
app.set('view engine', 'ejs')
app.set('views', './src/views')

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
async function start () {
  try {
    await connectDatabase()
    await startConsumer()
    
    app.listen(PORT, () => {
      console.log(`📊 Analytics Dashboard running at http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('Failed to start Analytics Service:', error)
    process.exit(1)
  }
}

start()