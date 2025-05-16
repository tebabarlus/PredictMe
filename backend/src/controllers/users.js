// src/controllers/users.js
const { supabase, supabaseAdmin } = require('../utils/supabaseClient'); // Use both clients

/**
 * Get user profile by wallet address.
 * This route might be public or private depending on requirements.
 * If public, RLS on 'users' table must allow select access based on wallet_address.
 * If private and protected by verifyJWT, it's better to fetch by user ID from req.user.
 * Let's implement it to fetch by wallet address, assuming public read for profiles.
 * If you prefer private profiles, adjust the route and use req.user.id in the query.
 */
const getUserProfile = async (req, res) => {
  try {
    const { walletAddress } = req.params; // Get wallet address from route parameter

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address parameter is required' });
    }

    const walletAddressLower = walletAddress.toLowerCase();
    console.log(`User Controller: Fetching profile for wallet: ${walletAddressLower}`);

    // Fetch user profile from the 'users' table.
    // Use the standard client here if you want RLS applied (e.g., only allow reading public fields)
    // Or use supabaseAdmin if this backend route is fully trusted and bypasses RLS.
    // Assuming public read access to profiles via wallet address using standard client + RLS:
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        wallet_address,
        username,
        profile_image_url,
        bio,
        created_at,
        token_balance,      // Assuming these are public or RLS allows
        notification_count  // Assuming these are public or RLS allows
      `)
      .eq('wallet_address', walletAddressLower)
      .single(); // Expecting a single user

    if (userError || !userData) {
      console.error('User Controller: User profile fetch error:', userError);
      // If user not found (PGRST116), return 404. Otherwise, return 500.
       if (userError?.code === 'PGRST116') {
            return res.status(404).json({ error: 'User not found.' });
       }
      return res.status(500).json({ error: 'Failed to fetch user profile.' });
    }

    // Get user statistics (predictions count, friends count).
    // These queries are based on user.id from the fetched profile.
    // Use standard client and rely on RLS on 'predictions' and 'friends' tables.
    const [predictions, friends] = await Promise.all([
      supabase
        .from('predictions')
        .select('id', { count: 'exact' }) // Select count
        .eq('user_id', userData.id), // Filter predictions by user ID from profile
      supabase
        .from('friends')
        .select('id', { count: 'exact' }) // Select count
         // Filter friends where user ID from profile is either user_id or friend_id
         // RLS on 'friends' must allow count where auth.uid() is part of the relationship,
         // or allow public count for any user's relationships if this route is truly public.
        .or(`user_id.eq.${userData.id},friend_id.eq.${userData.id}`)
    ]);

    // Format response
    const userProfile = {
      id: userData.id,
      walletAddress: userData.wallet_address,
      username: userData.username || `user_${userData.wallet_address.substring(2, 6)}`, // Provide default username if null
      profileImage: userData.profile_image_url,
      bio: userData.bio,
      createdAt: userData.created_at,
      stats: {
         tokenBalance: userData.token_balance || 0,
         notificationCount: userData.notification_count || 0,
        totalPredictions: predictions.count || 0,
        totalFriends: friends.count || 0
      }
    };

    console.log("User Controller: User profile fetched successfully for wallet:", walletAddressLower);
    res.status(200).json(userProfile);

  } catch (error) {
    console.error('User Controller: getUserProfile error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

/**
 * Update user profile.
 * Requires authentication (protected by verifyJWT middleware).
 * Updates the profile for the authenticated user identified by req.user.id.
 */
const updateUserProfile = async (req, res) => {
  try {
    // Get the authenticated user's ID from the verifyJWT middleware (req.user.id).
    const userId = req.user?.id;
    const { username, profileImage, bio } = req.body; // Allow updating bio as well

     if (!userId) {
        // This should not happen if verifyJWT ran correctly, but good for safety.
         console.warn('User Controller: updateUserProfile called without userId in req.user.');
         return res.status(401).json({ error: 'Authenticated user ID missing.' });
     }
    console.log(`User Controller: Updating profile for user ID: ${userId}`);

    // Prepare update data, mapping frontend names to database column names.
    const updateData = {};
    if (username !== undefined) { // Allow setting username to null/empty string if desired
        if (username !== null && (username.length < 3 || username.length > 50)) {
            return res.status(400).json({ error: 'Username must be between 3-50 characters' });
        }
        updateData.username = username;
    }
    if (profileImage !== undefined) updateData.profile_image_url = profileImage;
    if (bio !== undefined) updateData.bio = bio;

    // Only proceed if there's data to update
    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No update data provided.' });
    }

     updateData.updated_at = new Date().toISOString(); // Update timestamp

    // Update the user profile in the database.
    // Use the standard client here, relying on RLS on 'users' allowing update where id = auth.uid().
    const { data: updatedUserData, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId) // Filter by the authenticated user's ID (auth.uid()) for the update condition.
      .select('id, wallet_address, username, profile_image_url, bio') // Select the updated fields you want to return
      .single(); // Expecting a single updated row.

    if (updateError) {
      console.error('User Controller: Profile update error for user ID:', userId, updateError);
       // Handle specific errors during update (e.g., RLS update violation, unique constraint violation)
        if (updateError.code === '23505') { // Unique violation (e.g., username already taken)
             return res.status(400).json({ error: 'Username already taken.' });
        }
      return res.status(500).json({ error: 'Failed to update profile.' });
    }

    // Return the updated profile data.
    console.log("User Controller: Profile updated successfully for user ID:", userId);
    res.status(200).json({
      id: updatedUserData.id,
      walletAddress: updatedUserData.wallet_address,
      username: updatedUserData.username,
      profileImage: updatedUserData.profile_image_url,
      bio: updatedUserData.bio
       // Include other updated fields as needed
    });
  } catch (error) {
    console.error('User Controller: updateUserProfile error:', error);
     // Handle unexpected server errors
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

/**
 * Get user's friends list.
 * Requires authentication (protected by verifyJWT middleware).
 * Fetches friends for the authenticated user identified by req.user.id.
 */
const getUserFriends = async (req, res) => {
  try {
    // Get the authenticated user's ID from the verifyJWT middleware (req.user.id).
    const userId = req.user?.id;

     if (!userId) {
        // This should not happen if verifyJWT ran correctly.
         console.warn('User Controller: getUserFriends called without userId in req.user.');
         return res.status(401).json({ error: 'Authenticated user ID missing.' });
     }

    console.log("User Controller: Fetching friends for authenticated user ID:", userId);

    // Fetch friendship records where the current user is either user_id or friend_id,
    // and join to the 'users' table to get details of the *other* user (the friend).
    // Use the standard client and rely on RLS policies on 'friends' and 'users'.
    // RLS on 'friends' should allow selecting rows where auth.uid() = user_id OR auth.uid() = friend_id.
    // RLS on 'users' should allow selecting user rows that are friends with the authenticated user.
    const { data: friendships, error: friendshipsError } = await supabase
      .from('friends')
      .select(`
        id,
        user_id, -- The ID of the user who initiated the friendship
        friend_id, -- The ID of the friend
        status, -- Status of the friendship (e.g., 'pending', 'accepted')
        created_at,
        updated_at,
        -- Join to get the details of the user who is NOT the current authenticated user in this friendship
        -- Use aliases for clarity. Supabase handles joining based on FKs or explicitly defined joins.
        friend_user:users!friends_friend_id_fkey ( -- Joined user data for the 'friend_id' side
           id,
           username,
           profile_image_url,
           wallet_address
        ),
         requester_user:users!friends_user_id_fkey ( -- Joined user data for the 'user_id' side
           id,
           username,
           profile_image_url,
           wallet_address
         )
      `)
      // Filter friendship records where the authenticated user's ID matches either user_id or friend_id.
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);


    if (friendshipsError) {
      console.error('User Controller: Get friends error:', friendshipsError);
       // Handle specific errors (e.g., RLS violation)
      return res.status(500).json({ error: 'Failed to fetch friends.' });
    }

    // Handle case where data might be null or empty if no friendships found.
    if (!friendships || friendships.length === 0) {
        console.log("User Controller: No friendships found for user ID:", userId);
        return res.status(200).json([]); // Return an empty array
    }

     console.log("User Controller: Friendships fetched:", friendships);

    // Map the fetched friendship data to the desired frontend structure.
    // Determine which user in the friendship row is the 'friend' from the current user's perspective.
    const formattedFriends = friendships.map(friendship => {
        // The friend's ID is the one that does NOT match the current user's ID (userId).
        const friendUserId = friendship.user_id === userId ? friendship.friend_id : friendship.user_id;

        // Find the details of the friend from the joined data using the correct alias based on friendUserId.
        const friendDetails = friendship.friend_user?.id === friendUserId ? friendship.friend_user : friendship.requester_user;

        // If friendDetails are not found (e.g., issue with join or RLS), log a warning and skip.
        if (!friendDetails) {
            console.warn(`User Controller: Details not found for friend user ID: ${friendUserId} in friendship ${friendship.id}. Check join or RLS.`);
             return null; // Skip this entry if friend details are missing
        }

        // Return the formatted friend data.
        return {
            id: friendship.id, // Friendship ID (PK of the friendship record)
            userId: friendship.user_id, // ID of the user who initiated the friendship
            friendId: friendDetails.id, // The friend's user ID (from joined data)
            walletAddress: friendDetails.wallet_address, // Friend's wallet address (from joined data)
            username: friendDetails.username, // Friend's username (from joined data)
            profileImage: friendDetails.profile_image_url, // Friend's profile image (from joined data)
            addedAt: friendship.created_at, // When the friendship was created
            status: friendship.status // Include friendship status ('pending', 'accepted', etc.)
        };
    }).filter(friendship => friendship !== null); // Filter out any entries where friend details could not be fetched.

    console.log(`User Controller: Returning ${formattedFriends.length} friends for user ID: ${userId}`);
    res.status(200).json(formattedFriends); // Return the list of friends.

  } catch (error) {
    console.error('User Controller: getUserFriends error:', error);
     // Handle unexpected server errors
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

/**
 * Add a friend.
 * Requires authentication (protected by verifyJWT middleware).
 * Adds a friend for the authenticated user identified by req.user.id.
 * Input: { friendWalletAddress: string }
 */
const addFriend = async (req, res) => {
   try {
     // Get the authenticated user's ID from the verifyJWT middleware (req.user.id).
     const userId = req.user?.id;
     const { friendWalletAddress } = req.body; // Get friend's wallet address from request body

      if (!userId) {
          // This should not happen if verifyJWT ran correctly.
           console.warn('User Controller: addFriend called without userId in req.user.');
          return res.status(401).json({ error: 'Authenticated user ID missing.' });
      }

     if (!friendWalletAddress || typeof friendWalletAddress !== 'string' || !ethers.isAddress(friendWalletAddress)) {
       return res.status(400).json({ error: 'Valid friend wallet address is required' });
     }

     const friendWalletAddressLower = friendWalletAddress.toLowerCase();
     console.log(`User Controller: User ${userId} attempting to add friend with wallet: ${friendWalletAddressLower}`);

     // Fetch the friend's user ID from the 'users' table using their wallet address.
     // Use the supabaseAdmin client here because you need to find a user
     // by wallet address, which might not be allowed by standard RLS for arbitrary wallets.
     const { data: friendUser, error: friendLookupError } = await supabaseAdmin
         .from('users')
         .select('id, wallet_address') // Select ID and wallet_address of the friend
         .eq('wallet_address', friendWalletAddressLower) // Find the friend by wallet address
         .single(); // Expecting a single result for the friend.

     if (friendLookupError || !friendUser) {
         console.error("User Controller: Error finding friend's user ID:", friendLookupError);
         // If friend wallet is not found (PGRST116), return 404.
          if (friendLookupError?.code === 'PGRST116') {
               return res.status(404).json({ error: `User with wallet address ${friendWalletAddress} not found.` });
          }
         return res.status(500).json({ error: 'Failed to find friend user.' }); // Re-throw other errors.
     }

      // Prevent adding self as a friend.
      if (userId === friendUser.id) {
          return res.status(400).json({ error: "Cannot add yourself as a friend." });
      }

      // Check if a friendship already exists (either direction).
      // Use the standard client here and rely on RLS on 'friends' if your RLS
      // allows checking existence of friendships involving the authenticated user.
      // Or use supabaseAdmin if you need to bypass RLS for this check.
      // Let's use standard client and assume RLS allows checking relationships involving auth.uid().
      const { data: existingFriendship, error: checkError } = await supabase
           .from('friends')
           .select('id, status')
           // Check both directions: (user_id=userId AND friend_id=friendUserId) OR (user_id=friendUserId AND friend_id=userId)
           .or(`and(user_id.eq.${userId},friend_id.eq.${friendUser.id}),and(user_id.eq.${friendUser.id},friend_id.eq.${userId})`)
           .single(); // Expecting at most one result

       if (existingFriendship) {
           if (existingFriendship.status === 'accepted') {
                return res.status(400).json({ error: 'You are already friends with this user.' });
           } else if (existingFriendship.status === 'pending') {
                // Check if the pending request is from the current user or the other user
                const isRequestFromCurrentUser = await supabase
                    .from('friends')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('friend_id', friendUser.id)
                    .eq('status', 'pending')
                    .single();

                if (isRequestFromCurrentUser) {
                     return res.status(400).json({ error: 'Friend request already sent to this user.' });
                } else {
                     return res.status(400).json({ error: 'This user has already sent you a friend request. Check your pending requests.' });
                }
           }
            // Handle other potential statuses if you add them
            return res.status(400).json({ error: 'A friendship relationship already exists with this user.' });
       }


     // Insert a new friendship record in the 'friends' table.
     // Use the standard client here, relying on RLS on 'friends' allowing insert where user_id = auth.uid().
     const { data: newFriendship, error: insertError } = await supabase
       .from('friends')
       .insert({
         user_id: userId, // The current authenticated user's ID initiates the friendship
         friend_id: friendUser.id, // The friend's user ID
         status: 'pending', // Assuming an initial 'pending' status for friend requests
         created_at: new Date().toISOString(),
         updated_at: new Date().toISOString()
       })
       .select('id, user_id, friend_id, status, created_at') // Select key fields of the newly inserted row
       .single(); // Expecting a single inserted row.

     if (insertError) {
       console.error('User Controller: Add friend error:', insertError);
        // Handle specific errors during insertion (e.g., unique constraint violation if not caught by check).
        if (insertError.code === '23505') { // Unique violation
             return res.status(400).json({ error: 'Friendship record already exists (duplicate). This should have been caught by the check, indicates logic issue or race condition.' });
        }
       return res.status(500).json({ error: 'Failed to send friend request.' }); // Re-throw other errors.
     }

     console.log("User Controller: Friend request sent successfully from user ID:", userId, " to friend user ID:", friendUser.id);
     // Return the newly created friendship record (or a success message).
     res.status(201).json({
        message: 'Friend request sent successfully.',
        friendship: newFriendship // Optionally return the new friendship record
     });

   } catch (error) {
     console.error('User Controller: addFriend error:', error);
      // Handle unexpected server errors
     res.status(500).json({ error: error.message || 'Server error' });
   }
};

/**
 * Remove a friend or decline a friend request.
 * Requires authentication (protected by verifyJWT middleware).
 * Removes the friendship record identified by `friendshipId`
 * ensuring the authenticated user is part of that friendship.
 * URL: /api/users/friends/:friendshipId
 */
const removeFriend = async (req, res) => {
    try {
        // Get the authenticated user's ID from the verifyJWT middleware (req.user.id).
        const userId = req.user?.id;
        const { friendshipId } = req.params; // Get the friendship ID from request parameters.

        if (!userId) {
            console.warn('User Controller: removeFriend called without userId in req.user.');
            return res.status(401).json({ error: 'Authenticated user ID missing.' });
        }

        if (!friendshipId) {
             return res.status(400).json({ error: 'Friendship ID parameter is required.' });
        }

        console.log(`User Controller: User ${userId} attempting to remove friendship ID: ${friendshipId}`);

        // Remove the friendship record.
        // Use the standard client and rely on RLS on 'friends' allowing delete
        // where auth.uid() = user_id OR auth.uid() = friend_id AND id = friendshipId.
        const { error: deleteError } = await supabase
            .from('friends')
            .delete()
            .eq('id', friendshipId) // Filter by friendship ID
            // Ensure the authenticated user is part of this friendship record (either user_id or friend_id)
            .or(`user_id.eq.${userId},friend_id.eq.${userId}`);


        if (deleteError) {
            console.error('User Controller: Friend remove error:', deleteError);
            // Handle specific errors (e.g., if friendship ID not found or RLS prevents deletion)
             if (deleteError.code === 'PGRST116') { // No rows found for deletion matching criteria
                  return res.status(404).json({ error: 'Friendship not found or you do not have permission to remove it.' });
             }
            return res.status(500).json({ error: 'Failed to remove friend.' });
        }

        console.log("User Controller: Friendship removed successfully for ID:", friendshipId, " by user ID:", userId);
        res.status(200).json({ message: 'Friendship removed successfully' }); // Return success message.

    } catch (error) {
        console.error('User Controller: removeFriend error:', error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
};


/**
 * Submit a support ticket.
 * Requires authentication (protected by verifyJWT middleware) if you want to link it to a user,
 * or public if anonymous tickets are allowed.
 * If authenticated, links the ticket to the user identified by req.user.id.
 * If not authenticated, only user_wallet is available from the body.
 * Input: { walletAddress: string, subject: string, message: string }
 */
const submitSupportTicket = async (req, res) => {
  try {
    // Get user ID from verifyJWT middleware if route is protected.
    // Note: If this route is public, req.user will be undefined.
    // We can get the wallet address from the authenticated user's payload OR from the request body.
    const userId = req.user?.id || null; // Get user ID if authenticated, otherwise null
    const authenticatedWallet = req.user?.walletAddress || null; // Get wallet from auth payload if authenticated

    const { walletAddress: bodyWalletAddress, subject, message } = req.body; // Get data from request body

    // Use the wallet address from the authenticated user if available, otherwise use the one from the body.
    const userWallet = authenticatedWallet || bodyWalletAddress;

    // Basic validation
    if (!userWallet || typeof userWallet !== 'string' || !ethers.isAddress(userWallet)) {
        return res.status(400).json({ error: 'Valid wallet address is required.' });
    }
    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
        return res.status(400).json({ error: 'Subject is required.' });
    }
     if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message is required.' });
    }

    const userWalletLower = userWallet.toLowerCase();
    console.log(`User Controller: Submitting support ticket for wallet: ${userWalletLower} (User ID: ${userId})`);

    // Insert a new support ticket record.
    // Use the supabaseAdmin client here, as inserting support tickets might
    // bypass RLS or involve linking to a user ID (which the standard client might restrict).
    // IMPORTANT: The schema has an FK on `user_id` which was noted as a potential conflict
    // if inserting with null `user_id`. If your DB enforces this, inserting with `user_id: null` will fail.
    // Ensure the `user_id` column in your `support_tickets` table is nullable if you allow unauthenticated tickets.
    const { data: newTicket, error: insertError } = await supabaseAdmin
      .from('support_tickets')
      .insert({
        user_id: userId, // Store authenticated user's ID (will be null if not authenticated)
        user_wallet: userWalletLower, // Store wallet address (from auth payload or body)
        subject: subject.trim(),
        message: message.trim(),
        status: 'open', // Initial status
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id, user_id, user_wallet, subject, status, created_at') // Select key fields of the newly inserted row
      .single(); // Expecting a single inserted row.

    if (insertError) {
      console.error('User Controller: Submit support ticket error:', insertError);
       // Handle specific insert errors (e.g., database constraints)
      return res.status(500).json({ error: 'Failed to submit support ticket.' });
    }

    console.log("User Controller: Support ticket submitted successfully:", newTicket.id, " by wallet:", userWalletLower);
    res.status(201).json({
        message: 'Support ticket submitted successfully.',
        ticket: newTicket // Optionally return key details of the new ticket
    });

  } catch (error) {
    console.error('User Controller: submitSupportTicket error:', error);
     // Handle unexpected server errors
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

/**
 * Update user settings.
 * Requires authentication (protected by verifyJWT middleware).
 * Updates settings for the authenticated user identified by req.user.id.
 * Input: { settings: Array<{ key: string, value: any }> }
 */
const updateUserSettings = async (req, res) => {
   try {
     // Get the authenticated user's ID from the verifyJWT middleware (req.user.id).
     const userId = req.user?.id;
     const { settings } = req.body; // Get settings data from request body (expecting an array of { key, value })

      if (!userId) {
           console.warn('User Controller: updateUserSettings called without userId in req.user.');
           return res.status(401).json({ error: 'Authenticated user ID missing.' });
      }
      console.log(`User Controller: User ${userId} attempting to update settings.`);

      if (!settings || !Array.isArray(settings)) {
          return res.status(400).json({ error: 'Settings data must be a valid array.' });
      }

     // Prepare settings data for upsert, linking each setting to the authenticated user's ID.
     const settingsData = settings.map(setting => {
         // Basic validation for setting structure
         if (typeof setting !== 'object' || setting === null || typeof setting.key !== 'string' || typeof setting.value === 'undefined') {
              console.warn("User Controller: Invalid setting format provided:", setting);
             return null; // Skip invalid setting formats
         }
         return {
             user_id: userId, // Link settings to the authenticated user's ID
             setting_key: setting.key, // Key for the setting (e.g., 'notifications_enabled')
             setting_value: setting.value // Value of the setting
         };
     }).filter(setting => setting !== null); // Filter out any invalid settings

     if (settingsData.length === 0 && settings.length > 0) {
          // If original settings array was not empty but formatted array is, indicates invalid format
           return res.status(400).json({ error: 'Invalid settings format provided in the array.' });
     }

     // Use upsert to insert or update settings based on user_id and setting_key.
     // Use the standard client here, relying on RLS on 'settings' allowing upsert
     // where auth.uid() = user_id.
     const { data: upsertedSettings, error: upsertError } = await supabase
       .from('settings')
       // Upsert on user_id and setting_key to update existing settings or insert new ones.
       .upsert(settingsData, { onConflict: ['user_id', 'setting_key'], ignoreDuplicates: false })
       .select('setting_key, setting_value'); // Select key and value of the upserted rows


     if (upsertError) {
       console.error('User Controller: Update settings error for user ID:', userId, upsertError);
        // Handle specific upsert errors (e.g., RLS upsert violation, data type issues)
       return res.status(500).json({ error: 'Failed to update settings.' });
     }

     console.log("User Controller: Settings updated successfully for user ID:", userId, upsertedSettings.length, "items.");

     // Return the upserted settings data in the desired format { [key]: value }.
     const formattedSettings = upsertedSettings.reduce((acc, setting) => {
       acc[setting.setting_key] = setting.setting_value;
       return acc;
     }, {});

     res.status(200).json(formattedSettings); // Return the updated settings object.

   } catch (error) {
     console.error('User Controller: updateUserSettings error:', error);
     res.status(500).json({ error: error.message || 'Server error' });
   }
};

/**
 * Get user settings.
 * Requires authentication (protected by verifyJWT middleware).
 * Gets settings for the authenticated user identified by req.user.id.
 */
const getUserSettings = async (req, res) => {
   try {
     // Get the authenticated user's ID from the verifyJWT middleware (req.user.id).
     const userId = req.user?.id;

      if (!userId) {
           console.warn('User Controller: getUserSettings called without userId in req.user.');
           return res.status(401).json({ error: 'Authenticated user ID missing.' });
      }

      console.log("User Controller: Fetching settings for authenticated user ID:", userId);

     // Fetch settings linked to the authenticated user's ID.
     // Use the standard client here, relying on RLS on 'settings' allowing select where user_id = auth.uid().
     const { data: userSettings, error: selectError } = await supabase
       .from('settings')
       .select('setting_key, setting_value') // Select key and value
       .eq('user_id', userId); // Filter by the authenticated user's ID (auth.uid())


     if (selectError) {
       console.error('User Controller: Get settings error for user ID:', userId, selectError);
        // Handle specific select errors (e.g., RLS select violation)
       return res.status(500).json({ error: 'Failed to fetch settings.' });
     }

     // Handle case where data might be null or empty if no settings found.
     if (!userSettings || userSettings.length === 0) {
         console.log("User Controller: No settings found for user ID:", userId);
         return res.status(200).json({}); // Return an empty object if no settings
     }

     // Transform the array of settings objects into a single object { [key]: value }.
     console.log("User Controller: Settings fetched successfully for user ID:", userId, userSettings.length, "items.");
     const formattedSettings = userSettings.reduce((acc, setting) => {
       acc[setting.setting_key] = setting.setting_value;
       return acc;
     }, {});

     res.status(200).json(formattedSettings); // Return the settings object.

   } catch (error) {
     console.error('User Controller: getUserSettings error:', error);
     res.status(500).json({ error: error.message || 'Server error' });
   }
};


// Export controller functions
module.exports = {
  getUserProfile, // Note: This is by wallet address param, adjust if prefer authenticated profile by ID
  updateUserProfile,
  getUserFriends,
  addFriend,
  removeFriend,
  submitSupportTicket, // Note: Route will determine if this is protected or public
  updateUserSettings,
  getUserSettings
};