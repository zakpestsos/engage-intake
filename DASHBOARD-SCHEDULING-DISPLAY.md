# 📅 Scheduling Field in Dashboard - Visual Guide

## ✅ What Was Added

The **Scheduling Told** field now appears in the lead detail modal when you click on any lead in the dashboard.

---

## 📍 Where It Appears

### In the Modal

When you click on a lead, the detail modal shows:

```
┌────────────────────────────────────────────────────────┐
│  Lead Details                           [NEW]    X     │
├────────────────────────────────────────────────────────┤
│                                                         │
│  CUSTOMER INFORMATION                                   │
│  Name:                    John Smith                    │
│  Phone:                   (555) 123-4567                │
│                                                         │
│  SERVICE                                                │
│  Product/Service:         Home Protection Plan          │
│                                                         │
│  PRICING DETAILS                                        │
│  Initial Price:           $225.00                       │
│  Recurring Price:         $55.00                        │
│                                                         │
│  PROPERTY ADDRESS                                       │
│  123 Main St                                            │
│  Dover, DE 19901                                        │
│  Square Footage:          5,000 sq ft                   │
│                                                         │
│  CONTACT PREFERENCE & MARKETING SOURCE                  │
│  Reason for Call:         New Sale                      │
│  Scheduling Told:         Tomorrow Morning (8-12 PM) ⭐ │
│  Source:                  Call Center                   │
│                                                         │
│  NOTES                                                  │
│  Customer wants quarterly service...                    │
│                                                         │
└────────────────────────────────────────────────────────┘
```

---

## 🎨 Styling

The scheduling field:
- **Label:** "Scheduling Told:"
- **Format:** Displays exactly as entered in intake form
- **Location:** Between "Reason for Call" and "Source"
- **Fallback:** Shows "Not specified" if no value

---

## 📊 Backend Data Flow

### 1. Intake Form → Spreadsheet
- Agent selects scheduling option
- Stored in column O: `Scheduling_Told`

### 2. Spreadsheet → API
- `listLeadsForCompany_()` function reads from sheet
- Includes `schedulingTold` in lead object
- Sent to dashboard via JSON API

### 3. API → Dashboard
- Dashboard receives `lead.schedulingTold`
- Populates `#modalScheduling` element
- Displays in modal

---

## 🧪 Test It

### Step 1: Submit a Test Lead
1. Go to intake form
2. Fill out lead information
3. **Select scheduling:** "Tomorrow Morning (8-12 PM)"
4. Submit

### Step 2: View in Dashboard
1. Go to dashboard
2. Find your test lead
3. **Click on the lead row**
4. Modal opens
5. **Look for:** "Scheduling Told: Tomorrow Morning (8-12 PM)"

---

## 📋 What Shows Up

Based on intake form selections:

| Intake Form Selection | Dashboard Display |
|----------------------|-------------------|
| Today Afternoon (12-4 PM) | Today Afternoon (12-4 PM) |
| Tomorrow Morning (8-12 PM) | Tomorrow Morning (8-12 PM) |
| Tomorrow Afternoon (12-4 PM) | Tomorrow Afternoon (12-4 PM) |
| Tomorrow (Anytime) | Tomorrow (Anytime) |
| Other - See Notes | Other - See Notes |
| *(not selected)* | Not specified |

---

## ✅ What's Deployed

### Frontend (GitHub Pages)
- ✅ HTML modal updated with scheduling field
- ✅ JavaScript populates field from lead data
- ✅ Deployed to: https://zakpestsos.github.io/engage-intake/frontend-dashboard/

### Backend (Apps Script)
- ✅ API includes `schedulingTold` in lead object
- ✅ Also includes `customerEmail` for future use
- ✅ Deployed to Apps Script project

---

## 🔄 How to Access

**Dashboard URL:**
```
https://zakpestsos.github.io/engage-intake/frontend-dashboard/?token=YOUR_TOKEN
```

**Wait 30-60 seconds** for GitHub Pages deployment, then hard refresh:
- Windows: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

---

## 🎯 Expected Behavior

### For Existing Leads (Before Update)
- Scheduling Told will show: **"Not specified"**
- This is normal - old leads don't have this data

### For New Leads (After Update)
- Scheduling Told will show: **Selected option from dropdown**
- Example: "Tomorrow Morning (8-12 PM)"

---

## 💡 Benefits

**For Call Center Managers:**
- See exactly what was promised to customer
- Verify scheduling commitments
- Track response time patterns

**For Customer Service:**
- Know when customer expects technician
- Follow up with accurate information
- Reduce customer confusion

**For Operations:**
- Better schedule coordination
- Track commitment accuracy
- Improve dispatch planning

---

## 📄 Files Modified

### Frontend
- `frontend-dashboard/index.html` - Added scheduling field to modal
- `frontend-dashboard/app.js` - Populated field with data

### Backend
- `sheets.gs` - Added `schedulingTold` and `customerEmail` to API response

---

**Created:** October 9, 2025  
**Status:** ✅ Deployed and Live  
**Dashboard URL:** https://zakpestsos.github.io/engage-intake/frontend-dashboard/?token=YOUR_TOKEN

