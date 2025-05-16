// src/middleware/auth.js
// Use the standard supabase client here if you want to optionally
// fetch the user profile *after* verifying the JWT and rely on RLS
// on the 'users' table based on the JWT's auth.uid().
// If you use supabaseAdmin here, it bypasses RLS, which might not be
// what you want for checking if the user exists and is active *after* auth.
const { supabase } = require('../utils/supabaseClient'); // Use standard client
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers'); // Although not directly used in verifyJWT, might be needed for related tasks

// JWT secret for token verification (same as used in auth controller)
// Make sure this matches the JWT_SECRET in your .env file
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
     console.error('FATAL ERROR: JWT_SECRET is not defined for authentication middleware.');
     // This will likely cause JWT verification to fail.
}

/**
 * Middleware to verify JWT token and attach user to request
 * This middleware protects backend routes that require authentication.
 * It extracts the token from the Authorization header, verifies it,
 * and attaches the decoded user payload (id, walletAddress) to req.user.
 */
const verifyJWT = (req, res, next) => { // This is not async unless you fetch user profile from DB
  try {
    // Extract token from Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required: Authorization header missing.' });
    }
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required: Bearer token missing or malformed.' });
    }
    const token = authHeader.substring(7); // Get the token string after "Bearer "

    if (!JWT_SECRET) {
         console.error('Auth Middleware: JWT_SECRET is not available. Cannot verify token.');
         return res.status(500).json({ error: 'Server configuration error: Authentication not possible.' });
    }


    // Verify the token using the JWT secret
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        console.error('Auth Middleware: JWT verification failed:', err.message);
        // Handle specific JWT errors (e.g., expired, invalid signature)
        // You might want to return 403 Forbidden for invalid tokens, or 401 Unauthorized for expired.
        // 401 is common for auth failures.
        if (err.name === 'TokenExpiredError') {
             return res.status(401).json({ error: 'Authentication failed: Token expired.' });
        }
         // For other verification errors (invalid signature, etc.)
        return res.status(401).json({ error: `Authentication failed: Invalid token (${err.message}).` });
      }

      // Token is valid. The 'decoded' object contains the payload from the JWT.
      // The 'sub' claim should be the user's Supabase Auth UID / 'id' from your users table.
      console.log("Auth Middleware: JWT verified, decoded payload:", decoded);

      // Attach the decoded user information to the request object.
      // This info comes directly from the JWT payload.
      req.user = {
        id: decoded.sub, // User's ID (from 'sub' claim, which is userProfile.id)
        walletAddress: decoded.wallet_address // Wallet address from the JWT payload
         // You might add other claims from the JWT payload here if needed by controllers
      };

      // IMPORTANT: If you need to ensure the user profile still exists and is active
      // on *every* protected request, you would uncomment the database lookup here.
      // This adds a DB call to every protected request.
      // For most cases, relying on the JWT payload and RLS policies on the
      // tables (which use auth.uid() derived from the JWT's 'sub') is sufficient.
      /*
      async function fetchUserProfile(userId) {
          const { data: userProfile, error: userError } = await supabase
            .from('users')
            .select('id, wallet_address, username, profile_image_url') // Select minimal data or more if needed
            .eq('id', userId) // Use the user ID from the JWT (which should be auth.uid())
            .single();

          if (userError || !userProfile) {
            console.error('Auth Middleware: Error fetching user profile after JWT verification:', userError);
            // If user not found or inactive in DB, treat as unauthorized
            return res.status(401).json({ error: 'Authenticated user not found or inactive.' });
          }
          // If found, you can merge or replace req.user with more details from the DB if needed
          req.user = { ...req.user, ...userProfile }; // Merge DB data into req.user
          next(); // Proceed after async DB call
      }
      fetchUserProfile(req.user.id).catch(next); // Call async function and pass errors to next
      */

      // If not fetching from DB on every request, just proceed:
      next(); // Proceed to the next middleware or route handler.

    });
  } catch (error) {
    console.error('Auth Middleware: Top-level error:', error);
    // Catch any unexpected errors in the middleware itself
    return res.status(500).json({ error: 'Internal server error during authentication check.' });
  }
};


/**
 * Middleware to check if the user exists in the database by ID.
 * This middleware is typically used *after* verifyJWT to ensure the user
 * referenced by the JWT still has an active profile in the 'users' table.
 * It relies on RLS on the 'users' table allowing select where id = auth.uid().
 */
const checkUserExists = async (req, res, next) => {
  // This middleware requires req.user to be populated by verifyJWT first.
  const userId = req.user?.id;

  if (!userId) {
      // This should not happen if verifyJWT ran correctly before this middleware.
       console.warn('Auth Middleware: checkUserExists called without userId in req.user.');
       return res.status(401).json({ error: 'Authentication context missing for user check.' });
  }

   try {
       // Use the standard supabase client here so RLS is enforced.
       // This checks if a user *visible to the authenticated user (auth.uid())* exists with this ID.
       // If your 'users' RLS allows select where id = auth.uid(), this works correctly.
       const { data: userProfile, error } = await supabase
         .from('users')
         .select('id, wallet_address') // Select minimal data, or more if needed
         .eq('id', userId) // Filter by the user ID from the JWT (auth.uid())
         .single();

       if (error || !userProfile) {
           console.error('Auth Middleware: User existence check failed for ID:', userId, error);
           // If user not found (PGRST116) or other error, treat as unauthorized or not found.
           // Return 401 if the authenticated user ID does not correspond to a profile they can access via RLS.
           // Or 404 if the intent was specifically to check for existence for a public endpoint (less common here).
           return res.status(401).json({ error: 'Authenticated user profile not found or inaccessible.' });
       }

       // User profile exists. Optionally, attach more user data to req.user if needed by downstream handlers.
       // If you fetched full profile in verifyJWT, this middleware might be redundant.
       // If not, you might merge basic data here:
       // req.user = { ...req.user, ...userProfile }; // Add more data from DB if needed

       next(); // Proceed to the next middleware or route handler.

   } catch (error) {
       console.error('Auth Middleware: checkUserExists error:', error);
       return res.status(500).json({ error: 'Internal server error during user existence check.' });
   }
};


// Export middleware functions.
// Use verifyJWT to protect routes requiring a valid user session.
// checkUserExists can be used additionally *after* verifyJWT if you need
// to guarantee the user ID from the JWT corresponds to an existing user profile
// accessible via RLS on the 'users' table.
module.exports = {
  verifyJWT, // Use this for authentication protection
  checkUserExists // Use this *after* verifyJWT for user profile existence check
};