/* Sheets read/write helpers */

function ensureSheetWithHeaders_(ss, name, headers) {
  console.log('🔍 DEBUGGING - ensureSheetWithHeaders_ called for sheet:', name);
  let sh = ss.getSheetByName(name);
  if (!sh) {
    console.log('🔍 DEBUGGING - Sheet does not exist, creating new sheet:', name);
    // Only create new sheet if it doesn't exist at all
    sh = ss.insertSheet(name);
    // Add headers to the new empty sheet
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, headers.length);
  } else {
    console.log('🔍 DEBUGGING - Sheet exists, returning as-is:', name, 'Last row:', sh.getLastRow());
  }
  // If sheet already exists, NEVER modify it - just return it as-is
  return sh;
}

function getSheetWithHeader_(name, headers) {
  const ss = getSpreadsheet_();
  
  // NUCLEAR OPTION: Just get the sheet directly, never call ensureSheetWithHeaders_
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    console.log('🚨 CRITICAL: Sheet does not exist:', name);
    throw new Error('Sheet "' + name + '" does not exist. Please create it manually.');
  }
  
  console.log('✅ SAFE: Using existing sheet without modification:', name);
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const mapByHeader = {};
  header.forEach((h, i) => mapByHeader[h] = i);
  return { sheet, header, mapByHeader };
}

function getCompanies_() {
  const { sheet, header } = getSheetWithHeader_(SHEET_COMPANIES, COMPANIES_HEADERS);
  const values = sheet.getDataRange().getValues();
  const nameIdx = header.indexOf('Company_Name');
  const tokenIdx = header.indexOf('Company_Access_Token');
  const res = values.slice(1).filter(r => r[nameIdx]).map(r => ({ name: r[nameIdx], token: r[tokenIdx] }));
  return res;
}

function getProductsByCompany_() {
  console.log('🔍 EMERGENCY DEBUG - getProductsByCompany_ called');
  
  // EMERGENCY BYPASS: Direct sheet access without any header checking
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(SHEET_PRODUCTS);
  
  if (!sheet) {
    console.log('🚨 EMERGENCY - Products sheet does not exist!');
    return {}; // Return empty to avoid errors
  }
  
  console.log('✅ EMERGENCY - Products sheet found, last row:', sheet.getLastRow());
  
  // Read all data directly without header validation
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    console.log('🚨 EMERGENCY - Products sheet is empty or only has headers');
    return {}; // Return empty if no data
  }
  
  // Hardcode the column indices based on your actual table structure
  const map = {};
  values.slice(1).forEach((r, rowIndex) => {
    try {
      // Your table structure: Company_Name(0), Product_SKU(1), Product_Name(2), Initial_Price(3), Recurring_Price(4), Active(5), lead_value(6), sq_ft_min(7), sq_ft_max(8)
      const active = String(r[5]).toLowerCase() === 'true';
      if (!active) return;
      const company = String(r[0] || '');
      if (!company) return;
      if (!map[company]) map[company] = [];
      map[company].push({
        sku: String(r[1] || ''),
        name: String(r[2] || ''),
        initialPrice: Number(r[3] || 0),
        recurringPrice: Number(r[4] || 0),
        sqFtMin: Number(r[7] || 0),
        sqFtMax: Number(r[8] || 0)
      });
      console.log('✅ EMERGENCY - Processed product row:', rowIndex + 1, 'Company:', company, 'Product:', r[2]);
    } catch (error) {
      console.error('❌ EMERGENCY - Error processing product row:', rowIndex + 1, error);
    }
  });
  
  console.log('✅ EMERGENCY - Final products map:', map);
  return map;
}

function getConfig_() {
  const companies = getCompanies_().map(c => ({ name: c.name })); // tokens not exposed
  const productsByCompany = getProductsByCompany_();
  return { companies, productsByCompany };
}

function createLead_(payload, actor) {
  const { sheet, header } = getSheetWithHeader_(SHEET_LEADS, LEADS_HEADERS);
  const companies = getCompanies_();
  const companyNames = new Set(companies.map(c => c.name));

  const companyName = String(payload.companyName || '').trim();
  
  if (!companyName || !companyNames.has(companyName)) {
    throw new Error('Invalid Company Name: "' + companyName + '" not found in [' + Array.from(companyNames).join(', ') + ']');
  }

  // Resolve company token to stamp
  const token = (companies.find(c => c.name === companyName) || {}).token || '';

  // Resolve product from SKU or name with square footage pricing
  const productsMap = getProductsByCompany_();
  const companyProducts = productsMap[companyName] || [];
  let prodSku = String(payload.productSku || '').trim();
  let prodName = String(payload.productName || '').trim();
  let initialPrice = toNumberOrZero_(payload.initialPrice);
  let recurringPrice = toNumberOrZero_(payload.recurringPrice);
  const squareFootage = toNumberOrZero_(payload.squareFootage);
  
  // Find matching product with square footage consideration
  let matchedProduct = null;
  if (prodName || prodSku) {
    // Filter products by name/sku first
    const candidates = companyProducts.filter(p => 
      (prodName && p.name === prodName) || (prodSku && p.sku === prodSku)
    );
    
    // If square footage provided, find the matching range
    if (squareFootage > 0 && candidates.length > 0) {
      matchedProduct = candidates.find(p => 
        squareFootage >= p.sqFtMin && squareFootage <= p.sqFtMax
      ) || candidates[0]; // fallback to first match if no range matches
    } else if (candidates.length > 0) {
      // No square footage, use first match or one without sq ft restrictions
      matchedProduct = candidates.find(p => p.sqFtMin === 0 && p.sqFtMax === 0) || candidates[0];
    }
    
    if (matchedProduct) {
      prodSku = matchedProduct.sku;
      prodName = matchedProduct.name;
      if (!initialPrice) initialPrice = matchedProduct.initialPrice;
      if (!recurringPrice) recurringPrice = matchedProduct.recurringPrice;
    }
  }

  const leadValue = payload.leadValue !== '' && payload.leadValue != null ? toNumberOrZero_(payload.leadValue) : (initialPrice || 0);

  const reason = String(payload.reasonForCall || '').trim() || 'New Sale';
  const status = (reason === 'Cancellation') ? 'CANCELLED' : 'NEW';

  const row = [];
  const id = uuid_();
  const created = nowIso_();
  const updated = created;
  const addr = payload.address || {};
  const acceptedAt = '';
  const completedAt = '';
  const cancelledAt = (status === 'CANCELLED') ? created : '';

  const idx = {};
  header.forEach((h, i) => idx[h] = i);
  // Prepare row with correct length
  for (let i = 0; i < header.length; i++) row[i] = '';

  row[idx['Lead_ID']] = id;
  row[idx['Created_At']] = created;
  row[idx['Updated_At']] = updated;
  row[idx['Company_Name']] = companyName;
  row[idx['Customer_First_Name']] = String(payload.customerFirstName || '');
  row[idx['Customer_Last_Name']] = String(payload.customerLastName || '');
  row[idx['Phone_Number']] = String(payload.customerPhone || '');
  row[idx['Customer_Email']] = String(payload.customerEmail || '');
  row[idx['Address_Street']] = String(addr.street || '');
  row[idx['Address_City']] = String(addr.city || '');
  row[idx['Address_State']] = String(addr.state || '');
  row[idx['Address_Postal']] = String(addr.postal || '');
  row[idx['Reason_For_Call']] = reason;
  row[idx['Reason_Custom']] = String(payload.reasonCustom || '');
  row[idx['Scheduling_Told']] = String(payload.schedulingTold || '');
  row[idx['Product_SKU']] = prodSku;
  row[idx['Product_Name']] = prodName;
  row[idx['Initial_Price']] = initialPrice;
  row[idx['Recurring_Price']] = recurringPrice;
  row[idx['sq_ft']] = squareFootage;
  row[idx['Lead_Value']] = leadValue;
  row[idx['Status']] = status;
  row[idx['Accepted_At']] = acceptedAt;
  row[idx['Completed_At']] = completedAt;
  row[idx['Cancelled_At']] = cancelledAt;
  row[idx['Assigned_To']] = '';
  row[idx['Notes']] = String(payload.notes || '');
  row[idx['Company_Access_Token']] = token;

  // Append
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);

  addAuditLog_({
    actor: actor || 'agent ui',
    action: 'CREATE_LEAD',
    leadId: id,
    summary: 'Lead created for ' + companyName + ' (' + reason + ')'
  });

  // Send SMS notification
  try {
    sendLeadSMS_(companyName, {
      leadId: id,
      customerFirstName: String(payload.customerFirstName || ''),
      customerLastName: String(payload.customerLastName || ''),
      phoneNumber: String(payload.customerPhone || ''),
      customerEmail: String(payload.customerEmail || ''),
      addressStreet: String(addr.street || ''),
      addressCity: String(addr.city || ''),
      addressState: String(addr.state || ''),
      addressPostal: String(addr.postal || ''),
      sqFt: squareFootage,
      productName: prodName,
      initialPrice: initialPrice,
      reasonForCall: reason,
      schedulingTold: String(payload.schedulingTold || ''),
      notes: String(payload.notes || '')
    });
  } catch (smsError) {
    console.error('SMS notification failed (non-fatal): ' + smsError.message);
  }

  // Send email notification
  try {
    sendNewLeadNotification_({
      leadId: id,
      customerName: (String(payload.customerFirstName || '') + ' ' + String(payload.customerLastName || '')).trim() || 'Unknown',
      customerPhone: String(payload.customerPhone || ''),
      customerEmail: String(payload.customerEmail || ''),
      productName: prodName,
      addressFull: [
        String(addr.street || ''),
        String(addr.city || ''),
        String(addr.state || ''),
        String(addr.postal || '')
      ].filter(Boolean).join(', '),
      leadValue: leadValue
    }, companyName);
  } catch (emailError) {
    console.error('Email notification failed (non-fatal): ' + emailError.message);
  }

  return { ok: true, id, createdAt: created, status };
}

function listLeadsForCompany_(companyName, query) {
  const { sheet, header } = getSheetWithHeader_(SHEET_LEADS, LEADS_HEADERS);
  const values = sheet.getDataRange().getValues();
  const idx = {};
  header.forEach((h, i) => idx[h] = i);
  console.log('🔍 HEADER DEBUG - Available headers:', header);
  console.log('🔍 INDEX DEBUG - Customer_First_Name index:', idx['Customer_First_Name']);
  console.log('🔍 INDEX DEBUG - Customer_Last_Name index:', idx['Customer_Last_Name']);

  const statusFilter = (query && query.status) ? String(query.status).toUpperCase() : '';
  const fromDate = clampDate_(query && query.from);
  const toDate = clampDate_(query && query.to);

  const res = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (String(row[idx['Company_Name']]) !== companyName) continue;
    if (statusFilter && String(row[idx['Status']]).toUpperCase() !== statusFilter) continue;

    const createdAtStr = String(row[idx['Created_At']]);
    const createdAt = clampDate_(createdAtStr);
    if (fromDate && createdAt && createdAt < fromDate) continue;
    if (toDate && createdAt && createdAt > toDate) continue;

    res.push({
      id: row[idx['Lead_ID']],
      createdAt: createdAtStr,
      updatedAt: row[idx['Updated_At']],
      customerName: (() => {
        const firstName = row[idx['Customer_First_Name']] || '';
        const lastName = row[idx['Customer_Last_Name']] || '';
        console.log('🔍 CUSTOMER NAME DEBUG - Row:', r, 'First:', firstName, 'Last:', lastName, 'Type First:', typeof firstName, 'Type Last:', typeof lastName);
        return String(firstName) + ' ' + String(lastName);
      })(),
      customerPhone: row[idx['Phone_Number']],
      customerEmail: row[idx['Customer_Email']],
      addressStreet: row[idx['Address_Street']],
      city: row[idx['Address_City']],
      state: row[idx['Address_State']],
      addressPostal: row[idx['Address_Postal']],
      reason: row[idx['Reason_For_Call']],
      reasonCustom: row[idx['Reason_Custom']],
      schedulingTold: row[idx['Scheduling_Told']],
      product: row[idx['Product_Name']],
      productSku: row[idx['Product_SKU']],
      initialPrice: Number(row[idx['Initial_Price']] || 0),
      recurringPrice: Number(row[idx['Recurring_Price']] || 0),
      squareFootage: Number(row[idx['sq_ft']] || 0),
      leadValue: Number(row[idx['Lead_Value']] || 0),
      status: row[idx['Status']],
      acceptedAt: row[idx['Accepted_At']],
      completedAt: row[idx['Completed_At']],
      cancelledAt: row[idx['Cancelled_At']],
      assignedTo: row[idx['Assigned_To']] || '',
      notes: row[idx['Notes']]
    });
  }
  // Sort newest first
  res.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return res;
}

function findLeadRowIndexById_(id) {
  const { sheet } = getSheetWithHeader_(SHEET_LEADS, LEADS_HEADERS);
  const values = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues(); // first col Lead_ID
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === id) return i + 1; // 1-based
  }
  return -1;
}

function updateLeadStatusForCompany_(companyName, id, status, actor, userEmail) {
  status = String(status || '').toUpperCase();
  if (!['NEW', 'ACCEPTED', 'COMPLETED', 'CANCELLED'].includes(status)) throw new Error('Invalid status');

  const { sheet, header } = getSheetWithHeader_(SHEET_LEADS, LEADS_HEADERS);
  const rowIndex = findLeadRowIndexById_(id);
  if (rowIndex < 0) throw new Error('Lead not found');

  const row = sheet.getRange(rowIndex, 1, 1, header.length).getValues()[0];
  const idx = {};
  header.forEach((h, i) => idx[h] = i);

  if (String(row[idx['Company_Name']]) !== companyName) {
    throw new Error('Lead does not belong to company');
  }

  const ts = nowIso_();
  row[idx['Status']] = status;
  row[idx['Updated_At']] = ts;
  
  // Track who performed the status change
  if (status === 'ACCEPTED') {
    row[idx['Accepted_At']] = ts;
    if (userEmail) row[idx['Accepted_By']] = userEmail;
  }
  if (status === 'COMPLETED') {
    row[idx['Completed_At']] = ts;
    if (userEmail) row[idx['Completed_By']] = userEmail;
  }
  if (status === 'CANCELLED') {
    row[idx['Cancelled_At']] = ts;
    if (userEmail) row[idx['Cancelled_By']] = userEmail;
  }

  sheet.getRange(rowIndex, 1, 1, header.length).setValues([row]);

  addAuditLog_({
    actor: userEmail || actor || 'client ui',
    action: status === 'ACCEPTED' ? 'ACCEPT_LEAD' : status === 'COMPLETED' ? 'COMPLETE_LEAD' : status === 'CANCELLED' ? 'CANCEL_LEAD' : 'UPDATE_STATUS',
    leadId: id,
    summary: 'Lead ' + id + ' set to ' + status + (userEmail ? ' by ' + userEmail : '')
  });

  return { ok: true, id, status, updatedAt: ts };
}

/**
 * Update lead assignment
 */
function updateLeadAssignment_(companyName, id, assignedTo, actor) {
  const { sheet, header } = getSheetWithHeader_(SHEET_LEADS, LEADS_HEADERS);
  const rowIndex = findLeadRowIndexById_(id);
  if (rowIndex < 0) throw new Error('Lead not found');

  const row = sheet.getRange(rowIndex, 1, 1, header.length).getValues()[0];
  const idx = {};
  header.forEach((h, i) => idx[h] = i);

  if (String(row[idx['Company_Name']]) !== companyName) {
    throw new Error('Lead does not belong to company');
  }

  const ts = nowIso_();
  row[idx['Assigned_To']] = assignedTo || '';
  row[idx['Updated_At']] = ts;

  sheet.getRange(rowIndex, 1, 1, header.length).setValues([row]);

  addAuditLog_({
    actor: actor || 'client ui',
    action: 'ASSIGN_LEAD',
    leadId: id,
    summary: 'Lead ' + id + ' assigned to ' + (assignedTo || 'Unassigned')
  });

  return { ok: true, id, assignedTo, updatedAt: ts };
}

function getStatsForCompany_(companyName, query) {
  const leads = listLeadsForCompany_(companyName, query || {});
  // Aggregations
  const countsByStatus = { NEW: 0, ACCEPTED: 0, COMPLETED: 0, CANCELLED: 0 };
  const byDay = {}; // YYYY-MM-DD -> count
  const byReason = {}; // reason -> count
  const production = {
    capturedTotal: 0,   // NEW + ACCEPTED
    committedTotal: 0   // ACCEPTED + COMPLETED
  };
  leads.forEach(ld => {
    const d = (ld.createdAt || '').slice(0, 10);
    byDay[d] = (byDay[d] || 0) + 1;
    const reason = ld.reason || 'Other';
    byReason[reason] = (byReason[reason] || 0) + 1;

    const val = toNumberOrZero_(ld.leadValue);
    countsByStatus[ld.status] = (countsByStatus[ld.status] || 0) + 1;
    if (ld.status === 'NEW' || ld.status === 'ACCEPTED') production.capturedTotal += val;
    if (ld.status === 'ACCEPTED' || ld.status === 'COMPLETED') production.committedTotal += val;
  });

  // Transform to arrays for charts
  const leadsByDay = Object.keys(byDay).sort().map(k => ({ date: k, count: byDay[k] }));
  const leadsByReason = Object.keys(byReason).sort().map(k => ({ reason: k, count: byReason[k] }));

  // Monthly PV
  const pvByMonthMap = {};
  leads.forEach(ld => {
    const month = (ld.createdAt || '').slice(0, 7); // YYYY-MM
    pvByMonthMap[month] = (pvByMonthMap[month] || 0) + toNumberOrZero_(ld.leadValue);
  });
  const productionValueByMonth = Object.keys(pvByMonthMap).sort().map(m => ({ month: m, total: pvByMonthMap[m] }));

  return {
    counts: countsByStatus,
    productionValue: production,
    leadsByDay,
    leadsByReason,
    productionValueByMonth
  };
}

function addAuditLog_(entry) {
  const { sheet, header } = getSheetWithHeader_(SHEET_AUDIT, AUDIT_HEADERS);
  const row = [];
  const idx = {};
  header.forEach((h, i) => idx[h] = i);
  for (let i = 0; i < header.length; i++) row[i] = '';
  row[idx['Log_ID']] = uuid_();
  row[idx['At']] = nowIso_();
  row[idx['Actor']] = String(entry.actor || '');
  row[idx['Action']] = String(entry.action || '');
  row[idx['Lead_ID']] = String(entry.leadId || '');
  row[idx['Summary']] = String(entry.summary || '');
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}

/**
 * Send SMS notification via email-to-SMS gateway
 * @param {string} companyName - Company receiving the lead
 * @param {object} leadData - Lead details
 */
function sendLeadSMS_(companyName, leadData) {
  try {
    // Get company's SMS numbers
    const ss = getSpreadsheet_();
    const companiesSheet = ss.getSheetByName(SHEET_COMPANIES);
    const data = companiesSheet.getDataRange().getValues();
    const headers = data[0];
    
    const nameIdx = headers.indexOf('Company_Name');
    const smsIdx = headers.indexOf('SMS_Notification_Numbers');
    
    let smsNumbers = '';
    for (let i = 1; i < data.length; i++) {
      if (data[i][nameIdx] === companyName) {
        smsNumbers = data[i][smsIdx] || '';
        break;
      }
    }
    
    // If no SMS numbers configured, skip
    if (!smsNumbers || smsNumbers.trim() === '') {
      console.log('No SMS numbers configured for: ' + companyName);
      return;
    }
    
    // Parse multiple numbers (comma-separated)
    const recipients = smsNumbers.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
    
    if (recipients.length === 0) {
      console.log('No valid SMS recipients for: ' + companyName);
      return;
    }
    
    // Format SMS message
    const message = formatLeadSMS_(leadData);
    
    // Send to each recipient
    recipients.forEach(function(recipient) {
      try {
        MailApp.sendEmail({
          to: recipient,
          subject: '', // SMS gateways ignore subject
          body: message
        });
        console.log('SMS sent to: ' + recipient);
      } catch (e) {
        console.error('Failed to send SMS to ' + recipient + ': ' + e.message);
      }
    });
    
  } catch (error) {
    console.error('Error sending lead SMS: ' + error.message);
    // Don't throw - SMS failure shouldn't break lead creation
  }
}

/**
 * Format lead data into professional SMS message
 * @param {object} lead - Lead details
 * @return {string} Formatted message
 */
function formatLeadSMS_(lead) {
  const lines = [];
  
  lines.push('🔔 NEW LEAD');
  lines.push('');
  lines.push('Customer: ' + lead.customerFirstName + ' ' + lead.customerLastName);
  lines.push('Phone: ' + lead.phoneNumber);
  
  if (lead.customerEmail) {
    lines.push('Email: ' + lead.customerEmail);
  }
  
  lines.push('');
  lines.push('Address:');
  lines.push(lead.addressStreet);
  lines.push(lead.addressCity + ', ' + lead.addressState + ' ' + lead.addressPostal);
  
  if (lead.sqFt) {
    lines.push('Property: ' + lead.sqFt + ' sq ft');
  }
  
  lines.push('');
  
  if (lead.productName) {
    lines.push('Service: ' + lead.productName);
    if (lead.initialPrice) {
      lines.push('Price: $' + lead.initialPrice);
    }
  }
  
  if (lead.reasonForCall && lead.reasonForCall !== 'Other…') {
    lines.push('');
    lines.push('Reason: ' + lead.reasonForCall);
  }
  
  if (lead.schedulingTold) {
    lines.push('Scheduling: ' + lead.schedulingTold);
  }
  
  if (lead.notes) {
    lines.push('');
    lines.push('Notes: ' + lead.notes);
  }
  
  lines.push('');
  lines.push('Lead ID: ' + lead.leadId);
  lines.push('Submitted: ' + new Date().toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: 'numeric', 
    minute: '2-digit'
  }));
  
  return lines.join('\n');
}

/* ================================
   COMMENTS SYSTEM FUNCTIONS
   ================================ */

/**
 * Get all comments for a specific lead
 * @param {string} leadId - Lead ID
 * @returns {Array} Array of comment objects sorted by Created_At DESC
 */
function getCommentsForLead_(leadId) {
  try {
    const { sheet, header } = getSheetWithHeader_(SHEET_COMMENTS, COMMENTS_HEADERS);
    const values = sheet.getDataRange().getValues();
    
    if (values.length <= 1) {
      return []; // No comments yet
    }
    
    const commentIdIdx = header.indexOf('Comment_ID');
    const leadIdIdx = header.indexOf('Lead_ID');
    const userEmailIdx = header.indexOf('User_Email');
    const userNameIdx = header.indexOf('User_Name');
    const createdAtIdx = header.indexOf('Created_At');
    const commentTextIdx = header.indexOf('Comment_Text');
    
    const comments = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (String(row[leadIdIdx] || '').trim() === String(leadId).trim()) {
        comments.push({
          commentId: row[commentIdIdx],
          leadId: row[leadIdIdx],
          userEmail: row[userEmailIdx] || '',
          userName: row[userNameIdx] || '',
          createdAt: row[createdAtIdx],
          commentText: row[commentTextIdx] || ''
        });
      }
    }
    
    // Sort by createdAt DESC (newest first)
    comments.sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return dateB - dateA;
    });
    
    return comments;
  } catch (error) {
    console.error('Error getting comments:', error);
    return [];
  }
}

/**
 * Add a new comment to a lead
 * @param {string} leadId - Lead ID
 * @param {string} userEmail - User's email
 * @param {string} userName - User's full name
 * @param {string} commentText - Comment text
 * @returns {Object} Created comment object
 */
function addComment_(leadId, userEmail, userName, commentText) {
  try {
    const { sheet, header } = getSheetWithHeader_(SHEET_COMMENTS, COMMENTS_HEADERS);
    
    // Validate required fields
    if (!leadId || !userEmail || !commentText) {
      throw new Error('Lead ID, user email, and comment text are required');
    }
    
    // Generate unique Comment_ID (timestamp-based)
    const now = new Date();
    const commentId = 'CMT-' + now.getTime();
    
    // Prepare new comment row
    const newRow = new Array(header.length).fill('');
    newRow[header.indexOf('Comment_ID')] = commentId;
    newRow[header.indexOf('Lead_ID')] = leadId;
    newRow[header.indexOf('User_Email')] = userEmail;
    newRow[header.indexOf('User_Name')] = userName || userEmail;
    newRow[header.indexOf('Created_At')] = now;
    newRow[header.indexOf('Comment_Text')] = commentText;
    
    // Append to sheet
    sheet.appendRow(newRow);
    
    // Return created comment
    return {
      commentId: commentId,
      leadId: leadId,
      userEmail: userEmail,
      userName: userName || userEmail,
      createdAt: now,
      commentText: commentText
    };
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
}

// ==============================
// EMAIL NOTIFICATION SYSTEM
// ==============================

function sendNewLeadNotification_(leadData, companyName) {
  try {
    // Get company contact email
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const companiesSheet = ss.getSheetByName('Companies');
    const companiesData = companiesSheet.getDataRange().getValues();
    
    let contactEmail = '';
    for (let i = 1; i < companiesData.length; i++) {
      if (companiesData[i][0] === companyName) {
        contactEmail = companiesData[i][2]; // Contact_Email column
        break;
      }
    }
    
    if (!contactEmail) {
      console.log('No contact email found for company:', companyName);
      return;
    }
    
    // Build dashboard link with lead hash
    const dashboardBaseUrl = 'https://zakpestsos.github.io/engage-intake/frontend-dashboard/';
    const dashboardLink = dashboardBaseUrl + '#lead=' + leadData.leadId;
    
    // Format values
    const customerEmail = leadData.customerEmail || 'Not provided';
    const leadValue = '$' + Number(leadData.leadValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    // Build HTML email
    const htmlBody = getEmailTemplate_()
      .replace('[CUSTOMER_NAME]', leadData.customerName)
      .replace('[CUSTOMER_PHONE]', leadData.customerPhone)
      .replace('[CUSTOMER_EMAIL]', customerEmail)
      .replace('[PRODUCT_NAME]', leadData.productName)
      .replace('[ADDRESS_FULL]', leadData.addressFull)
      .replace('[LEAD_VALUE]', leadValue)
      .replace('[DASHBOARD_LINK]', dashboardLink)
      .replace('[LEAD_ID]', leadData.leadId);
    
    // Send email
    const subject = '🔔 New Lead: ' + leadData.customerName + ' - ' + leadData.productName;
    
    MailApp.sendEmail({
      to: contactEmail,
      subject: subject,
      htmlBody: htmlBody
    });
    
    console.log('✅ Email notification sent to:', contactEmail);
    
  } catch (error) {
    console.error('❌ Failed to send email notification:', error);
    // Don't throw error - email failure shouldn't block lead creation
  }
}

function getEmailTemplate_() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { 
      font-family: 'Inter', Arial, sans-serif; 
      background: #0f172a; 
      color: #e2e8f0; 
      margin: 0; 
      padding: 0; 
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%); 
      border-radius: 12px; 
      overflow: hidden; 
    }
    .header { 
      background: linear-gradient(90deg, #1e40af 0%, #3b82f6 100%); 
      padding: 24px; 
      text-align: center; 
    }
    .header h1 { 
      color: white; 
      margin: 0; 
      font-size: 24px; 
    }
    .content { 
      padding: 32px 24px; 
    }
    .lead-info { 
      background: rgba(15, 23, 42, 0.6); 
      border: 1px solid #475569; 
      border-radius: 8px; 
      padding: 20px; 
      margin-bottom: 20px; 
    }
    .info-row { 
      display: flex; 
      justify-content: space-between; 
      margin-bottom: 12px; 
      padding-bottom: 12px; 
      border-bottom: 1px solid rgba(71, 85, 105, 0.3); 
    }
    .info-row:last-child { 
      border-bottom: none; 
      margin-bottom: 0; 
      padding-bottom: 0; 
    }
    .label { 
      color: #94a3b8; 
      font-size: 14px; 
      font-weight: 600; 
      text-transform: uppercase; 
      letter-spacing: 0.5px; 
    }
    .value { 
      color: #e2e8f0; 
      font-size: 16px; 
      font-weight: 500; 
      text-align: right; 
    }
    .value-highlight { 
      color: #10b981; 
      font-size: 20px; 
      font-weight: 700; 
    }
    .cta-button { 
      display: inline-block; 
      background: linear-gradient(45deg, #1e40af, #3b82f6); 
      color: white !important; 
      padding: 14px 32px; 
      border-radius: 8px; 
      text-decoration: none; 
      font-weight: 600; 
      margin-top: 20px; 
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); 
    }
    .footer { 
      padding: 24px; 
      text-align: center; 
      color: #64748b; 
      font-size: 13px; 
    }
    /* Mobile responsive */
    @media only screen and (max-width: 600px) {
      .info-row { 
        flex-direction: column; 
        align-items: flex-start; 
      }
      .value { 
        text-align: left; 
        margin-top: 4px; 
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 New Lead Received</h1>
    </div>
    <div class="content">
      <div class="lead-info">
        <div class="info-row">
          <span class="label">Customer</span>
          <span class="value">[CUSTOMER_NAME]</span>
        </div>
        <div class="info-row">
          <span class="label">Phone</span>
          <span class="value">[CUSTOMER_PHONE]</span>
        </div>
        <div class="info-row">
          <span class="label">Email</span>
          <span class="value">[CUSTOMER_EMAIL]</span>
        </div>
        <div class="info-row">
          <span class="label">Service Requested</span>
          <span class="value">[PRODUCT_NAME]</span>
        </div>
        <div class="info-row">
          <span class="label">Property Address</span>
          <span class="value">[ADDRESS_FULL]</span>
        </div>
        <div class="info-row">
          <span class="label">Lead Value</span>
          <span class="value-highlight">[LEAD_VALUE]</span>
        </div>
      </div>
      
      <p style="color: #cbd5e1; margin: 20px 0;">A new lead has been submitted and is ready for review in your dashboard.</p>
      
      <div style="text-align: center;">
        <a href="[DASHBOARD_LINK]" class="cta-button">View Lead in Dashboard →</a>
      </div>
    </div>
    <div class="footer">
      <p>Engage CRM | Lead Management System</p>
      <p style="margin-top: 8px; color: #475569;">Lead ID: [LEAD_ID]</p>
    </div>
  </div>
</body>
</html>`;
}
