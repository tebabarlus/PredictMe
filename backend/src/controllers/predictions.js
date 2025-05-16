// src/controllers/predictions.js
const { supabase } = require('../utils/supabaseClient'); // Use standard client for RLS

/**
 * Get all predictions for a specific user.
 * GET /api/predictions/user/:walletAddress
 * Query Params: status (e.g., 'active', 'completed')
 * Access: Public (assuming predictions are publicly viewable per user)
 */
const getUserPredictions = async (req, res) => {
  try {
    const { walletAddress } = req.params; // User's wallet address from route parameter
    const { status } = req.query; // Optional status filter

    if (!walletAddress) {
         return res.status(400).json({ error: 'Wallet address parameter is required.' });
    }
     const walletAddressLower = walletAddress.toLowerCase();
     console.log(`Predictions Controller: Fetching predictions for user wallet: ${walletAddressLower} (status: ${status})`);

    // Build the Supabase query to get predictions for the user, joining with events.
    // Use standard client and rely on RLS on 'predictions' and 'events'.
    let query = supabase
      .from('predictions')
      .select(`
        id,
        user_wallet,
        event_id,
        prediction_text,
        predicted_outcome,
        tx_hash,
        created_at,
        -- Join with events table to get event details related to the prediction
        event:events!inner ( -- Alias for clarity, using the FK name (or inferred if not explicit)
          id,
          title,
          description, -- Include description
          event_date,
          creator_wallet,
          category -- Include category
        )
      `)
      .eq('user_wallet', walletAddressLower) // Filter by the user's wallet address
      .order('created_at', { ascending: false }); // Order by creation date descending

    // Apply status filter if provided
    // Note: This filter checks the event date relative to the current date.
    if (status === 'active') {
       // Filter for events whose date is in the future or today
      query = query.gte('event.event_date', new Date().toISOString());
       console.log('Predictions Controller: Applying active status filter.');
    } else if (status === 'completed') {
       // Filter for events whose date is in the past
      query = query.lt('event.event_date', new Date().toISOString());
       console.log('Predictions Controller: Applying completed status filter.');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Predictions Controller: Get user predictions error:', error);
      return res.status(500).json({ error: 'Failed to fetch user predictions.' });
    }

    // Format predictions data
    const formattedPredictions = data.map(prediction => ({
      id: prediction.id,
      userWallet: prediction.user_wallet,
      predictionText: prediction.prediction_text,
      predictedOutcome: prediction.predicted_outcome,
      txHash: prediction.tx_hash,
      createdAt: prediction.created_at,
      event: { // Format the nested event data
        id: prediction.event.id,
        title: prediction.event.title,
        description: prediction.event.description,
        eventDate: prediction.event.event_date,
        creatorWallet: prediction.event.creator_wallet,
        category: prediction.event.category // Include category
      }
    }));

    console.log(`Predictions Controller: Fetched ${formattedPredictions.length} predictions for user wallet: ${walletAddressLower}`);
    res.status(200).json(formattedPredictions); // Return the list of predictions

  } catch (error) {
    console.error('Predictions Controller: getUserPredictions error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

/**
 * Get all predictions for a specific event.
 * GET /api/predictions/event/:eventId
 * Access: Public (assuming predictions are publicly viewable per event)
 */
const getEventPredictions = async (req, res) => {
  try {
    const { eventId } = req.params; // Event ID from route parameter

     if (!eventId) {
         return res.status(400).json({ error: 'Event ID parameter is required.' });
     }
     console.log(`Predictions Controller: Fetching predictions for event ID: ${eventId}`);

    // Build the Supabase query to get predictions for the event, joining with users.
    // Use standard client and rely on RLS on 'predictions' and 'users'.
    const { data, error } = await supabase
      .from('predictions')
      .select(`
        id,
        user_wallet,
        prediction_text,
        predicted_outcome,
        tx_hash,
        created_at,
        -- Join with users table to get the predictor's username and profile image
        predictor_user:users!predictions_user_wallet_fkey ( -- Alias, assuming FK from predictions.user_wallet to users.wallet_address
           id,
           username,
           profile_image_url
        )
      `)
      .eq('event_id', eventId) // Filter predictions by the event ID
      .order('created_at', { ascending: false }); // Order by creation date descending

    if (error) {
      console.error('Predictions Controller: Get event predictions error:', error);
       // If event not found for any prediction, RLS might prevent select.
       // But assuming public read of predictions linked to a public event ID:
      return res.status(500).json({ error: 'Failed to fetch event predictions.' });
    }

    // Format predictions data
    const formattedPredictions = data.map(prediction => ({
      id: prediction.id,
      userWallet: prediction.user_wallet,
      username: prediction.predictor_user?.username, // Use alias, handle potential null
      userProfileImage: prediction.predictor_user?.profile_image_url, // Use alias, handle potential null
      predictionText: prediction.prediction_text,
      predictedOutcome: prediction.predicted_outcome,
      txHash: prediction.tx_hash,
      createdAt: prediction.created_at
    }));

    console.log(`Predictions Controller: Fetched ${formattedPredictions.length} predictions for event ID: ${eventId}`);
    res.status(200).json(formattedPredictions); // Return the list of predictions

  } catch (error) {
    console.error('Predictions Controller: getEventPredictions error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

/**
 * Create a new prediction.
 * Requires authentication (protected by verifyJWT middleware).
 * User wallet is derived from the authenticated user (req.user.walletAddress).
 * Input: { eventId: string, predictionText: string, predictedOutcome: string, txHash?: string }
 */
const createPrediction = async (req, res) => {
  try {
    // Get the authenticated user's wallet address from the verifyJWT middleware.
    const userWallet = req.user?.walletAddress;
    // Get prediction details from the request body
    const { eventId, predictionText, predictedOutcome, txHash } = req.body;

    if (!userWallet) {
         console.warn('Predictions Controller: createPrediction called without userWallet in req.user.');
         return res.status(401).json({ error: 'Authenticated user wallet missing.' });
    }

    // Basic validation
    if (!eventId || typeof eventId !== 'string') {
      return res.status(400).json({ error: 'Event ID is required' });
    }
    if (!predictionText || typeof predictionText !== 'string' || predictionText.trim().length === 0) {
      return res.status(400).json({ error: 'Prediction text is required' });
    }
    if (!predictedOutcome || typeof predictedOutcome !== 'string' || predictedOutcome.trim().length === 0) {
        // predictedOutcome could be a specific value, "yes", "no", etc.
      return res.status(400).json({ error: 'Predicted outcome is required' });
    }
     if (txHash && typeof txHash !== 'string') {
          return res.status(400).json({ error: 'Transaction hash must be a string.' });
     }


    console.log(`Predictions Controller: User ${userWallet} attempting to create prediction for event ID: ${eventId}`);

    // Optional: Check if the event exists and is still open for predictions.
    // Use standard client and rely on RLS on 'events' allowing select.
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('id, event_date') // Select ID and event_date
      .eq('id', eventId) // Find the event by ID
      .single(); // Expecting a single event

    if (eventError || !eventData) {
       console.error('Predictions Controller: Error checking event existence:', eventError);
       if (eventError?.code === 'PGRST116') { // No rows found
           return res.status(404).json({ error: 'Event not found.' });
       }
       return res.status(500).json({ error: 'Failed to check event details.' });
    }

    // Ensure event hasn't ended (predictions should typically be made before the event date)
    if (eventData.event_date && new Date(eventData.event_date) < new Date()) {
      return res.status(400).json({ error: 'This event has already ended. Predictions cannot be made.' });
    }

    // Create prediction in database.
    // Use standard client and rely on RLS on 'predictions' allowing insert
    // where user_wallet = auth.wallet().
    const { data: newPrediction, error: insertError } = await supabase
      .from('predictions')
      .insert({
        user_wallet: userWallet.toLowerCase(), // Store authenticated user's wallet
        event_id: eventId, // Store the event ID
        prediction_text: predictionText.trim(),
        predicted_outcome: predictedOutcome.trim(),
        tx_hash: txHash || null, // Store tx hash if provided
        created_at: new Date().toISOString()
         // updated_at is not in schema for predictions based on provided image, but often useful.
      })
      .select('id, user_wallet, event_id, prediction_text, predicted_outcome, tx_hash, created_at') // Select key fields
      .single(); // Expecting a single inserted row.

    if (insertError) {
      console.error('Predictions Controller: Prediction creation error:', insertError);
       // Handle specific insert errors (e.g., database constraints, RLS violation)
       // Example: If a user can only make one prediction per event, you might have a unique constraint on (user_wallet, event_id).
       if (insertError.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'You have already made a prediction for this event.' });
       }
      return res.status(500).json({ error: 'Failed to create prediction.' });
    }

    console.log("Predictions Controller: Prediction created successfully:", newPrediction.id, " by wallet:", userWallet, " for event:", eventId);
    res.status(201).json({
        message: 'Prediction created successfully.',
        prediction: newPrediction // Return the newly created prediction object
    });

  } catch (error) {
    console.error('Predictions Controller: createPrediction error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

// Export controller functions
module.exports = {
  getUserPredictions,
  getEventPredictions,
  createPrediction
};