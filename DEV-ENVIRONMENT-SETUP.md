# Development Environment Setup Instructions

## 🎯 Goal

Set up a complete staging environment where you can safely develop and test changes without affecting your live production system.

## ✅ What's Already Done

The git branching and configuration files have been created:
- ✅ Development branch created and pushed
- ✅ Environment-specific config files created (`config.production.js`, `config.staging.js`)
- ✅ HTML files updated to auto-detect environment
- ✅ `.clasp.json` updated with deployment references
- ✅ DEV-WORKFLOW.md documentation created

## 🔧 What You Need to Do

### Step 1: Create Staging Apps Script Deployment

This creates a second deployment of your Apps Script that won't affect production users.

1. **Open Apps Script Editor**:
   ```bash
   clasp open
   ```
   Or visit: https://script.google.com/home/projects/1mk5ziDWSMMJq9PrlAOBFjJHoZEksLYV9qwNdaV7f4kVjdJRW_c6sWOwh/edit

2. **Create New Deployment**:
   - Click **Deploy** (top right)
   - Select **New deployment**
   - Click gear icon ⚙️ next to "Select type"
   - Choose **Web app**
   
3. **Configure Deployment**:
   - Description: `Staging Environment`
   - Execute as: **Me** (your Google account)
   - Who has access: **Anyone**
   - Click **Deploy**

4. **Copy the Deployment URL**:
   - You'll see a URL like: `https://script.google.com/macros/s/AKfycbXXXXXXXX.../exec`
   - **COPY THIS URL** - you'll need it in the next step

5. **Save the Deployment ID**:
   - Click **Done**
   - Go to **Deploy** → **Manage deployments**
   - Find your "Staging Environment" deployment
   - Copy the deployment ID (the part after `/s/` in the URL)

### Step 2: Update Staging Config File

1. **Edit `frontend-shared/config.staging.js`**:
   ```bash
   # On development branch
   git checkout development
   ```

2. **Replace the placeholder URL** with your staging deployment URL from Step 1:
   ```javascript
   API_BASE: 'https://script.google.com/macros/s/YOUR_STAGING_URL_HERE/exec'
   ```

3. **Update `.clasp.json`** with the staging deployment ID:
   ```json
   "deployments": {
     "production": "AKfycby_lsZuGVzK2kvpMiEtzWzjvjqcCCP4DGzX4u31bWUXfErBzxFnGXqM1mygAZ-I-MZ3",
     "staging": "YOUR_STAGING_DEPLOYMENT_ID_HERE"
   }
   ```

4. **Commit these changes**:
   ```bash
   git add frontend-shared/config.staging.js .clasp.json
   git commit -m "Setup: Add staging deployment URL"
   git push origin development
   ```

### Step 3: Add Dev Company to Spreadsheet

You need a test company to use in staging that won't interfere with production data.

**Option A: Automated (Recommended)**

1. **Open Apps Script Editor**:
   ```bash
   clasp open
   ```

2. **Run the setup function**:
   - Find `generate-dev-token.gs` in the file list
   - Open the function dropdown (top) and select `setupDevCompany`
   - Click **Run** (▶️ icon)
   - Check **Execution log** (bottom) for your Dev Company token
   - **COPY THE TOKEN** - you'll need it for testing

**Option B: Manual**

1. **Generate a token**:
   - In Apps Script editor, select function `generateDevToken`
   - Click **Run**
   - Copy the token from the log

2. **Open your Google Sheet**:
   - Open: Leads CRM (Apps Script)
   
3. **Add to Companies sheet**:
   | Company_Name | Company_Access_Token | Contact_Email | Notes |
   |--------------|---------------------|---------------|--------|
   | Dev Company | [PASTE TOKEN HERE] | your@email.com | Development and staging testing only |

4. **Add test products to Products sheet**:
   | Company_Name | Product_SKU | Product_Name | Initial_Price | Recurring_Price | Active | lead_value | sq_ft_min | sq_ft_max |
   |--------------|-------------|--------------|---------------|-----------------|--------|------------|-----------|-----------|
   | Dev Company | DEV-001 | Test Service A | 100 | 0 | TRUE | 100 | 0 | 1000 |
   | Dev Company | DEV-002 | Test Service B | 250 | 50 | TRUE | 250 | 1000 | 2500 |
   | Dev Company | DEV-003 | Test Service C | 500 | 100 | TRUE | 500 | 2500 | 5000 |

### Step 4: Configure GitHub Pages (Optional)

GitHub Pages currently deploys only the `main` branch. For staging, you have two options:

**Option A: Local Testing Only** (Simplest)
- Just test locally by opening HTML files
- Localhost automatically uses staging config
- No GitHub Pages changes needed

**Option B: Enable GitHub Actions** (Advanced)
- Set up GitHub Actions to deploy both branches
- Requires creating `.github/workflows/deploy.yml`
- See: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

**Recommended**: Stick with Option A for now.

### Step 5: Test Your Staging Environment

1. **Test Staging Backend**:
   ```bash
   # Test that staging deployment responds
   curl "YOUR_STAGING_URL?test=ping"
   ```
   Should return: `{"status":"success","message":"Apps Script is working!"}`

2. **Test Staging Frontend Locally**:
   ```bash
   # Switch to development branch
   git checkout development
   
   # Open intake form in browser (uses staging config on localhost)
   # File → Open → frontend-intake/index-cyberpunk-v2.html
   ```

3. **Test Form Submission**:
   - Fill out the intake form
   - Use "Dev Company" from dropdown
   - Submit the form
   - Check your Google Sheet - should see new lead with "Dev Company"

4. **Test Dashboard**:
   - Open `frontend-dashboard/index.html?token=YOUR_DEV_TOKEN`
   - Should see only "Dev Company" data
   - Should NOT see production company data

### Step 6: Protect Production

Add a visual indicator to staging environment so you don't confuse it with production.

The HTML files already auto-detect and load the correct config based on:
- Hostname (localhost = staging)
- URL parameter (`?env=staging` = staging)
- Otherwise = production

You can force staging mode by adding `?env=staging` to any URL.

## ✅ Setup Complete Checklist

- [ ] Staging Apps Script deployment created
- [ ] Staging deployment URL added to `config.staging.js`
- [ ] Dev Company added to spreadsheet with token
- [ ] Test products added for Dev Company
- [ ] Staging backend responds to ping test
- [ ] Intake form works locally with Dev Company
- [ ] Dashboard loads with Dev Company token
- [ ] Production environment still works (verify on main branch)

## 🚀 Next Steps

1. **Read the workflow guide**: See `DEV-WORKFLOW.md` for daily development process
2. **Start developing**: Make changes on `development` branch
3. **Test in staging**: Use Dev Company token for all tests
4. **Deploy to production**: Merge to `main` when ready

## 📋 Quick Reference

### Branches
- `main` - Production (LIVE users)
- `development` - Staging (safe for testing)

### Deployments
- Production: `AKfycby_lsZuGVzK2kvpMiEtzWzjvjqcCCP4DGzX4u31bWUXfErBzxFnGXqM1mygAZ-I-MZ3`
- Staging: [UPDATE AFTER STEP 1]

### Test Credentials
- Company: Dev Company
- Token: [GENERATED IN STEP 3]

### URLs
- Production: https://zakpestsos.github.io/engage-intake/
- Staging: Local testing or add `?env=staging`

## 🆘 Troubleshooting

### "STAGING_DEPLOYMENT_URL_PLACEHOLDER" error
- You forgot to update `config.staging.js` with your staging URL (Step 2)

### "Invalid token" error
- Check that Dev Company token is correctly copied
- Verify Dev Company exists in Companies sheet
- Token should be 32 characters

### Form not loading company data
- Check browser console for errors
- Verify API_BASE URL is correct in config file
- Test backend with ping: `YOUR_URL?test=ping`

### Changes not working
- Clear browser cache (Ctrl+Shift+R)
- Check you're on development branch: `git branch`
- Verify you're testing with staging config (check browser console)

---

**Need Help?** Review `DEV-WORKFLOW.md` for daily development procedures.

