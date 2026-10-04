/**
 * Vercel Web Analytics Integration
 * Automatically tracks page views and events
 */
import { inject } from './node_modules/@vercel/analytics/dist/index.mjs';

// Initialize Vercel Analytics
inject({
  mode: 'auto', // Automatically detect development vs production
  debug: false  // Set to true for debugging in development
});
