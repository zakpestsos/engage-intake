# 🎨 Cyberpunk Intake Form - Setup Guide

## ✅ New Features Added

### 1. **Cyberpunk Theme**
- Matches your profile-styles.css aesthetic
- Dark gradient background with glowing blue accents
- Animated header with scan effect
- Optimized for 1920x1080 fullscreen

### 2. **Improved Service Selection**
- **Searchable service cards** instead of dropdown
- Visual card grid with pricing display
- Instant search filtering
- Selected service highlighting

### 3. **Email Field**
- Added email input in Customer Information section
- Optional field for customer contact

### 4. **Auto-Company Detection**
- Company dropdown removed
- Company automatically detected from URL token
- Cleaner, faster workflow

### 5. **Enhanced Layout**
- 2-column layout for better space utilization
- Left column: Customer info, address, call details
- Right column: Service selection
- No scrolling required on 1920x1080 displays

---

## 🔑 Token Issue - IMPORTANT!

### ❌ Current Token (NOT WORKING):
```
c8e240f2bafa4c26b186b364bddf900a
```
**Error:** "Forbidden" - This token is not valid in your system

### ✅ Find Your Correct Token:

#### Method 1: Check Google Sheets (Easiest)
1. Open your spreadsheet:
   ```
   https://docs.google.com/spreadsheets/d/1LB1cHQu4ntC26t_ZnLDAqwIJ_KNJC2PgC3zOM2NyAlk/edit
   ```

2. Go to the **"Companies"** sheet tab

3. Find the row with **"Jem Pest Solutions"**

4. Copy the token from the **"Company_Access_Token"** column (Column B)

#### Method 2: Run Apps Script Function
1. Open Apps Script Editor:
   ```
   https://script.google.com/home/projects/1mk5ziDWSMMJq9PrlAOBFjJHoZEksLYV9qwNdaV7f4kVjdJRW_c6sWOwh/edit
   ```

2. Select function: `getJemPestSolutionsToken` from dropdown

3. Click **Run** (▶️)

4. Check the execution log for the correct token and URLs

---

## 🚀 Access the New Cyberpunk Form

### Option 1: Direct Access (New Design)
Once you have your correct token, use this URL:

```
https://zakpestsos.github.io/engage-intake/frontend-intake/index-new.html?token=YOUR_TOKEN_HERE
```

**Example (replace with your actual token):**
```
https://zakpestsos.github.io/engage-intake/frontend-intake/index-new.html?token=42b5da6cc9f54edf9277a688efd185dc
```

### Option 2: Old Design (Still Available)
The original form is still available:
```
https://zakpestsos.github.io/engage-intake/frontend-intake/?token=YOUR_TOKEN_HERE
```

---

## 📋 What Changed in the New Form

### Layout Improvements
| Feature | Old Design | New Design |
|---------|------------|------------|
| Company Selection | Dropdown menu | Auto-detected from token |
| Service Selection | Dropdown with 27+ items | Searchable card grid |
| Email Field | ❌ Not included | ✅ Added |
| Layout | Single column, scrolling | 2-column, no scrolling (1920x1080) |
| Theme | Light/basic dark | Cyberpunk with animations |
| Search | ❌ No search | ✅ Real-time service search |

### Service Selection Experience

**Old Way:**
- Scroll through dropdown with 27+ services
- Hard to compare prices
- No search capability

**New Way:**
- See all services as visual cards
- Search by typing service name
- Click card to select
- Prices shown on each card
- Selected service highlighted

### Form Flow
1. **Auto-loads company** from token (no dropdown)
2. **Enter customer info** (now includes email)
3. **Enter address** (Google Places autocomplete still works)
4. **Enter property area** → Services appear automatically
5. **Search and select service** from card grid
6. **Complete call details**
7. **Submit** (Ctrl+Enter shortcut works)

---

## 🎨 Design Features

### Cyberpunk Aesthetic
- **Dark gradients:** #0f172a → #1e293b
- **Blue accents:** #3b82f6, #60a5fa
- **Animated header:** Scanning light effect
- **Green success:** #10b981 for pricing
- **Font:** Inter (body), Poppins (headers), Rajdhani (labels)

### Interactive Elements
- **Hover effects:** Cards lift and glow on hover
- **Selected state:** Service cards turn blue when selected
- **Real-time search:** Instant filtering as you type
- **Area converter:** Toggle between sq ft and acres
- **Toast notifications:** Slide-in success/error messages

---

## 🧪 Testing the New Form

### Step 1: Get Your Token
Follow Method 1 or 2 above to get the correct token from your spreadsheet.

### Step 2: Access Form
Open the URL with your token:
```
https://zakpestsos.github.io/engage-intake/frontend-intake/index-new.html?token=YOUR_ACTUAL_TOKEN
```

### Step 3: Test Workflow
1. **Verify company name** appears in header
2. **Fill customer info:**
   - First Name: John
   - Last Name: Smith
   - Phone: (555) 123-4567
   - Email: john.smith@example.com

3. **Enter address:**
   - Street: 123 Main St, Dover, DE 19901
   - (Should auto-fill city, state, zip)

4. **Enter area:** 5000 sq ft

5. **Search and select service:**
   - Type "Home Protection" in search
   - Click on "Home Protection Plan (Quarterly)"
   - Verify pricing shows: Initial $225, Recurring $55

6. **Complete details:**
   - Reason: New Sale
   - Notes: "Customer wants quarterly service"

7. **Submit:** Click "Save Lead" or press Ctrl+Enter

8. **Verify:** Check Google Sheets "Leads" tab for new entry

---

## 📊 Comparison Screenshots

### Service Selection

**Old Design (Dropdown):**
```
[Select product/service...        ▼]
```

**New Design (Card Grid):**
```
┌─────────────────────────────────────┐
│ 🔍 Search services...               │
└─────────────────────────────────────┘

┌──────────────────────┐ ┌──────────────────────┐
│ Home Protection Plan │ │ HPP + Mosquito       │
│ Initial: $225        │ │ Initial: $275        │
│ Recurring: $55       │ │ Recurring: $55       │
└──────────────────────┘ └──────────────────────┘

┌──────────────────────┐ ┌──────────────────────┐
│ Termite Protection   │ │ One-Time Treatment   │
│ Initial: $599        │ │ Initial: $225        │
│ Recurring: $30       │ │ Recurring: $0        │
└──────────────────────┘ └──────────────────────┘
```

---

## 🔧 Troubleshooting

### Issue: "Failed to load configuration"
**Solution:** You're using the wrong token. Get the correct one from your spreadsheet.

### Issue: "JSONP request timed out"
**Solution:** Check that your Apps Script deployment is active and the URL in config.js is correct.

### Issue: No services showing
**Solution:** Enter a property area (sq ft or acres) first. Services only appear when area is provided.

### Issue: Form looks broken
**Solution:** Wait 1-2 minutes for GitHub Pages to deploy the new files, then hard refresh (Ctrl+Shift+R).

---

## 🎯 Next Steps

1. **Get correct token** from Google Sheets
2. **Bookmark the new form URL** with your token
3. **Share with call center agents** once verified
4. **Optional:** Replace old form by renaming:
   - Rename `index-new.html` → `index.html`
   - Rename `styles-cyberpunk.css` → included in HTML
   - Rename `app-cyberpunk.js` → included in HTML

---

## 📞 Quick Reference

| Item | Value |
|------|-------|
| **Spreadsheet** | https://docs.google.com/spreadsheets/d/1LB1cHQu4ntC26t_ZnLDAqwIJ_KNJC2PgC3zOM2NyAlk/edit |
| **Apps Script** | https://script.google.com/home/projects/1mk5ziDWSMMJq9PrlAOBFjJHoZEksLYV9qwNdaV7f4kVjdJRW_c6sWOwh/edit |
| **New Form** | https://zakpestsos.github.io/engage-intake/frontend-intake/index-new.html?token=YOUR_TOKEN |
| **Old Form** | https://zakpestsos.github.io/engage-intake/frontend-intake/?token=YOUR_TOKEN |

---

**🎉 Your new cyberpunk intake form is ready!**

Wait 1-2 minutes for GitHub Pages to deploy, then test it with the correct token from your spreadsheet.

