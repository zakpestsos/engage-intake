# 📞 Call Type Selector - Improved Form Flow

## Overview

The intake form now has a **top-level call type selector** that intelligently shows/hides fields based on whether it's a **New Sale** or **Service Call**. This dramatically improves agent workflow and data quality.

---

## 🎯 What Changed

### Before
- Single "Reason for Call" dropdown with mixed options
- Service selection always required (even for service calls)
- Confusing workflow for non-sales calls

### After
- **Two distinct call types**: New Sale vs Service Call
- Smart form that adapts to call type
- Service selection only required for new sales
- Clear, purpose-driven workflows

---

## 🎨 New Form Layout

```
┌──────────────────────────────────────────────────────────┐
│  WHAT TYPE OF CALL IS THIS?                              │
│  ┌────────────────────┐  ┌────────────────────┐         │
│  │   💰 NEW SALE      │  │   🛠️ SERVICE CALL  │         │
│  │ (ACTIVE - BLUE)    │  │                     │         │
│  │ Customer wants     │  │  Existing customer │         │
│  │ to purchase        │  │  needs assistance  │         │
│  └────────────────────┘  └────────────────────┘         │
└──────────────────────────────────────────────────────────┘

[Rest of form adapts based on selection...]
```

---

## 💰 New Sale Mode

**When Selected:**
- ✅ Service selection shown and **required**
- ✅ Property area required  
- ✅ "New Sale Type" dropdown shown
- ✅ Call notes focused on sale details

**New Sale Type Options:**
- Initial Purchase
- Additional Service
- Service Upgrade

**What Gets Saved:**
- `Reason_For_Call`: "New Sale - [Type]"
- `Product_SKU`, `Product_Name`, prices populated
- `sq_ft`: Customer's property area

---

## 🛠️ Service Call Mode

**When Selected:**
- ✅ Service selection **hidden** (not required)
- ✅ Property area optional
- ✅ "Service Issue Type" dropdown shown
- ✅ Notes focused on issue description

**Service Issue Type Options:**
- Schedule Appointment
- Reschedule Appointment
- Cancellation
- Billing Question
- Service Complaint
- Technical Issue
- Other... (with text field)

**What Gets Saved:**
- `Reason_For_Call`: "Service - [Issue Type]"
- `Reason_Custom`: Details if "Other" selected
- `Product_SKU`, prices: Empty/zero (no product)
- `sq_ft`: 0 or empty

---

## 🔄 Switching Between Modes

Agents can **switch anytime** before submitting:

1. **New Sale → Service:**
   - Service grid hides
   - Selected service clears
   - Service issue dropdown appears
   - Notes label changes to "Service Issue Details"

2. **Service → New Sale:**
   - Service grid reappears
   - Property area becomes required
   - New sale type dropdown appears
   - Notes label changes to "Call Notes & Details"

**Toast notifications** confirm the mode switch.

---

## 📊 Data Storage

### ✅ NO New Spreadsheet Columns Needed!

Uses existing columns with prefixed values:

| Column | New Sale Example | Service Call Example |
|--------|-----------------|---------------------|
| **Reason_For_Call** | "New Sale - Initial Purchase" | "Service - Billing Question" |
| **Reason_Custom** | "" (empty) | "Charged twice this month" |
| **Product_SKU** | "HPP_Q_001" | "" (empty) |
| **Product_Name** | "Home Protection Plan" | "" (empty) |
| **Initial_Price** | 225.00 | 0 |
| **Recurring_Price** | 55.00 | 0 |
| **sq_ft** | 5000 | 0 |
| **Lead_Value** | 225.00 | 0 |

**Dashboard Compatibility:** Existing dashboards will show the prefixed reason (e.g., "New Sale - Initial Purchase") with no changes needed.

---

## 🎭 Agent Workflow Examples

### Example 1: New Customer Wants Service

**Agent Actions:**
1. Form loads in **New Sale** mode (default)
2. Enter customer info
3. Enter address and property area
4. **Service grid appears** with available services
5. Select "Home Protection Plan"
6. Choose "New Sale Type": Initial Purchase
7. Select scheduling: Tomorrow Morning
8. Add notes about customer needs
9. Submit

**Result:** Complete new sale lead with all product details

---

### Example 2: Existing Customer Has Billing Question

**Agent Actions:**
1. Form loads in **New Sale** mode
2. **Click "Service Call" button** at top
3. Form instantly adapts (service grid hides)
4. Enter customer info (may already know them)
5. Choose "Service Issue Type": Billing Question
6. Select scheduling: Tomorrow Morning
7. Add notes: "Charged twice on last invoice"
8. Submit

**Result:** Service lead captured without requiring product selection

---

### Example 3: Customer Exploring Services (Becomes Sale)

**Agent Actions:**
1. Start in **Service Call** mode (agent thinks it's inquiry)
2. Customer asks about services
3. Agent explains options
4. Customer decides to purchase!
5. **Switch to "New Sale" mode**
6. Service grid appears
7. Enter property area
8. Select service
9. Complete as new sale

**Result:** Flexibility to adapt mid-call

---

## 🎨 Visual Design

### Call Type Buttons
- **Large, prominent** at top of form
- **Icon + Label + Description** for clarity
- **Active state**: Blue gradient with glow
- **Hover effects**: Lift and glow
- **Smooth transitions** between modes

### Smart Form Adaptation
- **Instant show/hide** of relevant sections
- **No page reload** required
- **Validation** adapts to call type
- **Clear visual feedback**

---

## ✅ Validation Rules

### New Sale Mode
- ✅ Customer info required
- ✅ Address required
- ✅ **Property area required**
- ✅ **Service selection required**
- ✅ New sale type required
- ✅ Scheduling required
- ✅ Notes optional

### Service Call Mode
- ✅ Customer info required
- ✅ Address required
- ✅ Property area **optional**
- ✅ Service selection **NOT required**
- ✅ Service issue type required
- ✅ Scheduling required
- ✅ Notes **recommended** (not required but helpful)

---

## 🧪 Testing Checklist

### Test New Sale Flow
- [ ] Form loads with New Sale selected by default
- [ ] Service grid visible
- [ ] Property area field shows required indicator
- [ ] Select service → appears in summary box
- [ ] New Sale Type dropdown visible and required
- [ ] Submit without service → validation error
- [ ] Submit with all fields → success

### Test Service Call Flow
- [ ] Click "Service Call" button
- [ ] Service grid hides immediately
- [ ] Service Issue Type dropdown appears
- [ ] Selected service clears (if any)
- [ ] Property area no longer required
- [ ] Select "Other" → text field appears
- [ ] Submit without service selection → success

### Test Mode Switching
- [ ] Switch New Sale → Service → fields update
- [ ] Switch Service → New Sale → fields update
- [ ] Selected service clears when switching to Service
- [ ] Toast notifications appear
- [ ] Can switch multiple times before submit
- [ ] Form resets to New Sale after submission

---

## 📱 Access the Updated Form

**Wait 30-60 seconds** for GitHub Pages deployment:

```
https://zakpestsos.github.io/engage-intake/frontend-intake/index-cyberpunk-v2.html?token=YOUR_TOKEN
```

**Hard refresh:**
- Windows: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

---

## 💡 Benefits

### For Sales Agents
- ✅ Clear workflow for new customer acquisitions
- ✅ Service catalog visible and searchable
- ✅ Pricing tiers automatic based on property size

### For Service Agents
- ✅ No confusion about "which service to select"
- ✅ Focus on issue description
- ✅ Faster call handling

### For Managers
- ✅ Clear data on New Sales vs Service Calls
- ✅ Better reporting capabilities
- ✅ Understand call center workload mix

### For Clients
- ✅ Dashboard shows call type clearly
- ✅ Know which leads need follow-up sales calls
- ✅ Track service vs sales call volume

---

## 📊 Dashboard Display

Leads will show in dashboard with clear call type in Reason column:

**New Sale Leads:**
- "New Sale - Initial Purchase"
- "New Sale - Additional Service"  
- "New Sale - Upgrade"

**Service Leads:**
- "Service - Schedule Appointment"
- "Service - Billing Question"
- "Service - Service Complaint"
- etc.

**Filtering:** Can filter by "New Sale" or "Service" prefix to segment leads.

---

## 🔧 Technical Details

### Files Modified
- `frontend-intake/index-cyberpunk-v2.html` - Added call type selector, split reason dropdowns
- `frontend-intake/styles-cyberpunk-v2.css` - Styled call type buttons
- `frontend-intake/app-cyberpunk-v2.js` - Show/hide logic, validation, submission

### State Management
- `currentCallType` variable: 'new-sale' or 'service'
- Updates on button click
- Controls validation and field visibility
- Resets to 'new-sale' after form submission

### Backward Compatibility
- ✅ Uses existing spreadsheet columns
- ✅ Existing dashboards work without changes
- ✅ Historical data unaffected
- ✅ Old leads display normally

---

## 🎯 Key Takeaways

1. **Simpler Workflows:** Each call type has a clear, purpose-specific form
2. **No New Columns:** Works with existing database schema
3. **Agent Friendly:** Visual, intuitive, easy to learn
4. **Flexible:** Can switch modes mid-call if needed
5. **Better Data:** Clear categorization of new sales vs service issues

---

**Created:** October 9, 2025  
**Status:** ✅ Deployed and Live  
**Version:** 2.0 - Call Type Selector  
**Form URL:** https://zakpestsos.github.io/engage-intake/frontend-intake/index-cyberpunk-v2.html?token=YOUR_TOKEN









