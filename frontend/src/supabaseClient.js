// C:\Users\kamal\Desktop\PredictMe\frontend\src\supabaseClient.js
// This file initializes the Supabase client for the frontend (browser)

import { createClient } from '@supabase/supabase-js';

// Get Supabase URL and Anon Key from frontend environment variables.
// These must be prefixed with REACT_APP_ in your .env file for Create React App
// (or craco) to expose them to the browser build.
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// --- Environment Variable Validation (Optional but Recommended) ---
// In development, log warnings if the necessary environment variables are missing.
// This helps catch configuration issues early.
if (process.env.NODE_ENV !== 'production') {
  if (!supabaseUrl) {
    console.error('Frontend Supabase: Missing REACT_APP_SUPABASE_URL environment variable in .env file.');
  }
  if (!supabaseAnonKey) {
    console.error('Frontend Supabase: Missing REACT_APP_SUPABASE_ANON_KEY environment variable in .env file.');
  }
}
// --- End Validation ---


// Create the Supabase client instance for the frontend (browser).
// This client uses the public Anon key and respects Row Level Security (RLS).
// It does NOT have admin privileges and should NEVER use the service_role key.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Configure authentication settings for the browser environment.
    // Session persistence is typically enabled on the frontend to keep the user logged in.
    // flowType 'pkce' is recommended for browser-based authentication flows.
     persistSession: true, // Keep session in browser storage (e.g., localStorage)
     autoRefreshToken: true, // Automatically refresh JWT tokens
     detectSessionInUrl: true, // Detect session information from URL (e.g., after OAuth redirect)
     flowType: 'pkce', // Proof Key for Code Exchange - a secure OAuth 2.0 flow
  },
  global: {
     // Optional: Add custom headers for all requests made by this client instance.
     // headers: { 'X-My-Frontend-App': 'Predict' }
  },
   db: {
       // Specify the database schema if you are not using the default 'public'.
       schema: 'public'
   }
});

console.log("Frontend Supabase client initialized.");

// Note: Frontend code uses ES Module syntax ('import', 'export'), not CommonJS ('require', 'module.exports').
