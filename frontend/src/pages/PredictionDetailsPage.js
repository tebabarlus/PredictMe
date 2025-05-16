// frontend/src/pages/PredictionDetailsPage.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom'; // Assuming routing
import LoadingSpinner from '../components/common/LoadingSpinner'; // Assuming path
import ErrorMessage from '../components/common/ErrorMessage'; // Assuming path
import EventCard from '../components/events/EventCard'; // Assuming EventCard path (maybe for details view?)

// Import specific API function needed
import { getEventById } from '../api'; // Corrected import - getEventById includes predictions

function PredictionDetailsPage() {
  const { eventId } = useParams(); // Get eventId from URL params

  const [eventDetails, setEventDetails] = useState(null); // State for fetched event details
  const [isLoading, setIsLoading] = useState(true); // Loading state
  const [error, setError] = useState(null); // State for errors

  console.log('PredictionDetailsPage: Component rendering for event ID:', eventId);

  // Effect to fetch event details (including predictions)
  useEffect(() => {
    const fetchDetails = async () => {
      if (!eventId) {
          setError('Event ID is missing.');
          setIsLoading(false);
          return;
      }

      setIsLoading(true);
      setError(null);
      try {
        console.log('PredictionDetailsPage: Fetching event details and predictions for ID:', eventId);
        // Call the getEventById API function directly
        const details = await getEventById(eventId);
        console.log('PredictionDetailsPage: Details fetched:', details);
        setEventDetails(details);

      } catch (err) {
        console.error('PredictionDetailsPage: Error fetching details:', err);
        setError(err.message || 'Failed to load event details.');
        setEventDetails(null); // Clear details on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [eventId]); // Dependency array: refetch if eventId changes


  // Render logic
  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (!eventDetails) {
      return <ErrorMessage message="Event not found." />; // Handle case where eventId was provided but not found
  }

  return (
    <div className="event-details-page-container"> {/* Add styling */}
      {/* Display Event Details */}
      <h2>{eventDetails.title}</h2>
      <p>{eventDetails.description}</p>
      <p>Date: {eventDetails.eventDate ? new Date(eventDetails.eventDate).toLocaleString() : 'N/A'}</p>
      <p>Creator: {eventDetails.creatorUsername || eventDetails.creatorWallet}</p>
       {/* Add other event details */}

      {/* Display Predictions */}
      <h3>Predictions</h3>
      {eventDetails.predictions && eventDetails.predictions.length > 0 ? (
        <ul className="predictions-list"> {/* Add styling */}
          {eventDetails.predictions.map(prediction => (
            <li key={prediction.id} className="prediction-item"> {/* Add styling */}
              <p><strong>{prediction.username || prediction.userWallet}:</strong> {prediction.predictionText}</p>
              <p>Predicted Outcome: {prediction.predictedOutcome}</p>
               {/* Display other prediction details */}
            </li>
          ))}
        </ul>
      ) : (
        <p>No predictions yet for this event.</p>
      )}

       {/* Optional: Link to Add Prediction Page */}
       {/* <Link to={`/add?eventId=${eventId}`}>Add Your Prediction</Link> */}

    </div>
  );
}

export default PredictionDetailsPage;
