# Jem Pest Solutions - Engage CRM Setup

## 🎉 Company Profile Added!

**Company Name:** Jem Pest Solutions  
**Access Token:** `a6f6f569cf05dfde4db61b8f7b3c7926`  
**Contact Email:** info@jempestsolutions.com  
**Products Added:** 27 service offerings

---

## 📋 Quick Start - Add Company to System

### Option 1: Run Apps Script Function (Recommended)

1. **Open the Apps Script Editor:**
   - Visit: https://script.google.com/home/projects/1mk5ziDWSMMJq9PrlAOBFjJHoZEksLYV9qwNdaV7f4kVjdJRW_c6sWOwh/edit
   
2. **Run the Setup Function:**
   - In the editor, select `addJemPestSolutions` from the function dropdown
   - Click the ▶️ Run button
   - Authorize the script if prompted
   - Check the Execution Log for success message and generated URLs

3. **View the Results:**
   - The function will add the company and all 27 products to your spreadsheet
   - Check the execution log for the generated token and URLs

### Option 2: Import CSV Files (Manual)

If you prefer to import the data manually:

1. **Company Data:**
   - File: `jem-pest-solutions-company.csv`
   - Import into the `Companies` sheet
   - Append as new row (don't overwrite existing companies)

2. **Products Data:**
   - File: `jem-pest-solutions-products.csv`
   - Import into the `Products` sheet
   - Append as new rows (don't overwrite existing products)

---

## 🔗 Company-Specific URLs

### Intake Form (For Call Agents)
```
https://zakpestsos.github.io/engage-intake/frontend-intake/?token=a6f6f569cf05dfde4db61b8f7b3c7926
```

**Use This For:**
- Call center agents taking customer calls
- Adding new leads to the system
- Recording customer information and service requests

### Dashboard (For Jem Pest Solutions Team)
```
https://zakpestsos.github.io/engage-intake/frontend-dashboard/?token=a6f6f569cf05dfde4db61b8f7b3c7926
```

**Use This For:**
- Viewing all leads for Jem Pest Solutions
- Accepting, completing, or canceling leads
- Analytics and production value tracking
- Lead management and status updates

---

## 📦 Products & Pricing Overview

### Home Protection Plans
| SKU | Product | Initial | Recurring |
|-----|---------|---------|-----------|
| JPS-HPP-001 | Home Protection Plan (Quarterly) | $225 | $55/mo |
| JPS-HPP-MOS-001 | HPP + Mosquito Bundle | $275 | $55/mo |
| JPS-HPP-TER-001 | HPP + Termite Bundle | $724 | $85/mo |
| JPS-HPP-RCH-001 | HPP - Roach Coverage | $550 | $55/mo |
| JPS-HPP-RDT-001 | HPP - Rodent (Mice) | $550 | $55/mo |
| JPS-HPP-RDT-002 | HPP - Rodent (Rats) | $700 | $55/mo |

### One-Time Services
| SKU | Product | Price |
|-----|---------|-------|
| JPS-OT-GEN-001 | One-Time General Treatment | $225 |
| JPS-RDT-30D-001 | Rodent Trapping 30-Day (Mice) | $550 |
| JPS-RDT-30D-002 | Rodent Trapping 30-Day (Rats) | $700 |
| JPS-RCH-30D-001 | Roach Cleanout 30-Day | $550 |

### Mosquito Control
| SKU | Product | Price |
|-----|---------|-------|
| JPS-MOS-OT-001 | Mosquito Control (One-Time) | $129 |
| JPS-MOS-FS-001 | Mosquito Control (Full Season) | $89 |

### Bed Bug Services
| SKU | Product | Initial | Recurring |
|-----|---------|---------|-----------|
| JPS-BB-INSP-001 | Bed Bug Inspection | FREE | - |
| JPS-BB-PREV-001 | Bed Bug Prevention (Monthly) | $225 | $150/mo |
| JPS-BB-MON-001 | Bed Bug Monitoring (Monthly) | $175 | $125/mo |

*Note: Bed bug services limited to ≤1,500 sq ft properties*

### Termite Services
| SKU | Product | Initial | Recurring |
|-----|---------|---------|-----------|
| JPS-TER-INSP-001 | Termite Inspection | FREE | - |
| JPS-TER-TPP-001 | Termite Protection Plan (Quarterly) | $599 | $30/mo |
| JPS-TER-MON-001 | Termite Monitoring (Annual) | $199 | - |

### Wildlife Services
| SKU | Product | Initial | Recurring |
|-----|---------|---------|-----------|
| JPS-SNK-001 | Snake Control (Monthly) | $450 | $175/mo |
| JPS-BAT-INSP-001 | Bat Exclusion Inspection | FREE | - |
| JPS-SQR-INSP-001 | Squirrel/Raccoon Inspection | FREE | - |

### Bird Services (By Height)
| SKU | Product | Price |
|-----|---------|-------|
| JPS-BRD-CLN-001 | Bird Vent Cleanout (Ground) | $275 |
| JPS-BRD-CLN-002 | Bird Vent Cleanout (Above 1st Floor) | $325 |
| JPS-BRD-CLN-003 | Bird Vent Cleanout (Above 2nd Floor) | $375 |

### Groundhog Services
| SKU | Product | Price |
|-----|---------|-------|
| JPS-GH-TRAP-001 | Groundhog Trapping (Setup) | $275 |
| JPS-GH-REM-001 | Groundhog Removal (Per Animal) | $150 |
| JPS-GH-REBAIT-001 | Groundhog Trap Re-Bait | $75 |

---

## 🧪 Testing the Setup

### Test the Configuration API
```bash
curl "https://script.google.com/a/macros/pest-sos.com/s/AKfycbwwQzm1JKLd_cv7T5niv44KGI_Y5Q24xGomIYJXCUgzpJJGD9kJ2hL_w4-SNdhoPzPV/exec?api=config&token=a6f6f569cf05dfde4db61b8f7b3c7926&callback=test"
```

This should return JSON with:
- `company`: Object with name "Jem Pest Solutions"
- `products`: Array of 27 products with pricing and sq ft ranges

### Test the Intake Form
1. Open the intake form URL
2. Verify "Jem Pest Solutions" appears in the header
3. Enter a test property address
4. Enter area (e.g., 5000 sq ft)
5. Verify products appear in dropdown
6. Select a product and verify pricing displays correctly

### Test the Dashboard
1. Open the dashboard URL
2. Verify it shows "Jem Pest Solutions Dashboard"
3. Create a test lead from the intake form
4. Verify the lead appears in the dashboard
5. Test accepting/completing the lead

---

## 📈 Spreadsheet Access

**Spreadsheet URL:** (Will be shown in Apps Script execution log)

The spreadsheet contains these sheets:
- **Companies** - Company profiles with access tokens
- **Products** - All 27 service offerings for Jem Pest Solutions
- **Leads** - Customer intake records
- **Users** - User access management
- **Audit_Log** - Activity tracking

---

## 🚀 Deployment Status

### Apps Script Backend
- ✅ Script ID: `1mk5ziDWSMMJq9PrlAOBFjJHoZEksLYV9qwNdaV7f4kVjdJRW_c6sWOwh`
- ✅ Latest deployment: Version @61
- ✅ Setup function available: `addJemPestSolutions()`
- ✅ Test function available: `testJemPestSolutionsConfig()`

### GitHub Pages Frontend
- ✅ Repository: https://github.com/zakpestsos/engage-intake
- ✅ Intake Form: https://zakpestsos.github.io/engage-intake/frontend-intake/
- ✅ Dashboard: https://zakpestsos.github.io/engage-intake/frontend-dashboard/
- ✅ Token parameter support enabled

---

## 📞 Support & Next Steps

### Immediate Next Steps:
1. ✅ Run the `addJemPestSolutions()` function in Apps Script
2. ✅ Verify data appears in the spreadsheet
3. ✅ Test the intake form URL
4. ✅ Test the dashboard URL
5. ✅ Share URLs with Jem Pest Solutions team

### Future Configuration:
- To update products: Edit the `Products` sheet directly
- To add more companies: Use the same pattern with new tokens
- To modify pricing: Update the `Products` sheet (set Active=TRUE/FALSE)
- To track users: Add entries to the `Users` sheet

---

## 🔐 Security Notes

**Token Security:**
- Keep the access token secure - it grants full access to company data
- Don't share the token publicly
- Each company has a unique token for data isolation
- Tokens are 32-character hex strings for security

**URL Sharing:**
- Intake form URL: Share with call center agents
- Dashboard URL: Share only with Jem Pest Solutions management
- Never expose tokens in public websites or emails

---

**Generated:** $(date)  
**Script Version:** 2025-01-15  
**Status:** Ready for deployment

