# 📞 Engage CRM - GitHub Pages Frontend

**Google Places Autocomplete Intake Form & Dashboard**

This repository contains the static frontend for the Engage CRM system that provides full Google Places autocomplete functionality.

## 🚀 Live Demo
- **Intake Form**: https://zakpestsos.github.io/engage-intake/frontend-intake/
- **Dashboard**: https://zakpestsos.github.io/engage-intake/frontend-dashboard/

## ✨ Features

### Intake Form (Call Agents)
- ✅ **Google Places Autocomplete** - Real suggestions as you type
- ✅ **Call Center Optimized** - Fast keyboard navigation
- ✅ **Auto-fill Address Fields** - Street, City, State, ZIP
- ✅ **Smart Validation** - Inline error messages
- ✅ **Quick Submit** - Ctrl+Enter shortcut
- ✅ **Auto-reset** - Form clears after successful submit

### Client Dashboard
- ✅ **Real-time Lead Management** - View, accept, complete leads
- ✅ **Analytics & Charts** - Production value, lead trends
- ✅ **Company Scoping** - Multi-tenant with access tokens
- ✅ **Responsive Design** - Works on all devices

## 🔧 Setup

### 1. Configure API Settings
Edit `frontend-shared/config.js`:
```javascript
window.APP_CONFIG = {
  API_BASE: 'YOUR_APPS_SCRIPT_WEB_APP_URL',
  PLACES_API_KEY: 'AIzaSyC9AzPi4MPa7IJr0wxfFsSSoSCMtYeSrVM'
};
```

### 2. Enable GitHub Pages
1. Go to [Settings → Pages](https://github.com/zakpestsos/engage-intake/settings/pages)
2. Source: "Deploy from a branch" → `main` → `/ (root)`
3. Save

### 3. Restrict Google Maps API Key
Add this referrer to your API key restrictions:
```
https://zakpestsos.github.io/*
```

## 📁 Project Structure

```
frontend-intake/          # Agent intake form
├── index.html           # Call center optimized form
└── app.js              # Google Places integration

frontend-dashboard/       # Client dashboard
├── index.html           # Lead management interface  
└── app.js              # Analytics & data handling

frontend-shared/          # Shared resources
├── config.js            # API configuration
├── config.example.js    # Configuration template
└── styles.css          # Shared styling
```

## 🔗 Backend Integration

This frontend connects to a Google Apps Script backend that:
- Stores data in Google Sheets
- Provides JSON API endpoints
- Handles multi-tenant security
- Manages lead lifecycle

## 📖 Documentation

- [GitHub Pages Setup Guide](GITHUB_PAGES_SETUP.md)
- [Google Maps API Setup](GOOGLE_MAPS_SETUP.md)

## 🎯 Why GitHub Pages?

Google Apps Script's HTMLService has sandboxing restrictions that prevent Google Places API from working. This GitHub Pages deployment gives you:

- ✅ **Full Google Places autocomplete** (like other websites)
- ✅ **No sandboxing restrictions**
- ✅ **Faster loading** and better performance
- ✅ **Modern web standards** support
- ✅ **Still integrates** with your Google Sheets backend

Best of both worlds: **Modern frontend + Google Sheets backend**!

---

**Repository**: https://github.com/zakpestsos/engage-intake  
**Backend**: Google Apps Script + Google Sheets  
**Frontend**: GitHub Pages + Google Places API
