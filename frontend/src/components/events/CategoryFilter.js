import React from 'react';

/**
 * CategoryFilter component displays horizontal scrollable category tabs
 * 
 * @param {Object} props - Component props
 * @param {string} props.activeCategory - Currently active category
 * @param {Function} props.onCategoryChange - Category change handler
 * @param {Array} props.categories - Available categories
 */
const CategoryFilter = ({ 
  activeCategory = 'all', 
  onCategoryChange,
  categories = [
    { id: 'all', name: 'Top' },
    { id: 'crypto', name: 'Crypto' },
    { id: 'sports', name: 'Sports' },
    { id: 'ortak', name: 'Ortak' },
    { id: 'event1', name: 'Event1' },
    { id: 'event2', name: 'Event2' },
    { id: 'event3', name: 'Event3' }
  ]
}) => {
  const handleCategoryClick = (categoryId) => {
    if (onCategoryChange) {
      onCategoryChange(categoryId);
    }
  };
  
  return (
    <nav className="nav-tabs space-x-2 overflow-x-auto pb-2 mb-4 scrollbar-hide" id="category-filter">
      {categories.map(category => (
        <button
          key={category.id}
          className={`whitespace-nowrap ${
            activeCategory === category.id 
              ? 'nav-tab-active' 
              : 'nav-tab'
          }`}
          onClick={() => handleCategoryClick(category.id)}
        >
          {category.name}
        </button>
      ))}
    </nav>
  );
};

export default CategoryFilter;
