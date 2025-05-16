// src/routes/users.js
const express = require('express');
const usersController = require('../controllers/users'); // Import the users controller
// Import the authentication middleware
const { verifyJWT, checkUserExists } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/users/:walletAddress
 * @desc    Get user profile by wallet address.
 * @access  Public (assuming profiles are publicly readable by wallet address).
 * If you prefer private profiles (only readable by the owner or friends),
 * protect this route with verifyJWT and potentially checkUserExists,
 * and modify the controller to fetch based on req.user.id or check friendship status.
 * For simplicity based on the existing backend structure, we'll leave this public.
 */
router.get('/:walletAddress', usersController.getUserProfile); // Public access to profile by wallet

/**
 * @route   PUT /api/users/profile
 * @desc    Update authenticated user's profile.
 * @access  Private (requires authentication)
 * Uses verifyJWT to ensure the user is authenticated.
 * checkUserExists is added for an extra layer to ensure the user ID from the JWT
 * corresponds to an active profile in the 'users' table accessible via RLS.
 * The controller will update the profile for the authenticated user (from req.user.id).
 */
// Apply middleware: verifyJWT -> checkUserExists -> controller
router.put('/profile', verifyJWT, checkUserExists, usersController.updateUserProfile);

/**
 * @route   GET /api/users/friends
 * @desc    Get authenticated user's friends list.
 * @access  Private (requires authentication)
 * Uses verifyJWT and checkUserExists.
 * The controller will fetch friends for the authenticated user (from req.user.id).
 */
router.get('/friends', verifyJWT, checkUserExists, usersController.getUserFriends);

/**
 * @route   POST /api/users/friends
 * @desc    Add a friend.
 * @access  Private (requires authentication)
 * Uses verifyJWT and checkUserExists.
 * The controller will add a friend for the authenticated user (from req.user.id).
 */
router.post('/friends', verifyJWT, checkUserExists, usersController.addFriend);

/**
 * @route   DELETE /api/users/friends/:friendshipId
 * @desc    Remove a friend or decline a request.
 * @access  Private (requires authentication)
 * Uses verifyJWT and checkUserExists.
 * The controller will remove the friendship record where the authenticated user
 * is involved and the friendship ID matches the param.
 */
router.delete('/friends/:friendshipId', verifyJWT, checkUserExists, usersController.removeFriend);

/**
 * @route   POST /api/users/support
 * @desc    Submit a support ticket.
 * @access  Private (requires authentication) OR Public (depends on your needs).
 * If protected, uses verifyJWT & checkUserExists and links ticket to user ID.
 * If public, remove middleware and rely on `user_wallet` from the body.
 * Let's make it protected for now, linking tickets to authenticated users.
 * If you need public tickets, remove verifyJWT and checkUserExists middleware from this route.
 */
router.post('/support', verifyJWT, checkUserExists, usersController.submitSupportTicket);

/**
 * @route   PUT /api/users/settings
 * @desc    Update authenticated user's settings.
 * @access  Private (requires authentication)
 * Uses verifyJWT and checkUserExists.
 * The controller will update settings for the authenticated user (from req.user.id).
 */
router.put('/settings', verifyJWT, checkUserExists, usersController.updateUserSettings);

/**
 * @route   GET /api/users/settings
 * @desc    Get authenticated user's settings.
 * @access  Private (requires authentication)
 * Uses verifyJWT and checkUserExists.
 * The controller will get settings for the authenticated user (from req.user.id).
 */
router.get('/settings', verifyJWT, checkUserExists, usersController.getUserSettings);


module.exports = router; // Export the router