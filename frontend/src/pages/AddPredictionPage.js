// frontend/src/pages/AddPredictionPage.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Assuming routing
import { useAuth } from '../context/AuthContext'; // Assuming AuthContext
import LoadingSpinner from '../components/common/LoadingSpinner'; // Assuming path
import ErrorMessage from '../components/common/ErrorMessage'; // Assuming path

// Import specific API functions needed
import { getEventById, createPrediction } from '../api'; // Corrected imports

function AddPredictionPage() {
  const { eventId: routeEventId } = useParams(); // Get eventId from URL params if applicable
  const navigate = useNavigate();
  const { user, walletAddress, isLoading: authLoading } = useAuth(); // Get user/wallet from AuthContext

  const [eventId, setEventId] = useState(routeEventId || ''); // State for event ID input or from route
  const [eventDetails, setEventDetails] = useState(null); // State for fetched event details
  const [predictionText, setPredictionText] = useState(''); // State for prediction text input
  const [predictedOutcome, setPredictedOutcome] = useState(''); // State for predicted outcome input
  const [isLoading, setIsLoading] = useState(false); // Loading state for fetching/submitting
  const [error, setError] = useState(null); // State for errors
  const [successMessage, setSuccessMessage] = useState(null); // State for success message

  console.log('AddPredictionPage: Component rendering.');

  // Effect to fetch event details if eventId is available (e.g., from route or input)
  useEffect(() => {
    const fetchEventDetails = async () => {
      if (!eventId) return; // Don't fetch if no event ID

      setIsLoading(true);
      setError(null);
      try {
        console.log('AddPredictionPage: Fetching event details for ID:', eventId);
        // Call the getEventById API function directly
        const details = await getEventById(eventId);
        console.log('AddPredictionPage: Event details fetched:', details);
        setEventDetails(details);
      } catch (err) {
        console.error('AddPredictionPage: Error fetching event details:', err);
        setError('Failed to load event details.');
        setEventDetails(null); // Clear details on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchEventDetails();
  }, [eventId]); // Dependency array: refetch if eventId changes


  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Basic validation
    if (!eventId || !predictionText || !predictedOutcome) {
      setError('Please fill in all required fields.');
      return;
    }

    // Ensure user is authenticated
    if (!user || !walletAddress) {
        setError('You must be logged in to submit a prediction.');
        // Optionally redirect to login or show auth modal
        return;
    }

    setIsLoading(true);
    try {
      console.log('AddPredictionPage: Submitting prediction...');
      // Call the createPrediction API function directly
      const newPrediction = await createPrediction({
        eventId: eventId,
        predictionText: predictionText.trim(),
        predictedOutcome: predictedOutcome.trim(),
        // txHash: '...' // Include txHash if you get it from a wallet transaction
      });
      console.log('AddPredictionPage: Prediction submitted successfully:', newPrediction);
      setSuccessMessage('Prediction submitted successfully!');
      // Optionally clear form or redirect
      setPredictionText('');
      setPredictedOutcome('');
      // navigate(`/events/${eventId}`); // Redirect to event details page

    } catch (err) {
      console.error('AddPredictionPage: Error submitting prediction:', err);
      setError(err.message || 'Failed to submit prediction.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state if AuthContext is still loading
  if (authLoading) {
      return <LoadingSpinner message="Checking authentication..." />;
  }

  // Redirect if user is not authenticated (if this page is protected)
  // This might be handled by the Route in App.js, but added here as a fallback
  if (!user) {
       console.log('AddPredictionPage: User not authenticated, redirecting.');
       // return <Navigate to="/" replace />; // App.js Route handles this
  }


  return (
    <div className="add-prediction-container"> {/* Add styling */}
      <h2>Add New Prediction</h2>

      {error && <ErrorMessage message={error} />}
      {successMessage && <div className="success-message">{successMessage}</div>} {/* Add styling */}

      <form onSubmit={handleSubmit}>
        {!routeEventId && ( // Only show event ID input if not provided via route params
          <div className="form-group"> {/* Add styling */}
            <label htmlFor="eventId">Event ID:</label>
            <input
              type="text"
              id="eventId"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
        )}

        {eventDetails && ( // Display event details if fetched
          <div className="event-details-preview"> {/* Add styling */}
            <h3>Event: {eventDetails.title}</h3>
            <p>{eventDetails.description}</p>
            <p>Date: {new Date(eventDetails.eventDate).toLocaleString()}</p>
             {/* Add other event details you want to show */}
          </div>
        )}

        <div className="form-group"> {/* Add styling */}
          <label htmlFor="predictionText">Your Prediction:</label>
          <textarea
            id="predictionText"
            value={predictionText}
            onChange={(e) => setPredictionText(e.target.value)}
            required
            disabled={isLoading}
          ></textarea>
        </div>

        <div className="form-group"> {/* Add styling */}
          <label htmlFor="predictedOutcome">Predicted Outcome:</label>
          <input
            type="text"
            id="predictedOutcome"
            value={predictedOutcome}
            onChange={(e) => setPredictedOutcome(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <button type="submit" disabled={isLoading || !user}>
          {isLoading ? 'Submitting...' : 'Submit Prediction'}
        </button>
      </form>
    </div>
  );
}

export default AddPredictionPage;
