import React from 'react';

/**
 * Reusable Card component used throughout the application
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Card content
 * @param {string} props.className - Additional CSS classes
 * @param {Function} props.onClick - Click handler
 * @param {boolean} props.hoverable - Whether card should have hover effects
 * @param {boolean} props.withPadding - Whether card should have padding
 */
const Card = ({ 
  children, 
  className = '', 
  onClick, 
  hoverable = true, 
  withPadding = true 
}) => {
  const baseClasses = 'bg-white/15 rounded-lg overflow-hidden';
  const hoverClasses = hoverable ? 'hover:bg-white/10 transition-colors' : '';
  const paddingClasses = withPadding ? 'p-4' : 'p-0';
  
  return (
    <div 
      className={`${baseClasses} ${hoverClasses} ${paddingClasses} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;
