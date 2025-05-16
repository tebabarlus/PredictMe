// src/utils/supabaseClient.js
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables from .env file

// Ensure SUPABASE_URL is set
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) {
  console.error('FATAL ERROR: SUPABASE_URL is not defined in environment variables.');
  process.exit(1); // Exit the process if essential config is missing
}

// Use different keys for standard and service role clients
// The standard ANON key is for Row Level Security (RLS) enforced operations
// The SERVICE_KEY bypasses RLS and should only be used on the backend for trusted operations
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Requires your service_role key

// Create standard Supabase client (for RLS-enabled operations or public reads)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Create Supabase Admin client with service role (bypasses RLS - use carefully)
const supabaseAdmin = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        persistSession: false // Admin client typically doesn't need session persistence
      }
    })
  : null; // Or createClient(SUPABASE_URL, SUPABASE_ANON_KEY) if no service key is available/needed

// Check if admin key is available and warn if not, as some operations might require it
if (!supabaseAdmin) {
  console.warn('SUPABASE_SERVICE_KEY is not defined. Admin client is not available. Some backend operations requiring RLS bypass may fail.');
}

module.exports = {
  supabase, // Standard client (obeys RLS)
  supabaseAdmin // Admin client (bypasses RLS)
};