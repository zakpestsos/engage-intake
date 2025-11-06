/* Bootstrap, constants, utilities */

const SPREADSHEET_PROP_KEY = 'PRIMARY_SPREADSHEET_ID';

const SHEET_LEADS = 'Leads';
const SHEET_PRODUCTS = 'Products';
const SHEET_COMPANIES = 'Companies';
const SHEET_USERS = 'Users';
const SHEET_AUDIT = 'Audit_Log';
const SHEET_COMMENTS = 'Comments';
const SHEET_PASSWORD_RESETS = 'Password_Resets';

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
  'SMS_Notification_Numbers',
  'Enable_SMS_Notifications'
];

const USERS_HEADERS = [
  'Email',
  'Password',
  'First_Name',
  'Last_Name',
  'Role',
  'Company_Name',
  'Active',
  'Icon_Color',
  'Phone_Number'
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

const PASSWORD_RESETS_HEADERS = [
  'Reset_Token',
  'User_Email',
  'Company_Name',
  'Created_At',
  'Expires_At',
  'Used'
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
  ensureSheetWithHeaders_(ss, SHEET_COMMENTS, COMMENTS_HEADERS);
  ensureSheetWithHeaders_(ss, SHEET_PASSWORD_RESETS, PASSWORD_RESETS_HEADERS);

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

/**
 * Setup function to configure Sharpen API credentials in Script Properties
 * Run this manually once to store the credentials securely
 * 
 * Instructions:
 * 1. Select "setupSharpenCredentials" from function dropdown
 * 2. Click Run (▶️)
 * 3. Check execution log for confirmation
 */
function setupSharpenCredentials() {
  const props = PropertiesService.getScriptProperties();
  
  // NEW Sharpen Logic+ credentials for SMS automation
  const SHARPEN_CKEY1 = 'b20d0148e3b4bf5209aa4f2be3df0b8998396b8a';
  const SHARPEN_CKEY2 = 'c3609e11c90e4275187949deaec4d1518b0b95457809d84b5d883d1cc1e038a15a81923040ae865b';
  const SHARPEN_LOGIC_ID = '021m3v4h8z7jjxxx7i'; // Your SMS automation Logic+ flow
  
  props.setProperties({
    'SHARPEN_CKEY1': SHARPEN_CKEY1,
    'SHARPEN_CKEY2': SHARPEN_CKEY2,
    'SHARPEN_LOGIC_ID': SHARPEN_LOGIC_ID
  });
  
  Logger.log('✅ Sharpen credentials configured successfully!');
  Logger.log('SHARPEN_CKEY1: ' + SHARPEN_CKEY1);
  Logger.log('SHARPEN_CKEY2: ' + SHARPEN_CKEY2);
  Logger.log('SHARPEN_LOGIC_ID: ' + SHARPEN_LOGIC_ID);
  Logger.log('');
  Logger.log('✅ SMS automation is now ready!');
  
  return 'Sharpen credentials configured successfully! SMS automation is ready.';
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
    const iconColorIdx = header.indexOf('Icon_Color');
    
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
            active: row[activeIdx],
            iconColor: row[iconColorIdx] || '#3b82f6'
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
    const iconColorIdx = header.indexOf('Icon_Color');
    const phoneIdx = header.indexOf('Phone_Number');
    
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
          active: row[activeIdx] === true,
          iconColor: row[iconColorIdx] || '#3b82f6',
          phoneNumber: row[phoneIdx] || ''
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
    newRow[header.indexOf('Icon_Color')] = userData.iconColor || '#3b82f6'; // Default to blue
    newRow[header.indexOf('Phone_Number')] = userData.phoneNumber || '';
    
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
      active: userData.active !== false,
      iconColor: userData.iconColor || '#3b82f6',
      phoneNumber: userData.phoneNumber || ''
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
    const iconColorIdx = header.indexOf('Icon_Color');
    const phoneIdx = header.indexOf('Phone_Number');
    
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
        if (updates.iconColor !== undefined) {
          row[iconColorIdx] = updates.iconColor;
        }
        if (updates.phoneNumber !== undefined) {
          row[phoneIdx] = updates.phoneNumber;
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
          active: row[activeIdx] === true,
          iconColor: row[iconColorIdx] || '#3b82f6',
          phoneNumber: row[phoneIdx] || ''
        };
      }
    }
    
    throw new Error('User not found');
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

/**
 * Get company data including SMS opt-in status
 * @param {string} companyName - Company name
 * @returns {Object} Company data or error
 */
function getCompanyData_(companyName) {
  try {
    const { sheet, header } = getSheetWithHeader_(SHEET_COMPANIES, COMPANIES_HEADERS);
    const values = sheet.getDataRange().getValues();
    
    const nameIdx = header.indexOf('Company_Name');
    const smsIdx = header.indexOf('Enable_SMS_Notifications');
    const smsNumbersIdx = header.indexOf('SMS_Notification_Numbers');
    const emailIdx = header.indexOf('Contact_Email');
    const notesIdx = header.indexOf('Notes');
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (String(row[nameIdx] || '').trim() === companyName) {
        return {
          name: row[nameIdx],
          smsEnabled: row[smsIdx] === true || String(row[smsIdx]).toUpperCase() === 'TRUE',
          smsNumbers: row[smsNumbersIdx] || '',
          contactEmail: row[emailIdx] || '',
          notes: row[notesIdx] || ''
        };
      }
    }
    
    throw new Error('Company not found');
  } catch (error) {
    console.error('Error getting company data:', error);
    throw error;
  }
}

/**
 * Update company SMS opt-in status
 * @param {string} companyName - Company name
 * @param {boolean} smsOptIn - SMS opt-in status
 * @returns {boolean} Success
 */
function updateCompanySmsOptIn_(companyName, smsOptIn) {
  try {
    const { sheet, header } = getSheetWithHeader_(SHEET_COMPANIES, COMPANIES_HEADERS);
    const values = sheet.getDataRange().getValues();
    
    const nameIdx = header.indexOf('Company_Name');
    const smsIdx = header.indexOf('Enable_SMS_Notifications');
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (String(row[nameIdx] || '').trim() === companyName) {
        row[smsIdx] = smsOptIn;
        sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
        console.log('✅ Updated SMS opt-in for company:', companyName, 'to:', smsOptIn);
        return true;
      }
    }
    
    throw new Error('Company not found');
  } catch (error) {
    console.error('Error updating company SMS opt-in:', error);
    throw error;
  }
}

/* ================================
   PASSWORD RESET FUNCTIONALITY
   ================================ */

/**
 * Request a password reset for a user
 * @param {string} email - User's email address
 * @param {string} companyName - User's company name
 * @returns {Object} Success message or error
 */
function requestPasswordReset_(email, companyName) {
  try {
    // Validate that user exists
    const { sheet: usersSheet, header: usersHeader } = getSheetWithHeader_(SHEET_USERS, USERS_HEADERS);
    const usersValues = usersSheet.getDataRange().getValues();
    
    const emailIdx = usersHeader.indexOf('Email');
    const companyIdx = usersHeader.indexOf('Company_Name');
    const firstNameIdx = usersHeader.indexOf('First_Name');
    const lastNameIdx = usersHeader.indexOf('Last_Name');
    
    let userFound = false;
    let userName = '';
    
    for (let i = 1; i < usersValues.length; i++) {
      const row = usersValues[i];
      if (String(row[emailIdx] || '').trim().toLowerCase() === email.toLowerCase() &&
          String(row[companyIdx] || '').trim() === companyName) {
        userFound = true;
        userName = (row[firstNameIdx] || '') + ' ' + (row[lastNameIdx] || '');
        break;
      }
    }
    
    if (!userFound) {
      throw new Error('No user found with this email address');
    }
    
    // Generate unique reset token
    const resetToken = Utilities.getUuid();
    
    // Calculate expiration (7 days from now)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
    
    // Store reset token in Password_Resets sheet
    const { sheet: resetsSheet, header: resetsHeader } = getSheetWithHeader_(SHEET_PASSWORD_RESETS, PASSWORD_RESETS_HEADERS);
    
    const tokenIdx = resetsHeader.indexOf('Reset_Token');
    const userEmailIdx = resetsHeader.indexOf('User_Email');
    const companyNameIdx = resetsHeader.indexOf('Company_Name');
    const createdAtIdx = resetsHeader.indexOf('Created_At');
    const expiresAtIdx = resetsHeader.indexOf('Expires_At');
    const usedIdx = resetsHeader.indexOf('Used');
    
    const newRow = new Array(resetsHeader.length).fill('');
    newRow[tokenIdx] = resetToken;
    newRow[userEmailIdx] = email;
    newRow[companyNameIdx] = companyName;
    newRow[createdAtIdx] = now;
    newRow[expiresAtIdx] = expiresAt;
    newRow[usedIdx] = false;
    
    resetsSheet.appendRow(newRow);
    
    // Send reset email
    sendPasswordResetEmail_(email, userName, resetToken, companyName);
    
    console.log('✅ Password reset requested for:', email);
    
    return {
      success: true,
      message: 'Password reset email sent. Please check your inbox.'
    };
  } catch (error) {
    console.error('Error requesting password reset:', error);
    throw error;
  }
}

/**
 * Validate a reset token
 * @param {string} token - Reset token to validate
 * @returns {Object} User email if valid, error if not
 */
function validateResetToken_(token) {
  try {
    const { sheet, header } = getSheetWithHeader_(SHEET_PASSWORD_RESETS, PASSWORD_RESETS_HEADERS);
    const values = sheet.getDataRange().getValues();
    
    const tokenIdx = header.indexOf('Reset_Token');
    const emailIdx = header.indexOf('User_Email');
    const companyIdx = header.indexOf('Company_Name');
    const expiresAtIdx = header.indexOf('Expires_At');
    const usedIdx = header.indexOf('Used');
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (String(row[tokenIdx] || '').trim() === token) {
        // Check if already used
        if (row[usedIdx] === true || String(row[usedIdx]).toUpperCase() === 'TRUE') {
          throw new Error('This reset link has already been used');
        }
        
        // Check if expired
        const expiresAt = new Date(row[expiresAtIdx]);
        if (new Date() > expiresAt) {
          throw new Error('This reset link has expired');
        }
        
        return {
          valid: true,
          email: row[emailIdx],
          companyName: row[companyIdx]
        };
      }
    }
    
    throw new Error('Invalid reset link');
  } catch (error) {
    console.error('Error validating reset token:', error);
    throw error;
  }
}

/**
 * Reset password using a valid token
 * @param {string} token - Reset token
 * @param {string} newPassword - New password
 * @returns {Object} Success message or error
 */
function resetPasswordWithToken_(token, newPassword) {
  try {
    // Validate password
    if (!newPassword || newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    // Validate token and get user info
    const tokenInfo = validateResetToken_(token);
    const email = tokenInfo.email;
    const companyName = tokenInfo.companyName;
    
    // Update user's password
    const { sheet: usersSheet, header: usersHeader } = getSheetWithHeader_(SHEET_USERS, USERS_HEADERS);
    const usersValues = usersSheet.getDataRange().getValues();
    
    const emailIdx = usersHeader.indexOf('Email');
    const passwordIdx = usersHeader.indexOf('Password');
    const companyIdx = usersHeader.indexOf('Company_Name');
    
    let updated = false;
    
    for (let i = 1; i < usersValues.length; i++) {
      const row = usersValues[i];
      if (String(row[emailIdx] || '').trim().toLowerCase() === email.toLowerCase() &&
          String(row[companyIdx] || '').trim() === companyName) {
        // Hash and update password
        row[passwordIdx] = hashPassword_(newPassword);
        usersSheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
        updated = true;
        break;
      }
    }
    
    if (!updated) {
      throw new Error('User not found');
    }
    
    // Mark token as used
    const { sheet: resetsSheet, header: resetsHeader } = getSheetWithHeader_(SHEET_PASSWORD_RESETS, PASSWORD_RESETS_HEADERS);
    const resetsValues = resetsSheet.getDataRange().getValues();
    
    const tokenIdx = resetsHeader.indexOf('Reset_Token');
    const usedIdx = resetsHeader.indexOf('Used');
    
    for (let i = 1; i < resetsValues.length; i++) {
      const row = resetsValues[i];
      if (String(row[tokenIdx] || '').trim() === token) {
        row[usedIdx] = true;
        resetsSheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
        break;
      }
    }
    
    console.log('✅ Password reset successfully for:', email);
    
    return {
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.'
    };
  } catch (error) {
    console.error('Error resetting password:', error);
    throw error;
  }
}

/**
 * Send password reset email
 * @param {string} email - User's email
 * @param {string} userName - User's name
 * @param {string} resetToken - Reset token
 * @param {string} companyName - Company name
 */
function sendPasswordResetEmail_(email, userName, resetToken, companyName) {
  try {
    // Determine the dashboard URL based on environment
    // For now, use staging URL - can be made dynamic later
    const dashboardUrl = 'https://zakpestsos.github.io/engage-intake/development/frontend-dashboard/';
    const resetLink = dashboardUrl + '?reset=' + resetToken;
    
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background: #f9f9f9;
      padding: 30px;
      border: 1px solid #e0e0e0;
      border-top: none;
    }
    .button {
      display: inline-block;
      padding: 15px 30px;
      background: #667eea;
      color: white !important;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
      margin: 20px 0;
    }
    .footer {
      background: #f0f0f0;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-radius: 0 0 8px 8px;
    }
    .warning {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
    }
    .security {
      background: #e8f5e9;
      border-left: 4px solid #4caf50;
      padding: 15px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔐 Password Reset Request</h1>
    <p>Engage CRM</p>
  </div>
  
  <div class="content">
    <p>Hello ${userName || 'there'},</p>
    
    <p>We received a request to reset your password for your Engage CRM account (${companyName}).</p>
    
    <p style="text-align: center;">
      <a href="${resetLink}" class="button">Reset Your Password</a>
    </p>
    
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; background: white; padding: 10px; border: 1px solid #ddd;">
      ${resetLink}
    </p>
    
    <div class="warning">
      <strong>⏰ This link will expire in 7 days</strong><br>
      For security reasons, this password reset link will only work once and will expire on ${new Date(Date.now() + 7*24*60*60*1000).toLocaleDateString()}.
    </div>
    
    <div class="security">
      <strong>🔒 Security Notice</strong><br>
      If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
      If you're concerned about your account security, please contact your administrator.
    </div>
    
    <p>Best regards,<br>
    The Engage CRM Team</p>
  </div>
  
  <div class="footer">
    <p>This is an automated email from Engage CRM.</p>
    <p>Need help? Contact your system administrator.</p>
  </div>
</body>
</html>
    `;
    
    MailApp.sendEmail({
      to: email,
      subject: 'Reset Your Engage CRM Password',
      htmlBody: htmlBody,
      from: 'engage@pest-sos.com',
      name: 'Engage CRM'
    });
    
    console.log('✅ Password reset email sent to:', email);
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error);
    throw new Error('Failed to send reset email. Please try again later.');
  }
}

/* ================================
   SMS AUTOMATION FOR SHARPEN LOGIC+
   ================================ */

/**
 * Send lead data to Sharpen Logic+ via API to trigger SMS
 * @param {string} leadName - Lead's name
 * @param {string} leadPhone - Lead's phone number
 * @param {string} leadEmail - Lead's email
 * @param {string} leadNotes - Additional notes
 */
function sendToLogicPlus(leadName, leadPhone, leadEmail, leadNotes) {
  var url = "https://api.iz1.sharpen.cx/v1/logics/021m3v4h8z7jjxxx7i/execute/";
  
  var headers = {
    "X-API-KEY": "b20d0148e3b4bf5209aa4f2be3df0b8998396b8a",
    "X-API-SECRET": "c3609e11c90e4275187949deaec4d1518b0b95457809d84b5d883d1cc1e038a15a81923040ae865b",
    "Content-Type": "application/json"
  };
  
  var payload = {
    "customVariables": {
      "leadName": leadName,
      "leadPhone": leadPhone,
      "leadEmail": leadEmail,
      "leadNotes": leadNotes
    }
  };
  
  var options = {
    "method": "POST",
    "headers": headers,
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  
  try {
    var response = UrlFetchApp.fetch(url, options);
    Logger.log("✅ SMS Automation Response: " + response.getContentText());
    return response.getContentText();
  } catch (error) {
    Logger.log("❌ SMS Automation Error: " + error.toString());
    return "Error: " + error.toString();
  }
}

/**
 * SMS NOTIFICATION SYSTEM
 * 
 * SMS notifications are sent automatically when leads are created via createLead_() in sheets.js
 * No manual trigger needed - the web form API handles it natively.
 * 
 * Configuration (Companies sheet):
 * - Enable_SMS_Notifications (column F): Check/uncheck to enable/disable per company
 * - SMS_Notification_Numbers (column E): Comma-separated phone numbers (e.g., 4058922437,4052106988)
 * 
 * The system will send one SMS to each number when a new lead is submitted.
 */

/**
 * TEST FUNCTION: Manually test SMS notification system
 * Run this to debug SMS functionality without submitting a lead
 */
function testSMSNotificationSystem() {
  Logger.log('🧪 TEST: Starting SMS notification test...');
  
  // Test data
  const testCompanyName = 'Dev Company';
  const testLeadData = {
    leadId: 'TEST-' + new Date().getTime(),
    customerFirstName: 'John',
    customerLastName: 'Doe',
    phoneNumber: '5551234567',
    customerEmail: 'john@example.com',
    addressStreet: '123 Test St',
    addressCity: 'Oklahoma City',
    addressState: 'OK',
    addressPostal: '73099',
    sqFt: 2500,
    productName: 'Test Service',
    initialPrice: 299,
    reasonForCall: 'New Sale',
    schedulingTold: 'ASAP',
    notes: 'This is a test lead for SMS debugging'
  };
  
  Logger.log('🧪 TEST: Calling sendSharpenSMS_ for: ' + testCompanyName);
  Logger.log('🧪 TEST: Lead ID: ' + testLeadData.leadId);
  
  try {
    sendSharpenSMS_(testCompanyName, testLeadData);
    Logger.log('🧪 TEST: ✅ SMS function completed without errors');
  } catch (error) {
    Logger.log('🧪 TEST: ❌ ERROR: ' + error.toString());
    Logger.log('🧪 TEST: ❌ Stack: ' + error.stack);
  }
  
  Logger.log('🧪 TEST: Check logs above for SMS details');
  Logger.log('🧪 TEST: If you see "SMS notifications disabled", check the Enable_SMS_Notifications checkbox');
}