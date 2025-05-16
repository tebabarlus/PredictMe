// frontend/src/pages/ProfilePage.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom'; // Assuming routing
import { useAuth } from '../context/AuthContext'; // Assuming AuthContext
import LoadingSpinner from '../components/common/LoadingSpinner'; // Assuming path
import ErrorMessage from '../components/common/ErrorMessage'; // Assuming path
import Card from '../components/common/Card'; // Assuming Card component

// Import specific API functions needed
import { getUserProfile, getUserPredictions } from '../api'; // Corrected imports

function ProfilePage() {
  const { walletAddress: routeWalletAddress } = useParams(); // Get wallet address from URL params
  const { user: authUser, walletAddress: authWalletAddress, isLoading: authLoading } = useAuth(); // Get authenticated user info

  // Determine the wallet address for the profile being viewed
  // If routeWalletAddress exists, view that profile (public).
  // If not, view the authenticated user's profile.
  const walletAddressToView = routeWalletAddress || authWalletAddress;

  const [profile, setProfile] = useState(null); // State for the profile being viewed
  const [predictions, setPredictions] = useState([]); // State for predictions of the profile being viewed
  const [isLoading, setIsLoading] = useState(true); // Loading state for fetching profile/predictions
  const [error, setError] = useState(null); // State for errors
  const [predictionStatusFilter, setPredictionStatusFilter] = useState('active'); // Filter for predictions

  console.log('ProfilePage: Component rendering.');
  console.log('ProfilePage: Wallet address from route:', routeWalletAddress);
  console.log('ProfilePage: Authenticated wallet address:', authWalletAddress);
  console.log('ProfilePage: Wallet address to view:', walletAddressToView);


  // Effect to fetch profile and predictions
  useEffect(() => {
    const fetchData = async () => {
      if (!walletAddressToView) {
        // This page requires a wallet address, either from route or authenticated user
        setError('Wallet address not provided.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        console.log('ProfilePage: Fetching data for wallet:', walletAddressToView);

        // Fetch user profile
        // Call the getUserProfile API function directly
        const userProfile = await getUserProfile(walletAddressToView);
        console.log('ProfilePage: Profile fetched:', userProfile);
        setProfile(userProfile);

        // Fetch user's predictions based on filter
        // Call the getUserPredictions API function directly
        const userPredictions = await getUserPredictions(walletAddressToView, predictionStatusFilter);
        console.log('ProfilePage: Predictions fetched:', userPredictions);
        setPredictions(userPredictions);

      } catch (err) {
        console.error('ProfilePage: Error fetching data:', err);
        setError(err.message || 'Failed to load profile data.');
        setProfile(null);
        setPredictions([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch if authLoading is false (meaning we know if user is authenticated or not)
    // and a wallet address to view is determined.
    if (!authLoading && walletAddressToView) {
        fetchData();
    }

  }, [walletAddressToView, predictionStatusFilter, authLoading]); // Dependencies: refetch if wallet or filter changes, or auth state resolves


  // Handle prediction status filter change
  const handleStatusFilterChange = (status) => {
    setPredictionStatusFilter(status);
  };


  // Show loading state if AuthContext is still loading or fetching data
  if (authLoading || isLoading) {
      return <LoadingSpinner message={authLoading ? "Checking authentication..." : "Loading profile..."} />;
  }

  // Handle case where no wallet address is available (e.g., not authenticated and no route param)
  if (!walletAddressToView) {
       return <ErrorMessage message="No wallet address available to display profile." />;
  }

  // Handle case where profile was not found
  if (!profile) {
       return <ErrorMessage message="User profile not found." />;
  }


  return (
    <div className="profile-page-container"> {/* Add styling */}
      <h2>Profile</h2>

      {error && <ErrorMessage message={error} />}

      {/* Profile Details Section */}
      <Card> {/* Use your Card component */}
        <div className="profile-details"> {/* Add styling */}
          <img src={profile.profileImage || 'placeholder-profile.png'} alt="Profile" className="profile-image" /> {/* Add styling */}
          <h3>{profile.username || profile.walletAddress}</h3> {/* Display username or wallet */}
          <p>Wallet: {profile.walletAddress}</p>
          {profile.bio && <p>Bio: {profile.bio}</p>}
          <p>Joined: {new Date(profile.createdAt).toLocaleDateString()}</p>
          {/* Display stats */}
          <div className="profile-stats"> {/* Add styling */}
            <span>Predictions: {profile.stats?.totalPredictions || 0}</span>
            <span>Friends: {profile.stats?.totalFriends || 0}</span>
            {/* Add other stats like token balance if desired */}
          </div>
           {/* Optional: Edit Profile button if viewing own profile */}
           {authUser && authUser.id === profile.id && (
                <button onClick={() => console.log('Edit Profile')}>Edit Profile</button> // Replace with actual edit logic/navigation
           )}
        </div>
      </Card>

      {/* Predictions Section */}
      <div className="profile-predictions"> {/* Add styling */}
        <h3>Predictions</h3>
        <div className="prediction-filters"> {/* Add styling */}
          <button onClick={() => handleStatusFilterChange('active')} className={predictionStatusFilter === 'active' ? 'active' : ''}>Active</button> {/* Add styling */}
          <button onClick={() => handleStatusFilterChange('completed')} className={predictionStatusFilter === 'completed' ? 'active' : ''}>Completed</button> {/* Add styling */}
           {/* Add other status filters */}
        </div>

        {predictions.length > 0 ? (
          <ul className="predictions-list"> {/* Add styling */}
            {predictions.map(prediction => (
              <li key={prediction.id} className="prediction-item"> {/* Add styling */}
                <p>Prediction: {prediction.predictionText}</p>
                <p>Predicted Outcome: {prediction.predictedOutcome}</p>
                 {/* Display event details related to the prediction */}
                {prediction.event && (
                    <p>Event: {prediction.event.title} (on {new Date(prediction.event.eventDate).toLocaleDateString()})</p>
                )}
                 {/* Add other prediction details */}
              </li>
            ))}
          </ul>
        ) : (
          <p>No predictions found for this user with the selected status.</p>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
