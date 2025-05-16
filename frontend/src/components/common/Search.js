import React, { useState, useEffect } from 'react';

/**
 * Search component with debouncing
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onSearch - Search handler function
 * @param {string} props.placeholder - Placeholder text
 * @param {string} props.className - Additional CSS classes
 * @param {number} props.debounceMs - Debounce timeout in milliseconds
 */
const Search = ({ 
  onSearch, 
  placeholder = 'Search', 
  className = '',
  debounceMs = 300
}) => {
  const [searchValue, setSearchValue] = useState('');
  
  // Debounce search to avoid excessive API calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (onSearch) {
        onSearch(searchValue);
      }
    }, debounceMs);
    
    return () => clearTimeout(timeoutId);
  }, [searchValue, onSearch, debounceMs]);
  
  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        placeholder={placeholder}
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        className="form-input rounded-full px-4 py-2 pr-10 w-full"
        style={{ marginBottom: 0 }}
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
        <i className="fas fa-search"></i>
      </div>
    </div>
  );
};

export default Search;
