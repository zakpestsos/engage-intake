// Configuration for the static frontend - BREAKTHROUGH CORS FIX DEPLOYMENT
// Repository: https://github.com/zakpestsos/engage-intake
// Version: 2025.01.11 - text/plain Content-Type implementation
window.APP_CONFIG = {
  // Your Apps Script Web App URL (BREAKTHROUGH: text/plain CORS bypass)
  API_BASE: 'https://script.google.com/macros/s/AKfycbzE-TwI_0mExwh3UCWezsb4l3_ZZlFsNeXkcMrqX3tEvLkvt3TBDReBny1zUW-tyq4/exec',
  
  // Your Google Maps API key (configured for GitHub Pages domain)
  PLACES_API_KEY: 'AIzaSyC9AzPi4MPa7IJr0wxfFsSSoSCMtYeSrVM',
  
  // Debug flag for cache busting - JSONP IMPLEMENTATION
  VERSION: '2025.01.11-jsonp-cors-bypass',
  
  // Force cache refresh timestamp
  CACHE_BUSTER: Date.now()
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
