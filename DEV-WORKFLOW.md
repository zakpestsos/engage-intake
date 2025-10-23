# Development Workflow Guide

## Overview

This document outlines the development workflow for Engage CRM to ensure safe development without affecting production users.

## Environment Architecture

### Production Environment
- **Branch**: `main`
- **Frontend URL**: `https://zakpestsos.github.io/engage-intake/`
- **Backend**: Apps Script Production Deployment (Version 68)
- **Config**: `config.production.js`
- **Data**: Production spreadsheet with real customer data
- **Users**: Live agents and clients
- **Status**: ✅ LIVE - Handle with care!

### Staging Environment
- **Branch**: `development`
- **Frontend URL**: Local testing or `?env=staging` URL parameter
- **Backend**: Apps Script Staging Deployment
- **Config**: `config.staging.js`
- **Data**: Same spreadsheet, but uses "Dev Company" token
- **Users**: Developers only
- **Status**: 🔧 SAFE for testing

## Initial Setup (One-Time)

### 1. Create Staging Apps Script Deployment

```bash
# Push your code to Apps Script
clasp push

# Open Apps Script editor
clasp open
```

In the Apps Script web editor:
1. Click **Deploy** → **New Deployment**
2. Type: **Web app**
3. Description: `Staging Environment`
4. Execute as: **Me**
5. Who has access: **Anyone**
6. Click **Deploy**
7. Copy the staging deployment URL

### 2. Update Staging Config

Edit `frontend-shared/config.staging.js`:
```javascript
API_BASE: 'YOUR_STAGING_DEPLOYMENT_URL_HERE'
```

### 3. Update .clasp.json

Edit `.clasp.json` and update the staging deployment ID:
```json
"deployments": {
  "production": "AKfycby_lsZuGVzK2kvpMiEtzWzjvjqcCCP4DGzX4u31bWUXfErBzxFnGXqM1mygAZ-I-MZ3",
  "staging": "YOUR_STAGING_DEPLOYMENT_ID"
}
```

### 4. Add Dev Company to Spreadsheet

1. Open your Google Sheet (Leads CRM)
2. Go to **Companies** sheet
3. Add a new row:
   - **Company_Name**: `Dev Company`
   - **Company_Access_Token**: Generate using Apps Script:
     ```javascript
     // Run this in Apps Script editor
     function generateDevToken() {
       Logger.log(randomToken32_());
     }
     ```
   - **Contact_Email**: Your email
   - **Notes**: `Development and staging testing only`

4. Go to **Products** sheet and add test products for "Dev Company"

### 5. Test Staging Environment

```bash
# Switch to development branch
git checkout development

# Open index.html with ?env=staging parameter
# Or test locally (automatically uses staging config on localhost)
```

## Daily Development Workflow

### Starting a New Feature

```bash
# Make sure you're on the latest development branch
git checkout development
git pull origin development

# Create a feature branch (optional but recommended)
git checkout -b feature/my-new-feature

# Make your changes
# Test locally (uses staging config automatically on localhost)
```

### Testing Your Changes

1. **Local Testing**:
   - Open HTML files locally - automatically uses `config.staging.js`
   - Uses staging Apps Script deployment
   - Uses "Dev Company" token for testing

2. **Force Staging on GitHub Pages**:
   - Add `?env=staging` to any URL
   - Example: `https://zakpestsos.github.io/engage-intake/frontend-intake/?env=staging`

### Committing Changes

```bash
# Stage your changes
git add .

# Commit with descriptive message
git commit -m "Add: Description of your feature"

# Push to development branch
git push origin development
# (or push to your feature branch if using one)
```

### Deploying to Production

⚠️ **IMPORTANT**: Only deploy to production after thorough testing!

```bash
# Ensure all changes are committed in development
git checkout development
git status  # Should be clean

# Switch to main branch
git checkout main

# Merge development into main
git merge development

# Review the changes one more time
git log -5

# Push to production
git push origin main
```

GitHub Pages will automatically deploy the updated `main` branch within a few minutes.

## Backend (Apps Script) Updates

### Updating Staging Backend

```bash
# Switch to development branch
git checkout development

# Make changes to .gs files

# Push to Apps Script
clasp push

# In Apps Script editor, create NEW deployment or update existing staging deployment
clasp deploy --description "Staging: Feature description"
```

### Updating Production Backend

⚠️ **CRITICAL**: This affects live users immediately!

```bash
# Switch to main branch
git checkout main

# Ensure code is tested and merged from development
git merge development

# Push to Apps Script
clasp push

# Update the PRODUCTION deployment (Version 68)
# Option 1: Create new version and update deployment
# Option 2: In Apps Script editor, Deploy → Manage Deployments → Edit Production deployment
```

## Emergency Rollback Procedures

### Frontend Rollback

If production frontend breaks:

```bash
# Find the last working commit
git log --oneline -10

# Revert to previous commit
git checkout main
git revert HEAD  # Or use specific commit hash
git push origin main
```

### Backend Rollback

If production backend breaks:

1. Open Apps Script editor: `clasp open`
2. Go to **Deploy** → **Manage Deployments**
3. Click on Production deployment
4. Select previous version from dropdown
5. Click **Deploy**

## Testing Checklist

Before deploying to production, verify:

- [ ] Feature works correctly in staging environment
- [ ] No console errors in browser DevTools
- [ ] Forms submit successfully with Dev Company token
- [ ] Dashboard loads and displays data correctly
- [ ] No production data is affected by changes
- [ ] All validation and error handling works
- [ ] Mobile responsiveness (if UI changes)
- [ ] Google Places autocomplete still works (if address fields touched)
- [ ] All keyboard shortcuts still work (if form changes)

## Environment Variables Quick Reference

### Production Config (`config.production.js`)
```javascript
API_BASE: 'https://script.google.com/macros/s/AKfycby_lsZuGVzK2kvpMiEtzWzjvjqcCCP4DGzX4u31bWUXfErBzxFnGXqM1mygAZ-I-MZ3/exec'
ENVIRONMENT: 'production'
```

### Staging Config (`config.staging.js`)
```javascript
API_BASE: '[YOUR_STAGING_DEPLOYMENT_URL]'
ENVIRONMENT: 'staging'
```

## URLs Reference

| Environment | Branch | Intake Form | Dashboard |
|------------|--------|-------------|-----------|
| **Production** | main | https://zakpestsos.github.io/engage-intake/frontend-intake/ | https://zakpestsos.github.io/engage-intake/frontend-dashboard/ |
| **Staging** | development | Local testing or add `?env=staging` | Local testing or add `?env=staging` |

## Company Tokens

- **Production Companies**: Real client tokens (JEM Pest Solutions, etc.)
- **Dev Company**: Use this token for all staging tests
- **NEVER** use production company tokens in staging environment

## Common Issues and Solutions

### Issue: Changes not reflecting on GitHub Pages

**Solution**: 
- GitHub Pages can take 5-10 minutes to deploy
- Clear browser cache (Ctrl+Shift+R)
- Check that you pushed to the correct branch

### Issue: API calls failing in staging

**Solution**:
- Verify staging deployment URL in `config.staging.js`
- Check that staging deployment is active in Apps Script
- Ensure you're using Dev Company token

### Issue: "CORS error" or "403 Forbidden"

**Solution**:
- Redeploy the Apps Script web app
- Ensure "Who has access" is set to "Anyone"
- Check ALLOWED_ORIGINS in Code.gs includes your domain

### Issue: Config loading wrong environment

**Solution**:
- For staging: Add `?env=staging` to URL
- For production: Remove all URL parameters
- Check browser console for config loading messages

## Best Practices

1. **Always test in staging first** - Never push untested code to main
2. **Use descriptive commit messages** - Makes rollback easier
3. **Keep development branch up to date** - Regularly merge main into development to avoid conflicts
4. **One feature at a time** - Easier to debug and rollback
5. **Document breaking changes** - Update this guide if workflow changes
6. **Backup before major changes** - Export spreadsheet data periodically
7. **Monitor production after deployment** - Check for errors in first 30 minutes

## Contact

For questions or issues with this workflow:
- Review this document
- Check git history: `git log`
- Test in staging before asking for help

---

**Last Updated**: 2025-01-23  
**Maintained By**: Development Team

