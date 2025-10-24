/**
 * @file Defines the Task model.
 * @module models/TaskModel
 * @author Mats Loock
 * @version 3.0.0
 */

import mongoose from 'mongoose'
import { BASE_SCHEMA } from './baseSchema.js'

// Create a schema.
const schema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true,
    minlength: 1
  },
  done: {
    type: Boolean,
    required: true,
    default: false
  }
})

schema.add(BASE_SCHEMA)

// Create a model using the schema.
export const TaskModel = mongoose.model('Task', schema)
