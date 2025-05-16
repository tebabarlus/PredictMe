// src/routes/auth.js
const express = require('express');
const authController = require('../controllers/auth'); // Import the auth controller

// No authentication middleware needed here as these are the authentication endpoints
// const { verifyJWT } = require('../middleware/auth'); // Not needed here

const router = express.Router();

/**
 * @route   GET /api/auth/nonce
 * @desc    Get a nonce for wallet signature.
 * @access  Public (anyone can request a nonce)
 */
router.get('/nonce', authController.getNonce);

/**
 * @route   POST /api/auth/verify
 * @desc    Verify wallet signature and authenticate (generate JWT).
 * @access  Public (anyone can attempt to verify, but successful verification grants access)
 */
router.post('/verify', authController.verifyAuth); // Call the verifyAuth controller function

// No other auth routes needed for this flow currently.
// You might add logout routes here if your frontend's auth.signOut doesn't directly call Supabase.js.

module.exports = router; // Export the router