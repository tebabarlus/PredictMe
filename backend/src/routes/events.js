// src/routes/events.js
const express = require('express');
const eventsController = require('../controllers/events'); // Import the events controller
const { verifyJWT, checkUserExists } = require('../middleware/auth'); // Import auth middleware

const router = express.Router();

/**
 * @route   GET /api/events
 * @desc    Get all events with pagination and filtering
 * @access  Public
 */
router.get('/', eventsController.getEvents);

/**
 * @route   GET /api/events/:eventId
 * @desc    Get a single event by ID (including predictions)
 * @access  Public
 */
router.get('/:eventId', eventsController.getEventById);

/**
 * @route   POST /api/events
 * @desc    Create a new event
 * @access  Private (requires authentication)
 * Uses verifyJWT and checkUserExists to ensure authenticated user creates the event.
 */
router.post('/', verifyJWT, checkUserExists, eventsController.createEvent);

/**
 * @route   PUT /api/events/:eventId
 * @desc    Update an event
 * @access  Private (requires authentication)
 * Uses verifyJWT and checkUserExists, and the controller verifies the user is the creator.
 */
router.put('/:eventId', verifyJWT, checkUserExists, eventsController.updateEvent);

// Note: DELETE event route is not implemented here but would follow a similar pattern,
// likely requiring verification that the user is the creator.

module.exports = router; // Export the router