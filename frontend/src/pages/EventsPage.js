import React, { useState } from 'react';
import EventsList from '../components/events/EventsList';
import CategoryFilter from '../components/events/CategoryFilter';
import Search from '../components/common/Search';

/**
 * EventsPage component displays the main events listing page
 */
const EventsPage = () => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Handle category change
  const handleCategoryChange = (category) => {
    setActiveCategory(category);
  };
  
  // Handle search
  const handleSearch = (query) => {
    setSearchQuery(query);
  };
  
  return (
    <div className="container max-w-md w-full mx-auto px-4">
      {/* Search input */}
      <div className="relative mb-4">
        <Search 
          onSearch={handleSearch} 
          placeholder="Search predictions" 
        />
      </div>
      
      {/* Category filters */}
      <CategoryFilter 
        activeCategory={activeCategory} 
        onCategoryChange={handleCategoryChange} 
      />
      
      {/* Events listing */}
      <section className="mb-20">
        <EventsList 
          category={activeCategory} 
          search={searchQuery} 
        />
      </section>
    </div>
  );
};

export default EventsPage;
