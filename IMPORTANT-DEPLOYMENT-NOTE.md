# ⚠️ IMPORTANT: Deployment URL Update Required

## Current Situation

During the setup process, the Apps Script deployment URL was accidentally undeployed and redeployed. This means the URL hardcoded in `frontend-shared/config.js` may no longer work.

### Previous Deployment (DELETED)
```
https://script.google.com/a/macros/pest-sos.com/s/AKfycbwwQzm1JKLd_cv7T5niv44KGI_Y5Q24xGomIYJXCUgzpJJGD9kJ2hL_w4-SNdhoPzPV/exec
```

### New Deployment Created
```
Deployment ID: AKfycbx4Y8Fr8EaVDYwk9Kbfv3nWH53Y2creKT6bqr9Q-jlO5DE2FynVrO_nNgtKxMDIlTGm
Version: @61
```

---

## 🔧 Action Required

You need to redeploy the Apps Script as a Web App to get a new workspace-scoped URL.

### Option 1: Manual Redeploy (Recommended for Workspace Domain)

1. **Open Apps Script Editor:**
   ```
   https://script.google.com/home/projects/1mk5ziDWSMMJq9PrlAOBFjJHoZEksLYV9qwNdaV7f4kVjdJRW_c6sWOwh/edit
   ```

2. **Create New Deployment:**
   - Click the **Deploy** button (top right)
   - Select **New Deployment**
   - Set type: **Web app**
   - Description: "Production deployment with Jem Pest Solutions"
   - Execute as: **Me**
   - Who has access: **Anyone** (or appropriate for your security needs)
   - Click **Deploy**

3. **Copy the New URL:**
   - After deployment, copy the Web app URL
   - It should look like:
     ```
     https://script.google.com/a/macros/pest-sos.com/s/[NEW_DEPLOYMENT_ID]/exec
     ```

4. **Update config.js:**
   - Edit `frontend-shared/config.js`
   - Replace the `API_BASE` value with your new URL:
     ```javascript
     API_BASE: 'https://script.google.com/a/macros/pest-sos.com/s/[NEW_DEPLOYMENT_ID]/exec',
     ```

5. **Commit and Push:**
   ```bash
   git add frontend-shared/config.js
   git commit -m "Update API_BASE with new deployment URL"
   git push origin main
   ```

6. **Wait for GitHub Pages to Deploy:**
   - GitHub Pages will automatically rebuild (1-2 minutes)
   - Verify at: https://zakpestsos.github.io/engage-intake/frontend-intake/

### Option 2: Use Standard Deployment (If Workspace Not Required)

If the workspace domain isn't required, you can use the standard deployment:

```
https://script.google.com/macros/s/AKfycbx4Y8Fr8EaVDYwk9Kbfv3nWH53Y2creKT6bqr9Q-jlO5DE2FynVrO_nNgtKxMDIlTGm/exec
```

Update `config.js` with this URL and test.

---

## 📋 After Updating the Deployment URL

### Run the Jem Pest Solutions Setup

Once the deployment is working:

1. **Run the setup function:**
   - Open Apps Script Editor
   - Select `addJemPestSolutions` from function dropdown
   - Click Run
   - Check execution log for success

2. **Or use the setup endpoint:**
   ```bash
   curl "[NEW_DEPLOYMENT_URL]?setup=jem-pest-solutions"
   ```

3. **Verify the response contains:**
   - `success: true`
   - `company: "Jem Pest Solutions"`
   - `token: "a6f6f569cf05dfde4db61b8f7b3c7926"`
   - `productsAdded: 27`
   - URLs for intake form and dashboard

---

## 🧪 Testing After Setup

### 1. Test Configuration API
```bash
curl "[NEW_DEPLOYMENT_URL]?api=config&token=a6f6f569cf05dfde4db61b8f7b3c7926"
```

Should return:
```json
{
  "company": {"name": "Jem Pest Solutions"},
  "products": [... 27 products ...]
}
```

### 2. Test Intake Form
- Visit: `https://zakpestsos.github.io/engage-intake/frontend-intake/?token=a6f6f569cf05dfde4db61b8f7b3c7926`
- Should show "Call Intake Form for Jem Pest Solutions"
- Products should load when area is entered

### 3. Test Dashboard
- Visit: `https://zakpestsos.github.io/engage-intake/frontend-dashboard/?token=a6f6f569cf05dfde4db61b8f7b3c7926`
- Should show "Jem Pest Solutions Dashboard"
- Should load (empty initially until leads are added)

---

## 📞 Quick Reference

| Item | Value |
|------|-------|
| Script ID | 1mk5ziDWSMMJq9PrlAOBFjJHoZEksLYV9qwNdaV7f4kVjdJRW_c6sWOwh |
| Company Token | a6f6f569cf05dfde4db61b8f7b3c7926 |
| Setup Function | addJemPestSolutions() |
| Test Function | testJemPestSolutionsConfig() |
| Products Count | 27 |

---

## ❓ Troubleshooting

### If forms show "Failed to load configuration":
- Check that `config.js` has the correct deployment URL
- Verify the deployment is set to "Anyone" access
- Clear browser cache and try again
- Check browser console for CORS errors

### If setup function fails:
- Ensure you're logged into the correct Google account
- Grant necessary permissions when prompted
- Check Apps Script execution logs for error details

### If products don't appear:
- Verify the `Products` sheet has all 27 products
- Check that `Active` column is set to `TRUE`
- Verify `Company_Name` matches exactly: "Jem Pest Solutions"

---

**Last Updated:** $(date)  
**Priority:** HIGH - Required before system can be used

