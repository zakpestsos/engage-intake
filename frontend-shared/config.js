// Configuration for the static frontend - BREAKTHROUGH CORS FIX DEPLOYMENT
// Repository: https://github.com/zakpestsos/engage-intake
// Version: 2025.01.11 - text/plain Content-Type implementation
window.APP_CONFIG = {
  // Your Apps Script Web App URL (Updated deployment - Version 68 - Oct 10, 2025)
  API_BASE: 'https://script.google.com/macros/s/AKfycby_lsZuGVzK2kvpMiEtzWzjvjqcCCP4DGzX4u31bWUXfErBzxFnGXqM1mygAZ-I-MZ3/exec',
  
  // Your Google Maps API key (configured for GitHub Pages domain)
  PLACES_API_KEY: 'AIzaSyC9AzPi4MPa7IJr0wxfFsSSoSCMtYeSrVM',
  
  // Debug flag for cache busting - NUCLEAR DATA PROTECTION
  VERSION: '2025.01.15-API-FIX-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
  
  // Force cache refresh timestamp - NUCLEAR CACHE BUST - UPDATED 2025-01-15
  CACHE_BUSTER: 'API_FIX_' + Date.now() + '_' + Math.random() + '_' + performance.now()
};

/* 
SETUP INSTRUCTIONS:
1. Deploy your Apps Script project as a Web App
2. Copy the deployment URL and paste it as API_BASE above
3. Upload these files to: https://github.com/zakpestsos/engage-intake
4. Enable GitHub Pages in repository settings
5. Access your forms at:
   - Intake: https://zakpestsos.github.io/engage-intake/frontend-intake/
   - Dashboard: https://zakpestsos.github.io/engage-intake/frontend-dashboard/
*/
