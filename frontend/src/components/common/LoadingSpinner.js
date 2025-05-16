import React from 'react';

/**
 * Loading spinner component
 * 
 * @param {Object} props - Component props
 * @param {string} props.size - Size of the spinner (sm, md, lg)
 * @param {string} props.color - Color of the spinner
 * @param {string} props.className - Additional CSS classes
 */
const LoadingSpinner = ({ 
  size = 'md', 
  color = 'accent', 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-[2px]',
    md: 'w-6 h-6 border-[2px]',
    lg: 'w-10 h-10 border-[3px]'
  };
  
  const colorClasses = {
    accent: 'border-white/30 border-t-accent',
    white: 'border-black/20 border-t-white',
    dark: 'border-white/20 border-t-black'
  };
  
  return (
    <div 
      className={`inline-block rounded-full animate-spin ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
      aria-label="Loading"
    />
  );
};

export default LoadingSpinner;
