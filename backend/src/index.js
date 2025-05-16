// backend/src/index.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config();

// Import routes - all core modules are included now
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const eventRoutes = require('./routes/events');
const predictionRoutes = require('./routes/predictions'); // This is the require call


console.log('Index File: predictionsRoutes imported:', typeof predictionRoutes, predictionRoutes); // <-- Add this line after the require


// Initialize express app
const app = express();
// Use port from env or default to 5000
const PORT = process.env.PORT || 5000;
// Set environment mode
const NODE_ENV = process.env.NODE_ENV || 'development';

// --- Apply Middleware ---
// Add security headers
app.use(helmet());
// HTTP request logging (dev format is good for development, combined for production)
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
// Enable CORS for all origins (you might want to restrict this in production)
app.use(cors());
// Parse JSON request bodies
app.use(express.json());
// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// --- Serve Static Files (Optional) ---
// If you decide to serve your frontend build from the backend in production,
// uncomment and adjust this. Otherwise, your frontend is served separately.
// Example: serving a React build located in ../../frontend/build
// app.use(express.static(path.join(__dirname, '../../frontend/build')));

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/predictions', predictionRoutes); // <-- COMMENT OUT THIS LINE 


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// --- Frontend Fallback (Optional) ---
// If serving a single-page application from the backend, this sends the
// index.html for any request not matching an API route.
// Make sure this is after all API routes.
/*
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/build/index.html'));
});
*/

// --- Error Handling Middleware ---
// This should be the last middleware
app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err.stack);

  // Set a default status code if none is provided in the error
  const statusCode = err.status || 500;

  // Do not leak detailed error information in production
  const errorMessage = NODE_ENV === 'production' && statusCode === 500
    ? 'Internal Server Error'
    : err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: {
      message: errorMessage,
      // Optionally include error details in development mode
      ...(NODE_ENV === 'development' && { details: err.message, stack: err.stack }),
    },
  });
});


// --- Start the server ---
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Health check available at /api/health`);
});

// Export the app for testing (optional)
module.exports = app;