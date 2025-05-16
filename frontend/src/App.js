// C:\Users\kamal\Desktop\PredictMe\frontend\src\App.js
import React, { useEffect, useState } from 'react'; // Removed useContext as we'll use the custom hook
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom'; // Assuming you use React Router
// Import the custom hook useAuth and the AuthProvider component
import { AuthProvider, useAuth } from './context/AuthContext'; // Corrected import

import WalletConnectButton from './components/WalletConnectButton'; // Assuming WalletConnectButton path

// Import page components (adjust paths as needed based on your structure)
import EventsPage from './pages/EventsPage';
import EventDetailsPage from './pages/PredictionDetailsPage'; // Assuming this is event details
import AddPredictionPage from './pages/AddPredictionPage';
import ProfilePage from './pages/ProfilePage';
import SupportPage from './pages/SupportPage';
// Import other pages as needed (e.g., SettingsPage, FriendsPage)

// Import global styles (adjust path)
import './styles/global.css';


function App() {
  // --- Add these console logs here for debugging environment variables ---
  // These logs will run if the component successfully mounts after compilation
  console.log('App.js: --- Environment Variables ---');
  console.log('App.js: process.env:', process.env); // Log the entire process.env object
  console.log('App.js: REACT_APP_SUPABASE_URL:', process.env.REACT_APP_SUPABASE_URL);
  console.log('App.js: REACT_APP_SUPABASE_ANON_KEY:', process.env.REACT_APP_SUPABASE_ANON_KEY);
  console.log('App.js: REACT_APP_BACKEND_API_URL:', process.env.REACT_APP_BACKEND_API_URL);
  console.log('App.js: NODE_ENV:', process.env.NODE_ENV); // Check the environment mode
  console.log('App.js: --- End Environment Variables ---');
  // ---------------------------------------------------------------------


  // Use the custom useAuth hook to access context values
  const { user, isLoading, connectWallet, walletAddress } = useAuth(); // Corrected usage

  // Example handler for wallet connection (adjust based on your WalletConnectButton)
  const handleWalletConnected = async (address) => {
    console.log('App.js: Wallet connected event received:', address);
    // Call the connectWallet function from AuthContext to handle backend auth
    await connectWallet(address);
  };

  // Note: useEffect and useState were imported but not used in the previous version.
  // ESLint warned about this. You can remove them if they are truly not used in App.js,
  // or keep them if you plan to use them later. For now, I'll leave them but the ESLint
  // warnings will remain until they are used or removed.


  // Render loading state or main application based on auth status
  if (isLoading) {
    // You might render a loading spinner or splash screen here
    return <div>Loading...</div>;
  }

  return (
    // Wrap your application with AuthProvider to provide the context
    <AuthProvider> {/* Ensure AuthProvider is imported and used */}
      <Router>
        <div className="App"> {/* Add your main app container styles here */}
          {/* Example Header/Navigation (adjust as needed) */}
          <header className="App-header">
            <h1>Predict</h1>
            {/* Render WalletConnectButton */}
            <WalletConnectButton onWalletConnected={handleWalletConnected} />
            {/* Example Navigation Links (adjust based on your routes and auth state) */}
            <nav>
              <a href="/">Events</a>
              {user && <a href="/profile">Profile</a>} {/* Show profile link if user is logged in */}
              {/* Add other navigation links */}
            </nav>
          </header>

          {/* Main content area with Routes */}
          <main>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<EventsPage />} />
              <Route path="/events/:eventId" element={<EventDetailsPage />} />
              <Route path="/profile/:walletAddress" element={<ProfilePage />} /> {/* Public profile view */}
              <Route path="/support" element={<SupportPage />} />

              {/* Protected Routes (require authentication) */}
              {/* Example: Redirect to home if trying to access add prediction page without user */}
              <Route
                path="/add"
                element={user ? <AddPredictionPage /> : <Navigate to="/" replace />}
              />
               {/* Example: Authenticated user's own profile page (if different from public view) */}
               {/* You might use this route to show edit options etc. */}
               {/* <Route
                 path="/profile"
                 element={user ? <ProfilePage isAuthUser={true} /> : <Navigate to="/" replace />}
               /> */}
               {/* Add other protected routes */}

            </Routes>
          </main>

          {/* Example Footer (adjust as needed) */}
          <footer>
            <p>&copy; 2025 Predict</p>
          </footer>
        </div>
      </Router>
    </AuthProvider> // Close AuthProvider
  );
}

export default App;
