// src/controllers/events.js
const { supabase } = require('../utils/supabaseClient'); // Use standard client for RLS

/**
 * Get all events with pagination, filtering, and search.
 * GET /api/events
 * Query Params: page, limit, category, search
 * Access: Public (typically)
 */
const getEvents = async (req, res) => {
  try {
    // Get pagination, filtering, and search parameters from query string
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const { category, search } = req.query;
    const offset = (page - 1) * limit;

    console.log(`Events Controller: Fetching events - page: ${page}, limit: ${limit}, category: ${category}, search: ${search}`);

    // Build the Supabase query
    let query = supabase
      .from('events')
      .select(`
        id,
        event_id_onchain,
        title,
        description,
        event_date,
        creator_wallet,
        category, -- Include category
        created_at,
        -- Join with users table to get creator's username and profile image
        creator_user:users!events_creator_wallet_fkey ( -- Alias for clarity, using the FK name
          id,
          username,
          profile_image_url
        )
      `, { count: 'exact' }) // Request exact count of matching rows
      .order('created_at', { ascending: false }); // Order by creation date descending

    // Apply filters
    if (category) {
      // Ensure category exists in your database or is a valid value
      query = query.eq('category', category);
       console.log(`Events Controller: Applying category filter: ${category}`);
    }

    if (search) {
      // Apply text search on title or description (case-insensitive)
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
       console.log(`Events Controller: Applying search filter: "${search}"`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Events Controller: Events fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch events.' });
    }

    // Format events data
    const formattedEvents = data.map(event => ({
      id: event.id,
      eventIdOnchain: event.event_id_onchain,
      title: event.title,
      description: event.description,
      eventDate: event.event_date,
      creatorWallet: event.creator_wallet,
      category: event.category, // Include category in response
      creatorUsername: event.creator_user?.username, // Use alias, handle potential null if join fails
      creatorProfileImage: event.creator_user?.profile_image_url, // Use alias, handle potential null
      createdAt: event.created_at
    }));

    console.log(`Events Controller: Fetched ${formattedEvents.length} events (Total: ${count})`);
    res.status(200).json({
      events: formattedEvents,
      pagination: {
        total: count,
        page: page,
        limit: limit,
        pages: Math.ceil((count || 0) / limit) // Calculate total pages, handle count being null/0
      }
    });

  } catch (error) {
    console.error('Events Controller: getEvents error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

/**
 * Get a single event by ID, including its predictions.
 * GET /api/events/:eventId
 * Access: Public (typically, though predictions might have RLS)
 */
const getEventById = async (req, res) => {
  try {
    const { eventId } = req.params; // Get event ID from route parameter

    if (!eventId) {
         return res.status(400).json({ error: 'Event ID parameter is required.' });
    }
     console.log(`Events Controller: Fetching event by ID: ${eventId}`);


    // Fetch the event details. Use standard client and rely on RLS on 'events'.
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select(`
        id,
        event_id_onchain,
        title,
        description,
        event_date,
        creator_wallet,
        category, -- Include category
        created_at,
        -- Join with users table to get creator's username and profile image
        creator_user:users!events_creator_wallet_fkey ( -- Alias for clarity, using the FK name
           id,
           username,
           profile_image_url
        )
      `)
      .eq('id', eventId)
      .single(); // Expecting a single event

    if (eventError || !eventData) {
      console.error('Events Controller: Event fetch error:', eventError);
       if (eventError?.code === 'PGRST116') { // No rows found
            return res.status(404).json({ error: 'Event not found.' });
       }
      return res.status(500).json({ error: 'Failed to fetch event details.' });
    }

    // Get predictions for this event. Use standard client and rely on RLS on 'predictions' and 'users'.
    const { data: predictions, error: predictionsError } = await supabase
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
      .eq('event_id', eventId) // Filter predictions by this event's ID
      .order('created_at', { ascending: false }); // Order predictions by creation date

    if (predictionsError) {
      console.error('Events Controller: Predictions fetch error for event ID:', eventId, predictionsError);
      // Decide how to handle prediction fetch errors: return 500, or return the event without predictions?
      // Returning 500 is safer if predictions are considered essential for the event details page.
      return res.status(500).json({ error: 'Failed to fetch predictions for the event.' });
    }

    // Format predictions data
    const formattedPredictions = predictions.map(prediction => ({
      id: prediction.id,
      userWallet: prediction.user_wallet,
      username: prediction.predictor_user?.username, // Use alias, handle potential null
      userProfileImage: prediction.predictor_user?.profile_image_url, // Use alias, handle potential null
      predictionText: prediction.prediction_text,
      predictedOutcome: prediction.predicted_outcome,
      txHash: prediction.tx_hash,
      createdAt: prediction.created_at
    }));

    // Format the final response including event data and its predictions
    const eventDetails = {
      id: eventData.id,
      eventIdOnchain: eventData.event_id_onchain,
      title: eventData.title,
      description: eventData.description,
      eventDate: eventData.event_date,
      creatorWallet: eventData.creator_wallet,
      category: eventData.category, // Include category
      creatorUsername: eventData.creator_user?.username,
      creatorProfileImage: eventData.creator_user?.profile_image_url,
      createdAt: eventData.created_at,
      predictions: formattedPredictions // Include the formatted predictions
    };

    console.log("Events Controller: Event details and predictions fetched successfully for ID:", eventId);
    res.status(200).json(eventDetails);

  } catch (error) {
    console.error('Events Controller: getEventById error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

/**
 * Create a new event.
 * Requires authentication (protected by verifyJWT middleware).
 * Creator wallet is derived from the authenticated user (req.user.walletAddress).
 * Input: { title: string, description?: string, eventDate?: string, eventIdOnchain?: number, category?: string }
 */
const createEvent = async (req, res) => {
  try {
    // Get the authenticated user's wallet address from the verifyJWT middleware (req.user.walletAddress).
    const creatorWallet = req.user?.walletAddress;
    const { title, description, eventDate, eventIdOnchain, category } = req.body;

    if (!creatorWallet) {
         console.warn('Events Controller: createEvent called without creatorWallet in req.user.');
         return res.status(401).json({ error: 'Authenticated user wallet missing.' });
    }

    // Basic validation
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Event title is required' });
    }
     if (description && typeof description !== 'string') {
         return res.status(400).json({ error: 'Event description must be a string' });
     }
     if (eventDate) {
         // Basic date format validation (can be improved)
         if (isNaN(new Date(eventDate).getTime())) {
             return res.status(400).json({ error: 'Invalid event date format.' });
         }
          // Optional: Check if eventDate is in the future
          if (new Date(eventDate) < new Date()) {
               return res.status(400).json({ error: 'Event date must be in the future.' });
          }
     }
     if (eventIdOnchain && typeof eventIdOnchain !== 'number') {
          return res.status(400).json({ error: 'Onchain event ID must be a number.' });
     }
      if (category && typeof category !== 'string') {
           return res.status(400).json({ error: 'Category must be a string.' });
      }

    console.log(`Events Controller: Creating event for creator wallet: ${creatorWallet}`);

    // Create event in database. Use standard client and rely on RLS on 'events'
    // allowing insert where creator_wallet = auth.wallet().
    const { data: newEvent, error: insertError } = await supabase
      .from('events')
      .insert({
        title: title.trim(),
        description: description ? description.trim() : null,
        event_date: eventDate || null, // Allow null date if not specified
        event_id_onchain: eventIdOnchain || null, // Allow null if not specified
        category: category ? category.trim() : null, // Allow null if not specified
        creator_wallet: creatorWallet.toLowerCase(), // Store creator's wallet
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString() // Add updated_at timestamp
      })
      .select('id, title, description, event_date, event_id_onchain, category, creator_wallet, created_at, updated_at') // Select key fields of the new event
      .single(); // Expecting a single inserted row.

    if (insertError) {
      console.error('Events Controller: Event creation error:', insertError);
       // Handle specific insert errors (e.g., database constraints, RLS violation)
      return res.status(500).json({ error: 'Failed to create event.' });
    }

    console.log("Events Controller: Event created successfully:", newEvent.id, " by wallet:", creatorWallet);
    res.status(201).json({
        message: 'Event created successfully.',
        event: newEvent // Return the newly created event object
    });

  } catch (error) {
    console.error('Events Controller: createEvent error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

/**
 * Update an event.
 * Requires authentication (protected by verifyJWT middleware).
 * Only the event creator should be able to update it.
 * Input: { title?: string, description?: string, eventDate?: string, category?: string }
 * Note: eventIdOnchain and creator_wallet should probably not be updatable via this endpoint.
 */
const updateEvent = async (req, res) => {
  try {
    // Get the authenticated user's wallet address from the verifyJWT middleware.
    const creatorWallet = req.user?.walletAddress;
    const { eventId } = req.params; // Get event ID from route parameter
    const { title, description, eventDate, category } = req.body; // Fields to update

    if (!creatorWallet) {
         console.warn('Events Controller: updateEvent called without creatorWallet in req.user.');
         return res.status(401).json({ error: 'Authenticated user wallet missing.' });
    }
    if (!eventId) {
         return res.status(400).json({ error: 'Event ID parameter is required.' });
    }

    console.log(`Events Controller: User ${creatorWallet} attempting to update event ID: ${eventId}`);

    // Prepare update data
    const updateData = {};
    if (title !== undefined) {
        if (title !== null && (typeof title !== 'string' || title.trim().length === 0)) {
             return res.status(400).json({ error: 'Event title must be a non-empty string or null.' });
        }
        updateData.title = title ? title.trim() : null;
    }
     if (description !== undefined) {
          if (description !== null && typeof description !== 'string') {
              return res.status(400).json({ error: 'Event description must be a string or null.' });
          }
          updateData.description = description ? description.trim() : null;
     }
     if (eventDate !== undefined) {
         if (eventDate !== null) {
             if (isNaN(new Date(eventDate).getTime())) {
                 return res.status(400).json({ error: 'Invalid event date format.' });
             }
              // Optional: Check if updated eventDate is still in the future if it was required initially
              // if (new Date(eventDate) < new Date()) {
              //      return res.status(400).json({ error: 'Updated event date must be in the future.' });
              // }
         }
         updateData.event_date = eventDate || null;
     }
     if (category !== undefined) {
          if (category !== null && typeof category !== 'string') {
               return res.status(400).json({ error: 'Category must be a string or null.' });
          }
          updateData.category = category ? category.trim() : null;
     }


    // Only proceed if there's data to update
    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No valid update data provided.' });
    }

     updateData.updated_at = new Date().toISOString(); // Update timestamp

    // Update the event in the database.
    // Use standard client and rely on RLS on 'events' allowing update
    // where id = eventId AND creator_wallet = auth.wallet().
    const { data: updatedEventData, error: updateError } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', eventId) // Filter by the event ID
      .eq('creator_wallet', creatorWallet.toLowerCase()) // Ensure the authenticated user is the creator
      .select('id, title, description, event_date, event_id_onchain, category, creator_wallet, created_at, updated_at') // Select updated fields
      .single(); // Expecting a single updated row if successful

    if (updateError || !updatedEventData) {
        console.error('Events Controller: Event update error:', updateError);
        // PGRST116 means no rows were updated - could be event not found or user is not the creator (RLS blocked or EQ filter failed)
        if (updateError?.code === 'PGRST116') {
             // Check if event exists at all to provide more specific error
             const { data: existingEvent, error: checkExistError } = await supabase
                  .from('events')
                  .select('id')
                  .eq('id', eventId)
                  .single();

             if (checkExistError || !existingEvent) {
                 return res.status(404).json({ error: 'Event not found.' });
             } else {
                 // Event exists, but the user is not the creator or RLS prevented update.
                 return res.status(403).json({ error: 'Not authorized to update this event.' });
             }
        }
        // Handle other potential errors
        return res.status(500).json({ error: 'Failed to update event.' });
    }

    console.log("Events Controller: Event updated successfully:", eventId, " by wallet:", creatorWallet);
    res.status(200).json({
        message: 'Event updated successfully.',
        event: updatedEventData // Return the updated event object
    });

  } catch (error) {
    console.error('Events Controller: updateEvent error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};


// Export controller functions
module.exports = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent
};