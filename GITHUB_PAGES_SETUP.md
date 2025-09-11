# GitHub Pages Setup for Google Places Autocomplete

Since Google Places API doesn't work within Apps Script's HTMLService due to sandboxing restrictions, use this GitHub Pages version for full autocomplete functionality.

## Your Repository
🔗 **Repository**: https://github.com/zakpestsos/engage-intake

## Quick Setup

### 1. Upload Frontend Files ✅
Upload these folders to your GitHub repository:
- `frontend-intake/` 
- `frontend-dashboard/`
- `frontend-shared/`

### 2. Configure API Settings
Edit `frontend-shared/config.js`:
```javascript
window.APP_CONFIG = {
  // Your Apps Script Web App URL (get this after deploying)
  API_BASE: 'YOUR_WEB_APP_URL_HERE',
  
  // Your Google Maps API key (already configured)
  PLACES_API_KEY: 'AIzaSyC9AzPi4MPa7IJr0wxfFsSSoSCMtYeSrVM'
};
```

### 3. Enable GitHub Pages
1. Go to https://github.com/zakpestsos/engage-intake/settings/pages
2. Source: "Deploy from a branch"
3. Branch: `main` → `/ (root)`
4. Save

### 4. Access Your Forms
- **Intake Form**: `https://zakpestsos.github.io/engage-intake/frontend-intake/`
- **Dashboard**: `https://zakpestsos.github.io/engage-intake/frontend-dashboard/?token=COMPANY_TOKEN`

## Google Places Autocomplete Features

✅ **Full Google Places Integration**
- Real autocomplete suggestions as you type
- Auto-fills Street, City, State, Zip instantly
- Works exactly like other websites (Google Maps, etc.)

✅ **Call Center Optimized**
- Same fast keyboard navigation (Tab 1-13)
- All keyboard shortcuts work (Ctrl+Enter, Alt+1-4)
- Visual feedback when autocomplete is ready
- Auto-advance to next field after address selection

✅ **No Restrictions**
- No Apps Script sandboxing limitations
- Full browser API access
- Reliable Google Places performance

## Why This Works

- **Apps Script HTMLService**: Sandboxed environment blocks Google Places API
- **GitHub Pages**: Standard web hosting allows full Google API access
- **Same Backend**: Still uses your Apps Script for data storage

## Usage

1. **Agents use GitHub Pages URL** for intake form with autocomplete
2. **Data still saves** to your Google Sheets via Apps Script API
3. **Clients use either** GitHub Pages or Apps Script for dashboard

You get the best of both worlds: **full Google Places autocomplete** AND **Google Sheets integration**!

## Next Steps

1. **Upload the frontend files** to your repository: https://github.com/zakpestsos/engage-intake
2. **Enable GitHub Pages** at: https://github.com/zakpestsos/engage-intake/settings/pages
3. **Deploy your Apps Script** and update `API_BASE` in config.js
4. **Test the form** at: https://zakpestsos.github.io/engage-intake/frontend-intake/

## Test It

Try typing "1600 Amphitheatre Parkway" in the address field - you should see Google's suggestions appear instantly and auto-fill all address fields when selected.

Your final URLs will be:
- **Intake Form**: https://zakpestsos.github.io/engage-intake/frontend-intake/
- **Dashboard**: https://zakpestsos.github.io/engage-intake/frontend-dashboard/
