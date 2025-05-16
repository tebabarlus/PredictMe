import React from 'react';

/**
 * Error message component to display error messages to the user
 * 
 * @param {Object} props - Component props
 * @param {string|Error} props.error - Error message or object
 * @param {string} props.className - Additional CSS classes
 * @param {Function} props.onRetry - Optional retry function
 */
const ErrorMessage = ({ error, className = '', onRetry }) => {
  if (!error) return null;
  
  // Format error message
  const errorMessage = typeof error === 'string' 
    ? error 
    : error.message || 'An unknown error occurred';
  
  return (
    <div className={`bg-red-500/20 text-red-300 p-3 rounded-md mb-4 ${className}`}>
      <div className="flex items-start">
        <div className="text-xl mr-2">
          <i className="fas fa-exclamation-circle"></i>
        </div>
        <div className="flex-1">
          <p className="font-medium">{errorMessage}</p>
          {onRetry && (
            <button 
              onClick={onRetry}
              className="text-xs underline mt-1 text-red-200 hover:text-white"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorMessage;
