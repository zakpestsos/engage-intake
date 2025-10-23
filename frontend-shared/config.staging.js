// Staging configuration - SAFE TO MODIFY
// This file is used by the development branch (staging environment)
window.APP_CONFIG = {
  // Staging Apps Script Web App URL - UPDATE THIS AFTER CREATING STAGING DEPLOYMENT
  // Instructions: Deploy → New Deployment → Web App → Copy URL here
  API_BASE: 'STAGING_DEPLOYMENT_URL_PLACEHOLDER',
  
  // Google Maps API key (same as production)
  PLACES_API_KEY: 'AIzaSyC9AzPi4MPa7IJr0wxfFsSSoSCMtYeSrVM',
  
  // Version identifier
  VERSION: '2025.01.23-STAGING-' + Date.now(),
  
  // Environment flag
  ENVIRONMENT: 'staging',
  
  // Cache busting for staging (aggressive to avoid caching during development)
  CACHE_BUSTER: 'STAGING_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
};

/* 
STAGING ENVIRONMENT
- Used by: Development branch for testing
- Backend: Staging Apps Script deployment (same project, different deployment)
- Data: Same spreadsheet, but use "Dev Company" token for testing
- Users: Developers only - NOT FOR PRODUCTION USE

SETUP INSTRUCTIONS:
1. Create new Apps Script deployment:
   - Open Apps Script project
   - Deploy → Manage Deployments → New Deployment
   - Type: Web app
   - Description: "Staging Environment"
   - Execute as: Me
   - Who has access: Anyone
   
2. Copy the staging deployment URL and replace 'STAGING_DEPLOYMENT_URL_PLACEHOLDER' above

3. Use Dev Company token for all testing (will be generated in spreadsheet)
*/

