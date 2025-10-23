/* Bootstrap, constants, utilities */

const SPREADSHEET_PROP_KEY = 'PRIMARY_SPREADSHEET_ID';

const SHEET_LEADS = 'Leads';
const SHEET_PRODUCTS = 'Products';
const SHEET_COMPANIES = 'Companies';
const SHEET_USERS = 'Users';
const SHEET_AUDIT = 'Audit_Log';
const SHEET_COMMENTS = 'Comments';

const LEADS_HEADERS = [
  'Lead_ID',
  'Created_At',
  'Updated_At',
  'Company_Name',
  'Customer_First_Name',
  'Customer_Last_Name',
  'Phone_Number',
  'Customer_Email',
  'Address_Street',
  'Address_City',
  'Address_State',
  'Address_Postal',
  'Reason_For_Call',
  'Reason_Custom',
  'Scheduling_Told',
  'Product_SKU',
  'Product_Name',
  'Initial_Price',
  'Recurring_Price',
  'sq_ft',
  'Lead_Value',
  'Status',
  'Accepted_At',
  'Completed_At',
  'Cancelled_At',
  'Assigned_To',
  'Notes',
  'Company_Access_Token',
  'Accepted_By',
  'Completed_By',
  'Cancelled_By'
];

const PRODUCTS_HEADERS = [
  'Company_Name',
  'Product_SKU',
  'Product_Name',
  'Initial_Price',
  'Recurring_Price',
  'Active',
  'lead_value',
  'sq_ft_min',
  'sq_ft_max'
];

const COMPANIES_HEADERS = [
  'Company_Name',
  'Company_Access_Token',
  'Contact_Email',
  'Notes',
  'SMS_Notification_Numbers'
];

const USERS_HEADERS = [
  'Email',
  'Password',
  'First_Name',
  'Last_Name',
  'Role',
  'Company_Name',
  'Active'
];

const AUDIT_HEADERS = [
  'Log_ID',
  'At',
  'Actor',
  'Action',
  'Lead_ID',
  'Summary'
];

const COMMENTS_HEADERS = [
  'Comment_ID',
  'Lead_ID',
  'User_Email',
  'User_Name',
  'Created_At',
  'Comment_Text'
];

// Allowed origins for CORS checks (update for your GitHub Pages domain)
const ALLOWED_ORIGINS = [
  'https://script.google.com',
  'https://sites.google.com', 
  'https://script.googleusercontent.com',
  'https://zakpestsos.github.io',
  'https://pest-sos.com',
  'https://script.google.com/a/macros/pest-sos.com',
  'https://your-org.github.io',
  'https://your-user.github.io'
];

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(SPREADSHEET_PROP_KEY);
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (err) {
      // fall through to recreate
    }
  }
  // If not set, create on first run via setup()
  throw new Error('Spreadsheet not initialized. Run setup().');
}

function setSpreadsheet_(ss) {
  PropertiesService.getScriptProperties().setProperty(SPREADSHEET_PROP_KEY, ss.getId());
}

function nowIso_() {
  return new Date().toISOString();
}

function uuid_() {
  return Utilities.getUuid();
}

function toNumberOrZero_(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function clampDate_(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt;
}

function sanitizeStr_(s) {
  if (s == null) return '';
  return String(s)
    .replace(/[&<>"'`=\/]/g, function (c) {
      return ({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;',
        '`':'&#96;',
        '=':'&#61;',
        '/':'&#47;'
      })[c] || c;
    });
}

// Simple token → company name resolver (throws on invalid)
function companyFromToken_(token) {
  if (!token) throw new Error('Missing token');
  const { sheet } = getSheetWithHeader_(SHEET_COMPANIES, COMPANIES_HEADERS);
  const values = sheet.getDataRange().getValues();
  const header = values[0];
  const tokenIdx = header.indexOf('Company_Access_Token');
  const nameIdx = header.indexOf('Company_Name');
  for (let r = 1; r < values.length; r++) {
    if (values[r][tokenIdx] && String(values[r][tokenIdx]) === token) {
      return String(values[r][nameIdx]);
    }
  }
  throw new Error('Invalid token');
}

function allowOrigin_(e) {
  const origin = (e && e.headers && e.headers.origin) ? String(e.headers.origin) : '';
  const ok = ALLOWED_ORIGINS.some(o => origin && origin.toLowerCase().startsWith(o.toLowerCase()));
  return { origin, ok };
}

// HTMLService entrypoints
function doGet(e) {
  // Setup route for adding companies
  const setup = (e && e.parameter && e.parameter.setup) ? e.parameter.setup : '';
  if (setup === 'jem-pest-solutions') {
    try {
      const result = addJemPestSolutions();
      const output = ContentService.createTextOutput(JSON.stringify(result));
      output.setMimeType(ContentService.MimeType.JSON);
      return output;
    } catch (error) {
      const output = ContentService.createTextOutput(JSON.stringify({ 
        error: String(error.message || error) 
      }));
      output.setMimeType(ContentService.MimeType.JSON);
      return output;
    }
  }
  
  // Simple test endpoint first
  const test = (e && e.parameter && e.parameter.test) ? e.parameter.test : '';
  if (test === 'ping') {
    const callback = (e && e.parameter && e.parameter.callback) ? e.parameter.callback : '';
    const response = JSON.stringify({ status: 'success', message: 'Apps Script is working!', timestamp: new Date().toISOString() });
    
    if (callback) {
      return ContentService.createTextOutput(callback + '(' + response + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      const output = ContentService.createTextOutput(response);
      output.setMimeType(ContentService.MimeType.JSON);
      return output;
    }
  }

  // Check for JSONP callback parameter
  const callback = (e && e.parameter && e.parameter.callback) ? e.parameter.callback : '';
  
  // Check if this is an API request via parameter
  const apiEndpoint = (e && e.parameter && e.parameter.api) ? e.parameter.api : '';
  if (apiEndpoint) {
    try {
      const result = handleApiGet_(e);
      
      // If JSONP callback requested, wrap response
      if (callback) {
        const jsonResponse = result.getContent();
        const jsonpResponse = callback + '(' + jsonResponse + ');';
        return ContentService.createTextOutput(jsonpResponse)
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      
      return result;
    } catch (error) {
      // Return error in JSONP format if callback requested
      if (callback) {
        const errorResponse = JSON.stringify({ error: String(error.message || error) });
        const jsonpResponse = callback + '(' + errorResponse + ');';
        return ContentService.createTextOutput(jsonpResponse)
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      
      // Return regular error response
      return ContentService.createTextOutput(JSON.stringify({ error: String(error.message || error) }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  // Serve HTML pages if no API requested
  const path = (e && e.pathInfo) ? String(e.pathInfo) : '';
  if (path && path.startsWith('api/')) {
    return handleApiGet_(e);
  }
  const page = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'intake';
  switch (page) {
    case 'dashboard':
      return HtmlService.createTemplateFromFile('dashboard.html').evaluate()
        .setTitle('Client Dashboard')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    case 'analytics':
      return HtmlService.createTemplateFromFile('analytics.html').evaluate()
        .setTitle('Analytics')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    default:
      return HtmlService.createTemplateFromFile('intake.html').evaluate()
        .setTitle('Agent Intake')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
}

function doPost(e) {
  // Check if this is an API request via parameter (same as doGet)
  const apiEndpoint = (e && e.parameter && e.parameter.api) ? e.parameter.api : '';
  if (apiEndpoint) {
    return handleApiPost_(e);
  }
  
  // Also check path-based routing for backward compatibility
  const path = (e && e.pathInfo) ? String(e.pathInfo) : '';
  if (path && path.startsWith('api/')) {
    return handleApiPost_(e);
  }
  
  console.log('❌ Unsupported POST route - no api parameter or path');
  console.log('📋 POST parameters:', e && e.parameter);
  console.log('🛣️ POST path:', path);
  
  return ContentService.createTextOutput(JSON.stringify({ error: 'Unsupported route' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  // Handle CORS preflight requests (fixed chaining issue)
  const output = ContentService.createTextOutput('');
  output.setMimeType(ContentService.MimeType.TEXT);
  // Note: JSONP bypasses CORS so this may not be needed
  return output;
}

// API wrappers for HTMLService (google.script.run)
function srv_getConfig() {
  return getConfig_();
}
function srv_submitLead(payload) {
  return createLead_(payload, 'agent ui');
}
function srv_listLeads(query) {
  const companyName = companyFromToken_(query.token);
  return listLeadsForCompany_(companyName, query);
}
function srv_updateLeadStatus(payload) {
  const companyName = companyFromToken_(payload.token);
  return updateLeadStatusForCompany_(companyName, payload.id, payload.status, 'client ui');
}
function srv_getStats(query) {
  const companyName = companyFromToken_(query.token);
  return getStatsForCompany_(companyName, query);
}

// Include server-side files for HtmlService
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Setup initializer - ONLY for creating new spreadsheets
function setup() {
  // Safety check: Don't run setup on existing spreadsheets
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty(SPREADSHEET_PROP_KEY);
  if (existingId) {
    return HtmlService.createHtmlOutput(
      '<div style="font:14px/1.4 Arial, sans-serif;padding:24px">' +
      '<h2>⚠️ Setup Already Complete</h2>' +
      '<p>A spreadsheet is already configured. To prevent data loss, setup() will not run again.</p>' +
      '<p>Existing spreadsheet ID: ' + existingId + '</p>' +
      '<p>If you need to create a new spreadsheet, first clear the script properties.</p>' +
      '</div>'
    );
  }

  const ss = SpreadsheetApp.create('Leads CRM (Apps Script)');
  setSpreadsheet_(ss);

  // Create sheets with headers
  const leads = ensureSheetWithHeaders_(ss, SHEET_LEADS, LEADS_HEADERS);
  const products = ensureSheetWithHeaders_(ss, SHEET_PRODUCTS, PRODUCTS_HEADERS);
  const companies = ensureSheetWithHeaders_(ss, SHEET_COMPANIES, COMPANIES_HEADERS);
  ensureSheetWithHeaders_(ss, SHEET_USERS, USERS_HEADERS);
  ensureSheetWithHeaders_(ss, SHEET_AUDIT, AUDIT_HEADERS);

  // Seed Companies
  const seedCompanies = [
    { name: 'Acme Plumbing', email: 'ops@acmeplumbing.com', notes: 'Region: North' },
    { name: 'Bright Electric', email: 'hello@brightelectric.io', notes: 'Region: East' }
  ];
  const companyRows = seedCompanies.map(c => [
    c.name,
    randomToken32_(),
    c.email,
    c.notes
  ]);
  if (companyRows.length) {
    companies.getRange(companies.getLastRow() + 1, 1, companyRows.length, companyRows[0].length).setValues(companyRows);
  }

  // Seed Products
  const prodRows = [];
  seedCompanies.forEach((c, i) => {
    const companyName = c.name;
    const items = i === 0
      ? [
          { sku: 'ACM-PL-001', name: 'Drain Cleaning', price: 129 },
          { sku: 'ACM-PL-002', name: 'Water Heater Install', price: 1599 },
          { sku: 'ACM-PL-003', name: 'Leak Repair', price: 249 },
          { sku: 'ACM-PL-004', name: 'Pipe Replacement', price: 899 }
        ]
      : [
          { sku: 'BRI-EL-101', name: 'Service Call', price: 99 },
          { sku: 'BRI-EL-102', name: 'Panel Upgrade', price: 2100 },
          { sku: 'BRI-EL-103', name: 'EV Charger Install', price: 750 }
        ];
    items.forEach(it => {
      prodRows.push([companyName, it.sku, it.name, it.price, true]);
    });
  });
  if (prodRows.length) {
    products.getRange(products.getLastRow() + 1, 1, prodRows.length, prodRows[0].length).setValues(prodRows);
  }

  // Confirm
  const url = ss.getUrl();
  Logger.log('Spreadsheet created: %s', url);

  const html = HtmlService.createHtmlOutput(
    '<div style="font:14px/1.4 Arial, sans-serif;padding:24px">' +
    '<h2>Setup complete</h2>' +
    '<p>Spreadsheet created:</p>' +
    '<p><a target="_blank" href="' + url + '">' + url + '</a></p>' +
    '<p>Deploy the Web App next. See Runbook below in the docs you received.</p>' +
    '</div>'
  );
  return html;
}

function randomToken32_() {
  // 32 hex chars
  const bytes = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  return bytes.slice(0, 32);
}

// Manual test/seed function
function test() {
  const ss = getSpreadsheet_();
  const companiesSheet = ss.getSheetByName(SHEET_COMPANIES);
  const comp = companiesSheet.getDataRange().getValues();
  const header = comp[0];
  const nameIdx = header.indexOf('Company_Name');
  const tokenIdx = header.indexOf('Company_Access_Token');
  const companies = comp.slice(1).map(r => ({ name: r[nameIdx], token: r[tokenIdx] })).filter(x => x.name && x.token);

  // seed 10 leads across companies
  const reasons = ['Schedule', 'Reschedule', 'New Sale', 'Cancellation', 'Complaint', 'Other…'];
  const payloads = [];
  for (let i = 0; i < 10; i++) {
    const c = companies[i % companies.length];
    payloads.push({
      companyName: c.name,
      customerFirstName: 'Test' + (i + 1),
      customerLastName: 'User' + (i + 1),
      address: {
        street: '123 Test St',
        city: 'City' + (i + 1),
        state: 'ST',
        postal: '0000' + (i + 1)
      },
      reasonForCall: reasons[i % reasons.length],
      reasonCustom: (i % reasons.length) === 5 ? 'Custom reason ' + (i + 1) : '',
      productSku: '', // let server resolve from product name later if needed
      productName: '',
      productPrice: '',
      leadValue: '',
      notes: 'Test seeded lead #' + (i + 1)
    });
  }
  payloads.forEach(p => createLead_(p, 'test seed'));

  // verify stats endpoint shape for each company
  companies.forEach(c => {
    const stats = getStatsForCompany_(c.name, {
      from: '',
      to: ''
    });
    Logger.log('Stats for %s: %s', c.name, JSON.stringify(stats));
  });

  return 'Seeded 10 leads and logged stats for each company.';
}

/* ================================
   USER AUTHENTICATION FUNCTIONS
   ================================ */

/**
 * Hash a password using SHA-256
 * @param {string} password - Plain text password
 * @returns {string} Hexadecimal hash string
 */
function hashPassword_(password) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password
  );
  return digest.map(byte => {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('');
}

/**
 * Authenticate a user with email and password
 * @param {string} email - User email
 * @param {string} password - Plain text password
 * @param {string} companyName - Company name from token
 * @returns {Object|null} User object if authenticated, null otherwise
 */
function authenticateUser_(email, password, companyName) {
  try {
    const { sheet, header } = getSheetWithHeader_(SHEET_USERS, USERS_HEADERS);
    const values = sheet.getDataRange().getValues();
    
    const emailIdx = header.indexOf('Email');
    const passwordIdx = header.indexOf('Password');
    const firstNameIdx = header.indexOf('First_Name');
    const lastNameIdx = header.indexOf('Last_Name');
    const roleIdx = header.indexOf('Role');
    const companyIdx = header.indexOf('Company_Name');
    const activeIdx = header.indexOf('Active');
    
    // Hash the provided password
    const hashedPassword = hashPassword_(password);
    
    // Find user matching email, company, and active=true
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rowEmail = String(row[emailIdx] || '').trim().toLowerCase();
      const rowCompany = String(row[companyIdx] || '').trim();
      const rowActive = row[activeIdx];
      
      if (rowEmail === email.toLowerCase() && 
          rowCompany === companyName && 
          rowActive === true) {
        
        // Check if password matches
        const storedPassword = String(row[passwordIdx] || '').trim();
        if (storedPassword === hashedPassword) {
          // Authentication successful
          return {
            email: row[emailIdx],
            firstName: row[firstNameIdx] || '',
            lastName: row[lastNameIdx] || '',
            fullName: (row[firstNameIdx] || '') + ' ' + (row[lastNameIdx] || ''),
            role: row[roleIdx] || 'User',
            companyName: row[companyIdx],
            active: row[activeIdx]
          };
        }
      }
    }
    
    // No match found
    return null;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

/**
 * Get all users for a company
 * @param {string} companyName - Company name
 * @returns {Array} Array of user objects (without passwords)
 */
function getUsersByCompany_(companyName) {
  try {
    const { sheet, header } = getSheetWithHeader_(SHEET_USERS, USERS_HEADERS);
    const values = sheet.getDataRange().getValues();
    
    const emailIdx = header.indexOf('Email');
    const firstNameIdx = header.indexOf('First_Name');
    const lastNameIdx = header.indexOf('Last_Name');
    const roleIdx = header.indexOf('Role');
    const companyIdx = header.indexOf('Company_Name');
    const activeIdx = header.indexOf('Active');
    
    const users = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rowCompany = String(row[companyIdx] || '').trim();
      
      if (rowCompany === companyName && row[emailIdx]) {
        users.push({
          email: row[emailIdx],
          firstName: row[firstNameIdx] || '',
          lastName: row[lastNameIdx] || '',
          fullName: (row[firstNameIdx] || '') + ' ' + (row[lastNameIdx] || ''),
          role: row[roleIdx] || 'User',
          companyName: row[companyIdx],
          active: row[activeIdx] === true
        });
      }
    }
    
    return users;
  } catch (error) {
    console.error('Error getting users:', error);
    return [];
  }
}

/**
 * Create a new user
 * @param {Object} userData - User data object
 * @returns {Object} Created user object or error
 */
function createUser_(userData) {
  try {
    const { sheet, header } = getSheetWithHeader_(SHEET_USERS, USERS_HEADERS);
    
    // Validate required fields
    if (!userData.email || !userData.password || !userData.companyName) {
      throw new Error('Email, password, and company name are required');
    }
    
    // Check if user already exists
    const values = sheet.getDataRange().getValues();
    const emailIdx = header.indexOf('Email');
    const companyIdx = header.indexOf('Company_Name');
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (String(row[emailIdx] || '').trim().toLowerCase() === userData.email.toLowerCase() &&
          String(row[companyIdx] || '').trim() === userData.companyName) {
        throw new Error('User with this email already exists for this company');
      }
    }
    
    // Hash the password
    const hashedPassword = hashPassword_(userData.password);
    
    // Prepare new user row
    const newRow = new Array(header.length).fill('');
    newRow[emailIdx] = userData.email;
    newRow[header.indexOf('Password')] = hashedPassword;
    newRow[header.indexOf('First_Name')] = userData.firstName || '';
    newRow[header.indexOf('Last_Name')] = userData.lastName || '';
    newRow[header.indexOf('Role')] = userData.role || 'User';
    newRow[companyIdx] = userData.companyName;
    newRow[header.indexOf('Active')] = userData.active !== false; // Default to true
    
    // Append to sheet
    sheet.appendRow(newRow);
    
    // Return created user (without password)
    return {
      email: userData.email,
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      fullName: (userData.firstName || '') + ' ' + (userData.lastName || ''),
      role: userData.role || 'User',
      companyName: userData.companyName,
      active: userData.active !== false
    };
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

/**
 * Update an existing user
 * @param {string} email - User email to update
 * @param {string} companyName - Company name
 * @param {Object} updates - Fields to update
 * @returns {Object} Updated user object or error
 */
function updateUser_(email, companyName, updates) {
  try {
    const { sheet, header } = getSheetWithHeader_(SHEET_USERS, USERS_HEADERS);
    const values = sheet.getDataRange().getValues();
    
    const emailIdx = header.indexOf('Email');
    const passwordIdx = header.indexOf('Password');
    const firstNameIdx = header.indexOf('First_Name');
    const lastNameIdx = header.indexOf('Last_Name');
    const roleIdx = header.indexOf('Role');
    const companyIdx = header.indexOf('Company_Name');
    const activeIdx = header.indexOf('Active');
    
    // Find user row
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (String(row[emailIdx] || '').trim().toLowerCase() === email.toLowerCase() &&
          String(row[companyIdx] || '').trim() === companyName) {
        
        // Update fields
        if (updates.password) {
          row[passwordIdx] = hashPassword_(updates.password);
        }
        if (updates.firstName !== undefined) {
          row[firstNameIdx] = updates.firstName;
        }
        if (updates.lastName !== undefined) {
          row[lastNameIdx] = updates.lastName;
        }
        if (updates.role !== undefined) {
          row[roleIdx] = updates.role;
        }
        if (updates.active !== undefined) {
          row[activeIdx] = updates.active;
        }
        
        // Write updated row back
        sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
        
        // Return updated user
        return {
          email: row[emailIdx],
          firstName: row[firstNameIdx] || '',
          lastName: row[lastNameIdx] || '',
          fullName: (row[firstNameIdx] || '') + ' ' + (row[lastNameIdx] || ''),
          role: row[roleIdx] || 'User',
          companyName: row[companyIdx],
          active: row[activeIdx] === true
        };
      }
    }
    
    throw new Error('User not found');
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}
