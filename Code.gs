/* Bootstrap, constants, utilities */

const SPREADSHEET_PROP_KEY = 'PRIMARY_SPREADSHEET_ID';

const SHEET_LEADS = 'Leads';
const SHEET_PRODUCTS = 'Products';
const SHEET_COMPANIES = 'Companies';
const SHEET_USERS = 'Users';
const SHEET_AUDIT = 'Audit_Log';

const LEADS_HEADERS = [
  'Lead_ID',
  'Created_At',
  'Updated_At',
  'Company_Name',
  'Customer_First_Name',
  'Customer_Last_Name',
  'Address_Street',
  'Address_City',
  'Address_State',
  'Address_Postal',
  'Reason_For_Call',
  'Reason_Custom',
  'Product_SKU',
  'Product_Name',
  'Product_Price',
  'Lead_Value',
  'Status',
  'Accepted_At',
  'Completed_At',
  'Cancelled_At',
  'Assigned_To',
  'Notes',
  'Company_Access_Token'
];

const PRODUCTS_HEADERS = [
  'Company_Name',
  'Product_SKU',
  'Product_Name',
  'Product_Price',
  'Active'
];

const COMPANIES_HEADERS = [
  'Company_Name',
  'Company_Access_Token',
  'Contact_Email',
  'Notes'
];

const USERS_HEADERS = [
  'Email',
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

// Allowed origins for CORS checks (update for your GitHub Pages domain)
const ALLOWED_ORIGINS = [
  'https://script.google.com',
  'https://sites.google.com',
  'https://script.googleusercontent.com',
  'https://zakpestsos.github.io',
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
  // Check if this is an API request via parameter
  const apiEndpoint = (e && e.parameter && e.parameter.api) ? e.parameter.api : '';
  if (apiEndpoint) {
    return handleApiGet_(e);
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
  const path = (e && e.pathInfo) ? String(e.pathInfo) : '';
  if (path && path.startsWith('api/')) {
    return handleApiPost_(e);
  }
  return ContentService.createTextOutput(JSON.stringify({ error: 'Unsupported route' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  // Handle CORS preflight requests (simplified approach)
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
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

// Setup initializer
function setup() {
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
