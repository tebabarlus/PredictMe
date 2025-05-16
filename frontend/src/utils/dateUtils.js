/**
 * Utility functions for date formatting and manipulation
 */

/**
 * Format date for display
 * @param {string|Date} dateString - Date string or Date object
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date string
 */
export const formatDate = (dateString, options = {}) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }
  
  // Default formatting options
  const defaultOptions = {
    showTime: false,
    showRelative: false,
    shortFormat: false
  };
  
  const opts = { ...defaultOptions, ...options };
  
  // Show relative time (e.g., "2 hours ago")
  if (opts.showRelative) {
    return getRelativeTimeString(date);
  }
  
  // Format options
  const dateFormatOptions = {
    year: 'numeric',
    month: opts.shortFormat ? 'short' : 'long',
    day: 'numeric',
  };
  
  if (opts.showTime) {
    dateFormatOptions.hour = 'numeric';
    dateFormatOptions.minute = '2-digit';
  }
  
  return date.toLocaleDateString(undefined, dateFormatOptions);
};

/**
 * Get relative time string (e.g., "5 minutes ago", "2 days ago")
 * @param {Date} date - Date to compare
 * @returns {string} Relative time string
 */
export const getRelativeTimeString = (date) => {
  if (!date) return '';
  
  const now = new Date();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 60) {
    return diffSeconds < 5 ? 'just now' : `${diffSeconds} seconds ago`;
  }
  
  if (diffMinutes < 60) {
    return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  
  if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  }
  
  if (diffDays < 30) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  }
  
  const diffMonths = Math.floor(diffDays / 30);
  
  if (diffMonths < 12) {
    return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
  }
  
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`;
};

/**
 * Format timestamp as countdown (e.g., "2d 5h 30m left")
 * @param {string|Date} dateString - Target date string or Date object
 * @returns {string} Formatted countdown string
 */
export const formatCountdown = (dateString) => {
  if (!dateString) return '';
  
  const targetDate = new Date(dateString);
  
  if (isNaN(targetDate.getTime())) {
    return 'Invalid date';
  }
  
  const now = new Date();
  
  // If date is in the past
  if (targetDate < now) {
    return 'Ended';
  }
  
  const diffMs = targetDate - now;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  const remainingHours = diffHours % 24;
  const remainingMinutes = diffMinutes % 60;
  
  if (diffDays > 0) {
    return `${diffDays}d ${remainingHours}h left`;
  }
  
  if (diffHours > 0) {
    return `${diffHours}h ${remainingMinutes}m left`;
  }
  
  if (diffMinutes > 0) {
    return `${diffMinutes}m left`;
  }
  
  return 'Less than a minute left';
};
