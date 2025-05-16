import React from 'react';

/**
 * Badge component for displaying status or category
 * 
 * @param {Object} props - Component props
 * @param {string} props.text - Badge text
 * @param {string} props.type - Badge type (default, success, warning, danger, info)
 * @param {React.ReactNode} props.icon - Optional icon 
 * @param {string} props.className - Additional CSS classes
 */
const Badge = ({ text, type = 'default', icon, className = '' }) => {
  // Base classes for all badges
  const baseClasses = 'inline-flex items-center text-xs rounded-full px-2 py-1';
  
  // Type-specific classes
  const typeClasses = {
    default: 'bg-white/10 text-gray-400',
    success: 'bg-accent/20 text-accent',
    warning: 'bg-gradient-to-r from-orange-500 to-red-500 text-white',
    danger: 'bg-red-500/20 text-red-300',
    info: 'bg-blue-500/20 text-blue-300',
    hot: 'bg-gradient-to-r from-orange-500 to-red-500 text-white',
    new: 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white',
    ending: 'bg-black/60 text-white'
  };
  
  return (
    <span className={`${baseClasses} ${typeClasses[type]} ${className}`}>
      {icon && <span className="mr-1">{icon}</span>}
      {text}
    </span>
  );
};

export default Badge;
