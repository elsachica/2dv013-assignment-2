import redis from 'redis'

/**
 * Creates and configures a Redis client instance.
 *
 * The client connects to the Redis server using the URL specified in the
 * environment variable `REDIS_URL`. If the environment variable is not set,
 * it defaults to `'redis://redis:6379'`.
 *
 * @type {import('redis').RedisClientType}
 */
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
})

redisClient.on('error', (err) => console.error('Redis Client Error', err))

redisClient.on('connect', () => console.log('Redis Client Connected'))

await redisClient.connect()

export default redisClient
