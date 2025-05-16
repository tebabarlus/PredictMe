// backend/src/routes/predictions.js
const express = require('express');
const predictionsController = require('../controllers/predictions'); // Import the predictions controller
const { verifyJWT, checkUserExists } = require('../middleware/auth'); // Import auth middleware

const router = express.Router(); // Make sure this line exists and is correct

/**
 * @route   GET /api/predictions/user/:walletAddress
 * @desc    Get all predictions for a user
 * @access  Public (assuming user predictions are publicly viewable)
 * RLS on 'predictions' and 'events' should allow select.
 */
router.get('/user/:walletAddress', predictionsController.getUserPredictions);

/**
 * @route   GET /api/predictions/event/:eventId
 * @desc    Get all predictions for an event
 * @access  Public (assuming event predictions are publicly viewable)
 * RLS on 'predictions' and 'users' should allow select.
 */
router.get('/event/:eventId', predictionsController.getEventPredictions);

/**
 * @route   POST /api/predictions
 * @desc    Create a new prediction
 * @access  Private (requires authentication)
 * Uses verifyJWT and checkUserExists to ensure authenticated user creates the prediction.
 * RLS on 'predictions' should allow insert where user_wallet = auth.wallet().
 */
// Apply middleware: verifyJWT -> checkUserExists -> controller
router.post('/', verifyJWT, checkUserExists, predictionsController.createPrediction);

// Note: Update/Delete prediction routes are not implemented here but would follow a similar pattern,
// likely requiring verification that the user is the creator of the prediction.

// Add this console.log before the export
console.log('Predictions Router File: router object before export:', typeof router, router);

module.exports = router; // Make sure this is the very last line and is exactly correct

// This log will only show if the export line itself doesn't cause an error
console.log('Predictions Router File: export statement executed.');