import redis from 'redis'

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
})

redisClient.on('error', (err) => console.error('Redis Client Error', err))

redisClient.on('connect', () => console.log('Redis Client Connected'))

await redisClient.connect()

export default redisClient
