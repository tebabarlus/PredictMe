// frontend/src/pages/SupportPage.js
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext'; // Assuming AuthContext
import LoadingSpinner from '../components/common/LoadingSpinner'; // Assuming path
import ErrorMessage from '../components/common/ErrorMessage'; // Assuming path

// Import specific API function needed
import { submitSupportTicket } from '../api'; // Corrected import

function SupportPage() {
  const { user, walletAddress, isLoading: authLoading } = useAuth(); // Get user/wallet from AuthContext

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Loading state for submission
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  console.log('SupportPage: Component rendering.');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Basic validation
    if (!subject || !message) {
      setError('Subject and message are required.');
      return;
    }

    // Ensure wallet address is available (either authenticated or from input if public)
    // Since the backend route is protected, walletAddress comes from the authenticated user.
    if (!walletAddress) {
        setError('Wallet address is required to submit a support ticket.');
        // This case should ideally not happen if the user is authenticated and walletAddress is set in AuthContext
        return;
    }


    setIsLoading(true);
    try {
      console.log('SupportPage: Submitting support ticket...');
      // Call the submitSupportTicket API function directly
      const ticketResponse = await submitSupportTicket({
        walletAddress: walletAddress, // Pass the authenticated user's wallet address
        subject: subject.trim(),
        message: message.trim(),
      });
      console.log('SupportPage: Support ticket submitted successfully:', ticketResponse);
      setSuccessMessage('Your support ticket has been submitted successfully!');
      // Optionally clear form
      setSubject('');
      setMessage('');

    } catch (err) {
      console.error('SupportPage: Error submitting support ticket:', err);
      setError(err.message || 'Failed to submit support ticket.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state if AuthContext is still loading
  if (authLoading) {
      return <LoadingSpinner message="Checking authentication status..." />;
  }


  return (
    <div className="support-page-container"> {/* Add styling */}
      <h2>Support</h2>

      {error && <ErrorMessage message={error} />}
      {successMessage && <div className="success-message">{successMessage}</div>} {/* Add styling */}

      <p>If you have any questions or issues, please submit a support ticket below.</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group"> {/* Add styling */}
          <label htmlFor="subject">Subject:</label>
          <input
            type="text"
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group"> {/* Add styling */}
          <label htmlFor="message">Message:</label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            disabled={isLoading}
          ></textarea>
        </div>

        <button type="submit" disabled={isLoading || !walletAddress}> {/* Disable if loading or wallet not available */}
          {isLoading ? 'Submitting...' : 'Submit Ticket'}
        </button>
      </form>
    </div>
  );
}

export default SupportPage;
