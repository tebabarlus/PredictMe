// src/controllers/auth.js
const { ethers } = require('ethers');
// Use supabaseAdmin because nonce management and user creation/lookup
// during auth might require RLS bypass or admin privileges.
const { supabaseAdmin } = require('../utils/supabaseClient');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Use Node's built-in crypto for nonce generation

// JWT secret for token verification and signing (same as used in middleware)
// Make sure this matches the JWT_SECRET in your .env file
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
    // In a real app, you'd likely want a more graceful shutdown or error handling here
    // For now, we'll let the process potentially fail if auth is attempted.
}

/**
 * Generate a random nonce for wallet signature
 * GET /api/auth/nonce?address=<walletAddress>
 */
const getNonce = async (req, res) => {
  try {
    const { address } = req.query;

    if (!address || typeof address !== 'string' || !ethers.isAddress(address)) {
      return res.status(400).json({ error: 'Valid wallet address is required' });
    }

    const walletAddressLower = address.toLowerCase();

    // Generate a unique, random nonce
    const nonce = crypto.randomBytes(16).toString('hex');
    const message = `Sign this message to authenticate with Predict: ${nonce}`; // Message for the user to sign

    // Store the nonce in the database, linked to the wallet address.
    // Use upsert to handle cases where a user might request multiple nonces.
    // supabaseAdmin is used here to ensure the write happens regardless of RLS on auth_nonces.
    const { error } = await supabaseAdmin
      .from('auth_nonces')
      .upsert({
        wallet_address: walletAddressLower, // Store wallet address in lowercase
        nonce: nonce, // Store the generated nonce
        message: message, // Store the full message signed by the user
        created_at: new Date().toISOString() // Record creation time
      }, {
        onConflict: 'wallet_address', // Update the existing nonce if wallet_address conflicts
        ignoreDuplicates: false // Do not ignore, update on conflict
      });

    if (error) {
      console.error('Auth Controller: Nonce storage error:', error);
      // Log specific database error details if helpful for debugging
      // console.error('Supabase error details:', error.details, error.hint, error.code);
      return res.status(500).json({ error: 'Failed to generate and store nonce.' });
    }

    console.log(`Auth Controller: Nonce generated and stored for ${walletAddressLower}`);
    // Return the message and nonce to the frontend for the user to sign.
    res.status(200).json({ message, nonce });
  } catch (error) {
    console.error('Auth Controller: getNonce error:', error);
    res.status(500).json({ error: error.message || 'Server error during nonce generation.' });
  }
};

/**
 * Verify signature, authenticate user, and issue JWT
 * POST /api/auth/verify
 * Body: { signature, message, address }
 */
const verifyAuth = async (req, res) => {
  try {
    const { signature, message, address } = req.body;

    if (!signature || !message || !address) {
      return res.status(400).json({ error: 'Missing authentication parameters: signature, message, and address are required.' });
    }

    const walletAddressLower = address.toLowerCase();

    // 1. Verify the signature using ethers.js
    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
      if (recoveredAddress.toLowerCase() !== walletAddressLower) {
        console.warn(`Auth Controller: Signature verification failed. Provided address: ${walletAddressLower}, Recovered address: ${recoveredAddress.toLowerCase()}`);
        return res.status(401).json({ error: 'Invalid signature: Recovered address does not match provided address.' });
      }
       console.log(`Auth Controller: Signature verified successfully for ${walletAddressLower}`);
    } catch (error) {
      console.error('Auth Controller: Ethers signature verification error:', error);
      return res.status(401).json({ error: `Invalid signature: ${error.message || 'Verification failed.'}` });
    }

    // 2. Get the stored nonce for this wallet address using the supabaseAdmin client.
    // This prevents using the same nonce multiple times.
    const { data: nonceData, error: nonceError } = await supabaseAdmin
      .from('auth_nonces')
      .select('nonce, message') // Select the stored nonce and message
      .eq('wallet_address', walletAddressLower) // Filter by wallet address
      .single(); // Expecting a single result

    if (nonceError || !nonceData) {
       // If no nonce is found, it means the user didn't request one,
       // it was already used and cleared, or the wallet address is incorrect.
        console.warn('Auth Controller: Stored nonce not found or database error for wallet:', walletAddressLower, nonceError);
      return res.status(401).json({ error: 'Invalid authentication attempt. Please request a new signature message.' });
    }

    // 3. Verify that the message signed by the user matches the stored message (including the nonce).
    if (message !== nonceData.message) {
       console.warn(`Auth Controller: Message mismatch for ${walletAddressLower}. Provided: "${message}", Stored: "${nonceData.message}"`);
      return res.status(401).json({ error: 'Invalid message or nonce. Please request a new signature message.' });
    }
     console.log(`Auth Controller: Stored message verified for ${walletAddressLower}`);


    // At this point, the wallet signature is verified and matches the stored nonce and message.
    // This confirms the user controls the wallet associated with the nonce.

    // 4. Check if a user with this wallet address exists in your 'users' profile table.
    // Use supabaseAdmin here to find the user profile by wallet address,
    // regardless of RLS on the users table.
    const { data: userData, error: userLookupError } = await supabaseAdmin
      .from('users')
      .select('id, wallet_address, username, profile_image_url') // Select necessary profile fields
      .eq('wallet_address', walletAddressLower) // Find user by wallet address
      .single(); // Expecting a single user record

    let userProfile;

    // PGRST116 is the code for "no rows found" in PostgREST (used by Supabase)
    if (userLookupError && userLookupError.code !== 'PGRST116') {
      console.error('Auth Controller: User lookup error:', userLookupError);
      return res.status(500).json({ error: 'Server error during user lookup.' });
    }

    if (!userData) {
      // 5. If user profile doesn't exist, create a new one.
      // Create a new user profile record in the 'users' table using supabaseAdmin.
      // This newly created user's 'id' will ideally become their Supabase Auth UID
      // if you integrate this flow with Supabase Auth's admin user creation later.
      // For now, we use this 'id' as the JWT 'sub' claim.
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          wallet_address: walletAddressLower, // Store wallet address
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          username: `user_${walletAddressLower.substring(2, 6)}` // Generate a default username
           // Add other default fields as needed based on your schema (bio, token_balance etc. can be null)
        })
        .select('id, wallet_address, username, profile_image_url') // Select newly created user info
        .single(); // Expecting a single result

      if (createError) {
        console.error('Auth Controller: Failed to create new user profile:', createError);
         // Handle specific errors during profile creation (e.g., unique constraint violation on wallet_address if somehow not caught by lookup)
        return res.status(500).json({ error: 'Failed to create user profile.' });
      }

      userProfile = newUser;
       console.log("Auth Controller: Created new user profile:", userProfile);

    } else {
      // User profile already exists.
      userProfile = userData;
       console.log("Auth Controller: User profile found:", userProfile);
    }

    // At this point, we have a verified wallet signature and a user profile (created or found).

    // 6. Generate a JWT for this user.
    // The 'sub' claim in the JWT should be the user's identifier that your RLS policies expect as auth.uid().
    // Assuming 'userProfile.id' from your 'users' table is used as auth.uid().
     const payload = {
         sub: userProfile.id, // Use the user profile ID as the subject of the JWT (auth.uid())
         wallet_address: userProfile.wallet_address // Include wallet address in JWT payload for convenience/RLS
         // Add other necessary claims from the userProfile if your RLS or frontend requires them
     };

     // Generate the JWT using the JWT_SECRET from environment variables.
    const token = jwt.sign(
      payload,
      JWT_SECRET, // Use your JWT_SECRET environment variable
      { expiresIn: '7d' } // Set token expiry (e.g., 7 days)
    );

    // 7. Clear the used nonce from the database to prevent replay attacks.
    // Use supabaseAdmin for reliable deletion regardless of RLS on auth_nonces.
    const { error: deleteNonceError } = await supabaseAdmin
      .from('auth_nonces')
      .delete()
      .eq('wallet_address', walletAddressLower); // Delete the specific nonce for this wallet

    if (deleteNonceError) {
        // Log the error, but don't necessarily return a 500, as the auth was successful.
        // Clearing the nonce is a cleanup step.
        console.error('Auth Controller: Failed to delete used nonce for wallet:', walletAddressLower, deleteNonceError);
        // You might want to monitor these errors.
    } else {
        console.log(`Auth Controller: Deleted used nonce for wallet: ${walletAddressLower}`);
    }


    // 8. Return the generated JWT and user information to the frontend.
    res.status(200).json({
      token: token, // Send the Custom JWT back to the frontend
      user: { // Send relevant user profile info back
        id: userProfile.id,
        walletAddress: userProfile.wallet_address,
        username: userProfile.username,
        profileImage: userProfile.profile_image_url
         // Add other profile fields you want the frontend to have immediately after login
      }
    });

  } catch (error) {
    console.error('Auth Controller: verifyAuth error:', error);
     // Handle unexpected server errors
    res.status(500).json({ error: error.message || 'Internal server error during authentication.' });
  }
};

// Export controller functions
module.exports = {
  getNonce,
  verifyAuth
};