// C:\Users\kamal\Desktop\PredictMe\frontend\src\context\AuthContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient'; // Import the frontend Supabase client
import * as api from '../api'; // Import your frontend API client (src/api/index.js)
import { ethers } from 'ethers'; // Assuming ethers is used for wallet interaction

// Create the Auth Context
const AuthContext = createContext(null);

// Custom hook to easily access the Auth Context
export function useAuth() {
  return useContext(AuthContext);
}

// Auth Provider component
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // Supabase Auth user object
  const [profile, setProfile] = useState(null); // User profile from your 'users' table
  const [walletAddress, setWalletAddress] = useState(null); // Connected wallet address
  const [isLoading, setIsLoading] = useState(true); // Loading state for initial auth check
  const [authError, setAuthError] = useState(null); // State for authentication errors

  console.log('AuthContext: Component rendering.');
  console.log('AuthContext: Current walletAddress state:', walletAddress);
  console.log('AuthContext: Current isLoading state:', isLoading);


  // --- Wallet Connection and Authentication Logic ---

  // Function to connect wallet and authenticate via backend
  const connectWallet = useCallback(async () => {
    console.log('AuthContext: Attempting to connect wallet and authenticate...');
    setAuthError(null); // Clear previous errors
    setIsLoading(true); // Set loading state

    try {
      // 1. Check for and connect to a wallet (e.g., MetaMask)
      if (!window.ethereum) {
        throw new Error("MetaMask or other Ethereum wallet not detected.");
      }

      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const connectedAddress = accounts[0]; // Get the first connected account

      if (!connectedAddress) {
        throw new Error("No Ethereum accounts available.");
      }

      console.log('AuthContext: Wallet connected:', connectedAddress);
      setWalletAddress(connectedAddress.toLowerCase()); // Store wallet address (lowercase)

      // 2. Authenticate with your backend using the wallet signature
      console.log('AuthContext: Authenticating with Supabase via backend...');

      // Call your frontend API client to handle the backend authentication flow
      // This involves getting a nonce, signing it, and sending signature/message to backend verify endpoint.
      const authResponse = await api.signInWithWallet(connectedAddress); // Assuming api.signInWithWallet exists

      // If authentication is successful, the backend returns a JWT and user info.
      // You might need to store this JWT in browser storage (e.g., localStorage)
      // and potentially set it as a default header for future API calls.
      // Supabase client can often manage the session if you pass the JWT to it.

      if (authResponse && authResponse.token && authResponse.user) {
          console.log('AuthContext: Backend authentication successful.');
          // Example: Store the JWT and user info.
          // You might integrate this with Supabase client's session management.
          // Supabase client's signInWithIdToken or setSession might be used here.

          // Example of using Supabase client to set session with the backend JWT:
          const { data, error: sessionError } = await supabase.auth.setSession({
              access_token: authResponse.token,
              refresh_token: authResponse.refreshToken || '' // Include refresh token if your backend provides one
          });

          if (sessionError) {
              console.error('AuthContext: Error setting Supabase session with backend JWT:', sessionError);
              setAuthError('Failed to establish Supabase session after backend auth.');
              setUser(null);
              setProfile(null);
          } else {
              console.log('AuthContext: Supabase session set successfully.');
              // Fetch the user profile from your 'users' table after successful auth
              await fetchUserProfile(data.session.user.id); // Fetch profile using Supabase Auth UID
          }

           // You might also store the user profile data returned by the backend directly
           // setProfile(authResponse.user);

      } else {
          // Handle cases where backend auth response is not as expected
          console.error('AuthContext: Backend authentication response missing token or user:', authResponse);
           throw new Error('Backend authentication failed.');
      }

    } catch (error) {
      console.error('AuthContext: Error connecting wallet and authenticating:', error);
      setAuthError(error.message || 'Failed to connect wallet or authenticate.');
      setUser(null); // Ensure user/profile are null on error
      setProfile(null);
      setWalletAddress(null); // Clear wallet address on auth failure
       // You might also clear the Supabase session here if it was partially set
       // await supabase.auth.signOut();
    } finally {
      setIsLoading(false); // End loading state
    }
  }, [/* Dependencies: include any state/props used inside useCallback if they change */]);


  // Function to fetch user profile from the 'users' table
  const fetchUserProfile = useCallback(async (userId) => {
       console.log('AuthContext: Attempting to fetch user profile for ID:', userId);
       try {
           // Use the frontend Supabase client to fetch the profile.
           // RLS on the 'users' table should allow select where id = auth.uid().
           const { data: userProfile, error } = await supabase
               .from('users')
               .select(`
                   id,
                   wallet_address,
                   username,
                   profile_image_url,
                   bio,
                   created_at,
                   token_balance,
                   notification_count
               `)
               .eq('id', userId) // Fetch profile by the Supabase Auth UID
               .single();

           if (error || !userProfile) {
               console.error('AuthContext: Error fetching user profile:', error);
               // If profile not found (PGRST116) or other error, clear user/profile
               if (error?.code === 'PGRST116') {
                    console.warn('AuthContext: User profile not found in DB for ID:', userId);
               }
               setProfile(null);
               // Optionally sign out the user if profile is missing after successful auth
               // await supabase.auth.signOut();
           } else {
               console.log('AuthContext: User profile fetched successfully:', userProfile);
               setProfile(userProfile);
           }
       } catch (error) {
            console.error('AuthContext: Unexpected error fetching user profile:', error);
            setProfile(null);
       }
  }, [/* Dependencies */]);


  // --- Initial Authentication Check (on app load) ---

  // Effect to check for an existing Supabase session on initial load
  useEffect(() => {
    console.log('AuthContext: Running initial auth check effect...');
    const checkSession = async () => {
      setIsLoading(true); // Start loading

      try {
        // Check for an existing session (e.g., from localStorage)
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('AuthContext: Error getting Supabase session:', error);
          setAuthError(error.message);
          setUser(null);
          setProfile(null);
        } else if (session) {
          console.log('AuthContext: Active Supabase session found:', session);
          setUser(session.user); // Set the Supabase Auth user
          setWalletAddress(session.user.user_metadata?.wallet_address || session.user.email); // Get wallet from metadata or email
          await fetchUserProfile(session.user.id); // Fetch profile using the user's ID
        } else {
          console.log('AuthContext: No active Supabase session found on initial load.');
          setUser(null);
          setProfile(null);
          // Optional: Check for a remembered wallet address in localStorage if not using Supabase session persistence
          // const rememberedWallet = localStorage.getItem('rememberedWallet');
          // if (rememberedWallet) {
          //     console.log('AuthContext: Remembered wallet found:', rememberedWallet);
          //     setWalletAddress(rememberedWallet);
          //     // You might attempt to re-authenticate here if needed, or just show the wallet address
          // } else {
               console.log('AuthContext: No remembered wallet found.');
               setWalletAddress(null);
          // }
        }
      } catch (error) {
        console.error('AuthContext: Unexpected error during initial auth check:', error);
        setAuthError(error.message || 'An error occurred during initial authentication.');
        setUser(null);
        setProfile(null);
        setWalletAddress(null);
      } finally {
        setIsLoading(false); // End loading
      }
    };

    checkSession();

    // Optional: Set up a listener for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
       console.log('AuthContext: Supabase auth event:', event, session);
       // Handle different auth events (e.g., update user state on login/logout)
       if (event === 'SIGNED_IN' && session) {
           console.log('AuthContext: Supabase SIGNED_IN event.');
           setUser(session.user);
           setWalletAddress(session.user.user_metadata?.wallet_address || session.user.email);
           fetchUserProfile(session.user.id); // Fetch profile on sign in
       } else if (event === 'SIGNED_OUT') {
           console.log('AuthContext: Supabase SIGNED_OUT event.');
           setUser(null);
           setProfile(null);
           setWalletAddress(null); // Clear wallet on sign out
       } else if (event === 'INITIAL_SESSION' && !session) {
           console.log('AuthContext: Supabase INITIAL_SESSION without user.');
           // This happens if no session is found on load. State is already null, no action needed.
       }
       // Handle other events like TOKEN_REFRESHED, USER_UPDATED if necessary
    });

    // Cleanup the subscription on component unmount
    return () => {
      subscription?.unsubscribe();
    };
  }, [fetchUserProfile]); // Dependency array: fetchUserProfile is a dependency


  // --- Context Value ---

  const contextValue = {
    user, // Supabase Auth user object
    profile, // User profile from your 'users' table
    walletAddress, // Connected wallet address
    isLoading, // Authentication loading state
    authError, // Authentication error state
    connectWallet, // Function to connect wallet and authenticate
    // Add other auth-related functions here (e.g., signOut, updateProfile)
    signOut: async () => {
        console.log('AuthContext: Attempting to sign out...');
        setAuthError(null);
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('AuthContext: Error signing out:', error);
                setAuthError(error.message);
            } else {
                 console.log('AuthContext: Signed out successfully.');
                 // State will be updated by the onAuthStateChange listener
            }
        } catch (error) {
             console.error('AuthContext: Unexpected error during sign out:', error);
             setAuthError(error.message || 'An error occurred during sign out.');
        } finally {
             setIsLoading(false);
        }
    },
    // Add other functions like updateProfile, addFriend, etc. that interact with backend API via api.js
  };

  // Provide the context value to child components
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Note: The component App.js should be wrapped with <AuthProvider>
// in your src/index.js or top-level component.
// Example in src/index.js:
/*
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext'; // Import AuthProvider

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider> // Wrap App with AuthProvider
      <App />
    </AuthProvider>
  </React.StrictMode>
);
*/
