// frontend/src/components/events/EventsList.js
import React, { useState, useEffect, useCallback } from 'react';
import EventCard from './EventCard'; // Assuming path
import LoadingSpinner from '../common/LoadingSpinner'; // Assuming path
import ErrorMessage from '../common/ErrorMessage'; // Assuming path
import Search from '../common/Search'; // Assuming path
import CategoryFilter from './CategoryFilter'; // Assuming path

// Import specific API functions needed from the api client
import { getEvents } from '../../api'; // Corrected import: Import the function directly

// Assuming categories are defined elsewhere or fetched from backend
const eventCategories = ['Sports', 'Politics', 'Technology', 'Entertainment', 'Other'];

function EventsList() {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch events function, now using the imported getEvents API function
  // Wrap in useCallback to prevent unnecessary re-creation, add dependencies
  const fetchEvents = useCallback(async (page = 1, category = '', search = '') => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('EventsList: Fetching events with params:', { page, category, search });
      // Call the getEvents API function directly
      const response = await getEvents({ page, limit: 10, category, search }); // Assuming limit 10
      console.log('EventsList: Events fetched:', response); // Log the full response

      // Assuming the API response structure is { events: [...], pagination: {...} }
      if (response && Array.isArray(response.events) && response.pagination) {
          setEvents(response.events);
          setPagination(response.pagination);
          setCurrentPage(page);
      } else {
          console.error('EventsList: API response format unexpected:', response);
          setError('Unexpected response format from API.');
          setEvents([]);
          setPagination({});
      }


    } catch (err) {
      console.error('EventsList: Error fetching events:', err);
      // Improved error message handling
      setError(err.response?.data?.error?.message || err.message || 'Failed to load events.');
    } finally {
      setIsLoading(false);
    }
  }, []); // Dependencies for useCallback: None needed if it only uses parameters and state setters

  // Initial fetch and refetch on category/search/page change
  useEffect(() => {
    console.log('EventsList: useEffect triggered to fetch events.');
    // Fetch events when component mounts or filters/page change
    fetchEvents(currentPage, selectedCategory, searchTerm);
    // Dependencies: include fetchEvents (stable due to useCallback), currentPage, selectedCategory, searchTerm
  }, [fetchEvents, currentPage, selectedCategory, searchTerm]); // Added dependencies


  const handlePageChange = (page) => {
    if (page >= 1 && page <= pagination.pages) {
        setCurrentPage(page);
    }
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setCurrentPage(1); // Reset to first page on category change
  };

  const handleSearch = (search) => {
    setSearchTerm(search);
    setCurrentPage(1); // Reset to first page on search
  };

  // Render logic
  // Show loading spinner only on initial load or when changing page/filters
  if (isLoading && events.length === 0 && currentPage === 1) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  return (
    <div className="events-list-container"> {/* Add appropriate styling classes */}
      <h2>Upcoming Events</h2>
      <div className="filters"> {/* Add styling */}
        <Search onSearch={handleSearch} />
        <CategoryFilter categories={eventCategories} onSelectCategory={handleCategoryChange} />
      </div>
      {isLoading && events.length > 0 && <LoadingSpinner message="Loading more..." />} {/* Show spinner while loading more pages */}
      {events.length === 0 && !isLoading ? (
        <p>No events found matching your criteria.</p>
      ) : (
        <div className="event-cards-grid"> {/* Add styling */}
          {events.map(event => (
            // Pass event data to EventCard component
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
      {/* Pagination controls */}
      {pagination.pages > 1 && (
        <div className="pagination"> {/* Add styling */}
          <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || isLoading}>Previous</button>
          <span>Page {currentPage} of {pagination.pages}</span>
          <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === pagination.pages || isLoading}>Next</button>
        </div>
      )}
    </div>
  );
}

export default EventsList;
