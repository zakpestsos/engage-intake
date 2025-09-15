/* Sheets read/write helpers */

function ensureSheetWithHeaders_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }
  
  // Only set headers if the sheet is completely empty (no data at all)
  const lastRow = sh.getLastRow();
  if (lastRow === 0) {
    // Sheet is empty, safe to add headers
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, headers.length);
  }
  // If sheet has data, don't touch it - just return the existing sheet
  return sh;
}

function getSheetWithHeader_(name, headers) {
  const ss = getSpreadsheet_();
  const sheet = ensureSheetWithHeaders_(ss, name, headers);
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
  const { sheet, header } = getSheetWithHeader_(SHEET_PRODUCTS, PRODUCTS_HEADERS);
  const values = sheet.getDataRange().getValues();
  const idxCompany = header.indexOf('Company_Name');
  const idxSku = header.indexOf('Product_SKU');
  const idxName = header.indexOf('Product_Name');
  const idxInitialPrice = header.indexOf('Initial_Price');
  const idxRecurringPrice = header.indexOf('Recurring_Price');
  const idxActive = header.indexOf('Active');
  const idxSqFtMin = header.indexOf('sq_ft_min');
  const idxSqFtMax = header.indexOf('sq_ft_max');
  const map = {};
  values.slice(1).forEach(r => {
    const active = String(r[idxActive]).toLowerCase() === 'true';
    if (!active) return;
    const company = String(r[idxCompany] || '');
    if (!company) return;
    if (!map[company]) map[company] = [];
    map[company].push({
      sku: String(r[idxSku] || ''),
      name: String(r[idxName] || ''),
      initialPrice: Number(r[idxInitialPrice] || 0),
      recurringPrice: Number(r[idxRecurringPrice] || 0),
      sqFtMin: Number(r[idxSqFtMin] || 0),
      sqFtMax: Number(r[idxSqFtMax] || 0)
    });
  });
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
  row[idx['Address_Street']] = String(addr.street || '');
  row[idx['Address_City']] = String(addr.city || '');
  row[idx['Address_State']] = String(addr.state || '');
  row[idx['Address_Postal']] = String(addr.postal || '');
  row[idx['Reason_For_Call']] = reason;
  row[idx['Reason_Custom']] = String(payload.reasonCustom || '');
  row[idx['Product_SKU']] = prodSku;
  row[idx['Product_Name']] = prodName;
  row[idx['Initial_Price']] = initialPrice;
  row[idx['Recurring_Price']] = recurringPrice;
  row[idx['Square_Footage']] = squareFootage;
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

  return { ok: true, id, createdAt: created, status };
}

function listLeadsForCompany_(companyName, query) {
  const { sheet, header } = getSheetWithHeader_(SHEET_LEADS, LEADS_HEADERS);
  const values = sheet.getDataRange().getValues();
  const idx = {};
  header.forEach((h, i) => idx[h] = i);

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
      customerName: (row[idx['Customer_First_Name']] || '') + ' ' + (row[idx['Customer_Last_Name']] || ''),
      customerPhone: row[idx['Phone_Number']],
      city: row[idx['Address_City']],
      state: row[idx['Address_State']],
      reason: row[idx['Reason_For_Call']],
      reasonCustom: row[idx['Reason_Custom']],
      product: row[idx['Product_Name']],
      productSku: row[idx['Product_SKU']],
      initialPrice: Number(row[idx['Initial_Price']] || 0),
      recurringPrice: Number(row[idx['Recurring_Price']] || 0),
      squareFootage: Number(row[idx['Square_Footage']] || 0),
      leadValue: Number(row[idx['Lead_Value']] || 0),
      status: row[idx['Status']],
      acceptedAt: row[idx['Accepted_At']],
      completedAt: row[idx['Completed_At']],
      cancelledAt: row[idx['Cancelled_At']],
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

function updateLeadStatusForCompany_(companyName, id, status, actor) {
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
  if (status === 'ACCEPTED') row[idx['Accepted_At']] = ts;
  if (status === 'COMPLETED') row[idx['Completed_At']] = ts;
  if (status === 'CANCELLED') row[idx['Cancelled_At']] = ts;

  sheet.getRange(rowIndex, 1, 1, header.length).setValues([row]);

  addAuditLog_({
    actor: actor || 'client ui',
    action: status === 'ACCEPTED' ? 'ACCEPT_LEAD' : status === 'COMPLETED' ? 'COMPLETE_LEAD' : status === 'CANCELLED' ? 'CANCEL_LEAD' : 'UPDATE_STATUS',
    leadId: id,
    summary: 'Lead ' + id + ' set to ' + status
  });

  return { ok: true, id, status, updatedAt: ts };
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
