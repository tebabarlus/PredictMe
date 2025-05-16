// C:\Users\kamal\Desktop\PredictMe\frontend\src\api\index.js
import axios from 'axios'; // Assuming you use axios for API calls
import { supabase } from '../supabaseClient'; // Import frontend Supabase client (for session/token)

// Get backend API URL from frontend environment variables
const API_URL = process.env.REACT_APP_BACKEND_API_URL || 'http://localhost:5000/api'; // Default to local backend

console.log('Frontend API Client: Using API_URL:', API_URL);

// Create an Axios instance
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Optional: Add a request interceptor to include the JWT in headers
// This assumes you are using Supabase client's session management
// and want to automatically attach the JWT to all backend API calls.
apiClient.interceptors.request.use(async (config) => {
  try {
    // Get the current Supabase session
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('API Client: Error getting Supabase session for interceptor:', error);
      // Continue without token if session is missing/errored
    } else if (session && session.access_token) {
      // If a session and access token exist, add the Authorization header
      config.headers.Authorization = `Bearer ${session.access_token}`;
      // console.log('API Client: Attached JWT to request headers.');
    } else {
       // No active session, no token attached
       // console.log('API Client: No active session, no JWT attached.');
    }
  } catch (error) {
    console.error('API Client: Unexpected error in request interceptor:', error);
    // Continue with the request even if interceptor fails
  }
  return config; // Return the modified config
}, (error) => {
  // Handle request errors (e.g., network issues before sending)
  console.error('API Client: Request interceptor error:', error);
  return Promise.reject(error); // Reject the promise
});


// Optional: Add a response interceptor to handle errors (e.g., 401 Unauthorized)
apiClient.interceptors.response.use(
  (response) => {
    // Process successful responses
    return response;
  },
  async (error) => {
    // Handle response errors
    console.error('API Client: Response interceptor error:', error.response?.status, error.response?.data);

    // Example: If a 401 Unauthorized response is received, try refreshing the session
    // This is more complex and might require specific backend support for token refresh
    // or integration with Supabase's refresh logic.
    // For a simple JWT flow, a 401 might just mean the token is invalid/expired,
    // and the user needs to re-authenticate (e.g., sign out and prompt login).

    // If the error is a 401 and it's NOT the verifyAuth endpoint itself (to avoid loops)
    // and you have a refresh token flow:
    /*
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/verify') {
        originalRequest._retry = true; // Mark request as retried

        try {
             // Attempt to refresh the Supabase session using the client's refresh token
             const { data, error: refreshError } = await supabase.auth.refreshSession();

             if (refreshError) {
                 console.error('API Client: Error refreshing session:', refreshError);
                 // If refresh fails, the user is likely logged out.
                 // Trigger a sign out or redirect to login.
                 // You might need a global event or callback for this.
                 // Example: window.dispatchEvent(new Event('supabase-auth-logout'));
                 await supabase.auth.signOut(); // Force sign out via Supabase client
                 return Promise.reject(refreshError); // Reject with refresh error
             }

             // If refresh is successful, the new session/token is stored by the Supabase client.
             // Retry the original request with the new token (interceptor will add it).
             return apiClient(originalRequest); // Retry the original request

        } catch (refreshApiError) {
             console.error('API Client: Unexpected error during session refresh API call:', refreshApiError);
             // If the refresh API call itself fails
             await supabase.auth.signOut(); // Force sign out
             return Promise.reject(refreshApiError); // Reject with the API error
        }
    }
    */

    // For other errors or if refresh logic is not implemented/needed here,
    // propagate the error.
    return Promise.reject(error); // Reject the promise with the error
  }
);


// --- API Endpoint Functions ---

// Authentication Endpoints
export const signInWithWallet = async (walletAddress) => {
  console.log('API: Attempting Supabase sign-in with wallet:', walletAddress);
  try {
    // 1. Get nonce from backend
    const nonceResponse = await apiClient.get(`/auth/nonce?address=${walletAddress}`);
    const { message, nonce } = nonceResponse.data;
    console.log('API: Received nonce from backend.');

    // 2. User signs the message (this happens in the component/hook using this API)
    // The signature and message are then passed back to this API function or a related one.
    // Assuming the hook handles the signing and then calls a verify endpoint.
    // Let's adjust this function to take signature and message to complete the flow.

    // This function should ideally be split or renamed, or the signing happens outside.
    // Let's assume the calling code (AuthContext) gets the signature and calls a verify endpoint directly.

    // --- Revised Flow Assumption ---
    // AuthContext calls api.getNonce(walletAddress) -> gets message/nonce
    // AuthContext prompts user to sign message -> gets signature
    // AuthContext calls api.verifyAuth(walletAddress, signature, message) -> gets JWT/user

    // Let's implement the verifyAuth endpoint call here.
    // This function will now only get the nonce. A separate function will verify.
    return { message, nonce }; // Return message and nonce to the caller for signing

  } catch (error) {
    console.error('API: Error during getNonce:', error.response?.data || error.message);
    throw error; // Re-throw the error for the calling code to handle
  }
};

// New function to verify signature and get JWT
export const verifyAuth = async (walletAddress, signature, message) => {
    console.log('API: Attempting to verify signature with backend...');
     try {
         const response = await apiClient.post('/auth/verify', {
             address: walletAddress,
             signature: signature,
             message: message
         });
         console.log('API: Signature verification successful, received:', response.data);
         // Backend should return { token, user }
         return response.data; // Return backend response (JWT and user info)
     } catch (error) {
         console.error('API: Error during verifyAuth:', error.response?.data || error.message);
         throw error; // Re-throw the error
     }
};


// User Endpoints
export const getUserProfile = async (walletAddress) => {
    console.log('API: Getting user profile for wallet:', walletAddress);
    try {
        const response = await apiClient.get(`/users/${walletAddress}`);
        return response.data;
    } catch (error) {
        console.error('API: Get user profile error:', error.response?.data || error.message);
        throw error;
    }
};

// Add other user API calls (update profile, friends, settings, support)

// Events Endpoints
export const getEvents = async (params) => {
    console.log('API: Getting events with params:', params);
    try {
        const response = await apiClient.get('/events', { params });
        return response.data; // Should return { events: [], pagination: {} }
    } catch (error) {
        console.error('API: Get events error:', error.response?.data || error.message);
        throw error;
    }
};

export const getEventById = async (eventId) => {
    console.log('API: Getting event by ID:', eventId);
    try {
        const response = await apiClient.get(`/events/${eventId}`);
        return response.data; // Should return event details + predictions
    } catch (error) {
        console.error('API: Get event by ID error:', error.response?.data || error.message);
        throw error;
    }
};

export const createEvent = async (eventData) => {
    console.log('API: Creating event:', eventData);
    try {
        // JWT interceptor should add the token automatically
        const response = await apiClient.post('/events', eventData);
        return response.data; // Should return success message + new event object
    } catch (error) {
        console.error('API: Create event error:', error.response?.data || error.message);
        throw error;
    }
};

// Add other event API calls (update event)

// Predictions Endpoints
export const getUserPredictions = async (walletAddress, status) => {
     console.log('API: Getting user predictions for wallet:', walletAddress, 'status:', status);
     try {
          const response = await apiClient.get(`/predictions/user/${walletAddress}`, { params: { status } });
          return response.data; // Should return array of predictions
     } catch (error) {
          console.error('API: Get user predictions error:', error.response?.data || error.message);
          throw error;
     }
};

export const getEventPredictions = async (eventId) => {
     console.log('API: Getting event predictions for event ID:', eventId);
     try {
          const response = await apiClient.get(`/predictions/event/${eventId}`);
          return response.data; // Should return array of predictions
     } catch (error) {
          console.error('API: Get event predictions error:', error.response?.data || error.message);
          throw error;
     }
};

export const createPrediction = async (predictionData) => {
     console.log('API: Creating prediction:', predictionData);
     try {
          // JWT interceptor should add the token automatically
          const response = await apiClient.post('/predictions', predictionData);
          return response.data; // Should return success message + new prediction object
     } catch (error) {
          console.error('API: Create prediction error:', error.response?.data || error.message);
          throw error;
     }
};


// Export all API functions
export { apiClient }; // Export the configured axios instance if needed directly
