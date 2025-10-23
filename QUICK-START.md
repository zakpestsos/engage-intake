# Development Environment - Quick Start

## 🎯 You're Now Set Up With

### Two Branches
- **`main`** → Production (LIVE users) ✅
- **`development`** → Staging (safe testing) ✅

### Two Environments  
- **Production** → Real customers, real data
- **Staging** → Test company, safe to break

## ⚡ Quick Commands

### Daily Development
```bash
# Start work
git checkout development
git pull

# Make changes, test locally

# Commit
git add .
git commit -m "Feature: description"
git push

# Deploy to production (when ready)
git checkout main
git merge development
git push
```

### Testing Locally
```bash
# Just open HTML files
# Localhost automatically uses staging config
```

## 🔧 Complete Setup (3 Manual Steps)

### 1. Create Staging Deployment
```bash
clasp open
# Then: Deploy → New Deployment → Web App
# Description: "Staging Environment"
```

### 2. Update Staging Config
Edit `frontend-shared/config.staging.js`:
```javascript
API_BASE: 'YOUR_STAGING_URL_HERE'
```

### 3. Add Dev Company
```bash
clasp open
# Run function: setupDevCompany()
# Copy the token it generates
```

## 📖 Full Documentation

- **DEV-ENVIRONMENT-SETUP.md** - Complete setup guide
- **DEV-WORKFLOW.md** - Daily development procedures  
- **SETUP-SUMMARY.md** - What's done, what's pending

## ✅ What's Already Working

- ✅ Git branches created and pushed
- ✅ Config files created
- ✅ HTML files auto-detect environment
- ✅ Production unchanged and working
- ✅ Ready for development work

## ⚠️ What You Need to Do

- ❌ Create staging Apps Script deployment
- ❌ Update staging config URL
- ❌ Add Dev Company to spreadsheet

**Time Required**: ~10 minutes

## 🚀 After Setup Is Complete

You'll be able to:
- Develop safely without affecting production
- Test changes with Dev Company token
- Deploy to production with confidence
- Roll back if needed

---

**Next Step**: Open `DEV-ENVIRONMENT-SETUP.md` for detailed instructions

