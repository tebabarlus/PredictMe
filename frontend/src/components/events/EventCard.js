import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../common/Card';
import Badge from '../common/Badge';
import { formatCountdown } from '../../utils/dateUtils';

/**
 * EventCard component displays a prediction event card
 * 
 * @param {Object} props - Component props
 * @param {Object} props.event - Event data object
 */
const EventCard = ({ event }) => {
  if (!event) return null;
  
  // Format end time as countdown
  const timeLeft = formatCountdown(event.eventDate);
  
  // Determine if event is ending soon (less than 24 hours)
  const isEndingSoon = () => {
    const now = new Date();
    const eventDate = new Date(event.eventDate);
    const diffHours = (eventDate - now) / (1000 * 60 * 60);
    return diffHours < 24 && diffHours > 0;
  };

  return (
    <Card withPadding={false} hoverable={true}>
      <Link to={`/prediction/${event.id}`} className="block">
        <div className="relative">
          <img 
            src={event.imageUrl || 'https://via.placeholder.com/400x200?text=Prediction+Event'} 
            alt={event.title} 
            className="w-full h-48 object-cover"
          />
          
          {/* Status badges */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {isEndingSoon() && (
              <Badge 
                type="ending" 
                text="Ending soon" 
                icon={<i className="fas fa-hourglass-half mr-1"></i>}
              />
            )}
            
            {event.isHot && (
              <Badge 
                type="hot" 
                text="Hot" 
                icon={<i className="fas fa-fire mr-1"></i>}
              />
            )}
            
            {event.isNew && (
              <Badge 
                type="new" 
                text="New" 
                icon={<i className="fas fa-star mr-1"></i>}
              />
            )}
          </div>
        </div>
        
        <div className="p-4">
          <div className="flex justify-between items-center mt-2 text-sm font-semibold">
            <p className="flex-grow">
              {event.title}
            </p>
            <div className="flex items-center gap-1 text-gray-400">
              <i className="fas fa-users"></i>
              <span>{event.participantCount || 0}</span>
            </div>
          </div>
          
          <div className="flex gap-4 mt-1 text-xs font-semibold">
            {event.yesPercentage && (
              <>
                <span className="text-accent-dark">{event.yesPercentage}%</span>
                <span>Yes</span>
                <span><i className="fas fa-link"></i></span>
              </>
            )}
            
            {event.noPercentage && (
              <>
                <span className="text-purple">{event.noPercentage}%</span>
                <span>No</span>
                <span><i className="fas fa-link"></i></span>
              </>
            )}
            
            <span className="font-bold text-gray-400">
              <i className="fas fa-clock"></i> {timeLeft}
            </span>
          </div>
        </div>
      </Link>
    </Card>
  );
};

export default EventCard;
