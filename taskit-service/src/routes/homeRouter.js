/**
 * @file Defines the home router.
 * @module routes/homeRouter
 * @author Mats Loock
 * @version 3.0.0
 */

import express from 'express'
import { HomeController } from '../controllers/HomeController.js'

export const router = express.Router()

const controller = new HomeController()

router.get('/', (req, res, next) => controller.index(req, res, next))
