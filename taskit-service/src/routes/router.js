/**
 * @file Defines the main router.
 * @module routes/router
 * @author Mats Loock
 * @version 3.0.0
 */

import express from 'express'
import http from 'node:http'
import { router as homeRouter } from './homeRouter.js'
import { router as taskRouter } from './taskRouter.js'

export const router = express.Router()

router.use('/', homeRouter)
router.use('/tasks', taskRouter)

// Catch 404 (ALWAYS keep this as the last route).
router.use('*', (req, res, next) => {
  const statusCode = 404
  const error = new Error(http.STATUS_CODES[statusCode])
  error.status = statusCode
  next(error)
})
