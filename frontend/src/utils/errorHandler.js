/**
 * Utility functions for handling API errors
 */

/**
 * Format error message from API or other sources
 * @param {Error|Object} error - The error object
 * @returns {string} Formatted error message
 */
export const formatErrorMessage = (error) => {
  if (!error) return 'An unknown error occurred';
  
  if (typeof error === 'string') return error;
  
  if (error.message) return error.message;
  
  if (error.error) return error.error;
  
  return 'An unknown error occurred';
};

/**
 * Handle API errors and provide standardized error display
 * @param {Error} error - The error object
 * @param {Function} setError - State setter for error message
 * @param {string} defaultMessage - Default error message
 */
export const handleApiError = (error, setError, defaultMessage = 'Something went wrong') => {
  console.error(error);
  const errorMessage = formatErrorMessage(error) || defaultMessage;
  setError(errorMessage);
  
  // Automatically clear error after 5 seconds
  setTimeout(() => {
    setError(null);
  }, 5000);
};

/**
 * Check if the error is a authentication error
 * @param {Error} error - The error object
 * @returns {boolean} True if it's an auth error
 */
export const isAuthError = (error) => {
  if (!error) return false;
  
  const errorMsg = formatErrorMessage(error).toLowerCase();
  return errorMsg.includes('auth') || 
         errorMsg.includes('unauthenticated') || 
         errorMsg.includes('unauthorized') ||
         errorMsg.includes('login') ||
         errorMsg.includes('permission');
};
