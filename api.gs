/* JSON API via ContentService with URL routing and CORS checks */

function handleApiGet_(e) {
  try {
    // Check if this is a JSONP request (has callback parameter)
    const callback = (e && e.parameter && e.parameter.callback) ? e.parameter.callback : '';
    const isJSONP = !!callback;
    
    // Get origin for logging, but skip validation for JSONP
    const { origin, ok } = allowOrigin_(e);
    
    // Only enforce CORS for non-JSONP requests
    if (!isJSONP && !ok) {
      return jsonResponse_({ error: 'Forbidden' }, origin || '', 403);
    }

    // Check API endpoint from parameter or path
    const apiParam = (e && e.parameter && e.parameter.api) ? e.parameter.api : '';
    const path = (e && e.pathInfo) ? String(e.pathInfo) : '';
    const urlPath = path.replace(/^\/+/, '');
    
    // Determine endpoint
    const endpoint = apiParam || urlPath;
    
    if (endpoint === 'config' || endpoint === 'api/config') {
      const token = e.parameter && e.parameter.token;
      if (token) {
        // Token-based config: return company-specific data
        const companyName = companyFromToken_(token);
        const company = { name: companyName };
        
        // EMERGENCY: Try direct Products sheet access to bypass all functions
        console.log('🚨 EMERGENCY - Direct Products sheet access for token config');
        const products = getProductsDirectly_(companyName);
        
        console.log('🏢 Token-based config for:', companyName);
        console.log('📦 Products for company:', products);
        const payload = { company, products };
        return jsonResponse_(payload, '', 200);
      } else {
        // Traditional config: return all companies and products
        const payload = getConfig_();
        return jsonResponse_(payload, '', 200);
      }
    }

    if (endpoint === 'leads' || endpoint === 'api/leads') {
      const token = e.parameter && e.parameter.token;
      const companyName = companyFromToken_(token);
      const status = e.parameter && e.parameter.status;
      const from = e.parameter && e.parameter.from;
      const to = e.parameter && e.parameter.to;
      const payload = listLeadsForCompany_(companyName, { status, from, to });
      return jsonResponse_(payload, '', 200);
    }

    if (endpoint === 'stats' || endpoint === 'api/stats') {
      const token = e.parameter && e.parameter.token;
      const companyName = companyFromToken_(token);
      const from = e.parameter && e.parameter.from;
      const to = e.parameter && e.parameter.to;
      const payload = getStatsForCompany_(companyName, { from, to });
      return jsonResponse_(payload, '', 200);
    }

    // Users endpoint (list)
    if (endpoint === 'users' || endpoint === 'api/users') {
      const token = e.parameter && e.parameter.token;
      const companyName = companyFromToken_(token);
      const users = getUsersByCompany_(companyName);
      return jsonResponse_(users, '', 200);
    }

    // Comments endpoint (get by lead)
    if (endpoint === 'comments' || endpoint === 'api/comments') {
      const leadId = e.parameter && e.parameter.leadId;
      if (!leadId) {
        return jsonResponse_({ error: 'Lead ID is required' }, '', 400);
      }
      const comments = getCommentsForLead_(leadId);
      return jsonResponse_(comments, '', 200);
    }

    return jsonResponse_({ error: 'Not found' }, '', 404);
  } catch (err) {
    return jsonResponse_({ error: String(err.message || err) }, (e && e.headers && e.headers.origin) || '', 400);
  }
}

function handleApiPost_(e) {
  try {
    // Check Content-Type to see if this is our text/plain request
    const contentType = (e && e.postData && e.postData.type) || '';
    const isTextPlain = contentType.includes('text/plain');
    
    // Get origin for logging, but skip validation for text/plain requests
    const { origin, ok } = allowOrigin_(e);
    
    // Only enforce CORS for non-text/plain requests
    if (!isTextPlain && !ok) {
      return jsonResponse_({ error: 'Forbidden' }, origin || '', 403);
    }

    // Check API endpoint from parameter or path
    const apiParam = (e && e.parameter && e.parameter.api) ? e.parameter.api : '';
    const path = (e && e.pathInfo) ? String(e.pathInfo) : '';
    const urlPath = path.replace(/^\/+/, '');
    
    // Determine endpoint
    const endpoint = apiParam || urlPath;

    if (endpoint === 'leads' || endpoint === 'api/leads') {
      const body = parseBody_(e);
      
      // Check if this is a PATCH request (lead status update)
      const methodOverride = (e.parameter && e.parameter._method) || (body && body._method) || '';
      const leadId = (e.parameter && e.parameter.id) || (body && body.id);
      
      console.log('🔍 POST to leads endpoint debug:', {
        endpoint,
        methodOverride,
        leadId,
        bodyKeys: Object.keys(body),
        parameterKeys: e.parameter ? Object.keys(e.parameter) : []
      });
      
      if (String(methodOverride).toUpperCase() === 'PATCH' && leadId) {
        console.log('✅ PATCH request identified, updating existing lead...');
        const token = (e.parameter && e.parameter.token) || (body && body.token);
        const companyName = companyFromToken_(token);
        const status = (e.parameter && e.parameter.status) || (body && body.status);
        const userEmail = (e.parameter && e.parameter.userEmail) || (body && body.userEmail);
        const assignedTo = (e.parameter && e.parameter.assignedTo) || (body && body.assignedTo);
        
        // Handle assignment update (if assignedTo is provided without status)
        if (assignedTo !== undefined && !status) {
          console.log('🔄 Assignment update:', { leadId, assignedTo });
          const result = updateLeadAssignment_(companyName, leadId, assignedTo, userEmail || 'client ui');
          return jsonResponse_(result, origin || '', 200);
        }
        
        // Handle status update
        console.log('🔄 PATCH details:', { leadId, companyName, status, userEmail });
        const result = updateLeadStatusForCompany_(companyName, leadId, status, 'client ui', userEmail);
        return jsonResponse_(result, origin || '', 200);
      } else {
        console.log('📝 Creating new lead (no PATCH method or leadId)');
        // This is the normal lead creation path from intake form
        const payload = normalizeLeadBody_(body);
        
        // IMPORTANT: Get company name from token instead of trusting frontend
        const token = (e.parameter && e.parameter.token) || (body && body.token);
        if (token) {
          const tokenCompanyName = companyFromToken_(token);
          payload.companyName = tokenCompanyName; // Override with token-based company
        }
        
        const result = createLead_(payload, 'agent ui');
        return jsonResponse_(result, origin || '', 200);
      }
    }

    // Login endpoint
    if (endpoint === 'login' || endpoint === 'api/login') {
      const body = parseBody_(e);
      const email = body.email;
      const password = body.password;
      const token = (e.parameter && e.parameter.token) || body.token;
      
      if (!email || !password || !token) {
        return jsonResponse_({ error: 'Email, password, and token are required' }, origin || '', 400);
      }
      
      const companyName = companyFromToken_(token);
      const user = authenticateUser_(email, password, companyName);
      
      if (user) {
        return jsonResponse_({ success: true, user: user }, origin || '', 200);
      } else {
        return jsonResponse_({ error: 'Invalid credentials' }, origin || '', 401);
      }
    }

    // Users endpoint (create)
    if (endpoint === 'users' || endpoint === 'api/users') {
      const body = parseBody_(e);
      const token = (e.parameter && e.parameter.token) || body.token;
      const companyName = companyFromToken_(token);
      
      // Check if this is a PATCH request (update user)
      const methodOverride = (e.parameter && e.parameter._method) || (body && body._method) || '';
      
      if (String(methodOverride).toUpperCase() === 'PATCH') {
        // Update user
        const email = body.email;
        const updates = {
          password: body.password,
          firstName: body.firstName,
          lastName: body.lastName,
          role: body.role,
          active: body.active
        };
        const result = updateUser_(email, companyName, updates);
        return jsonResponse_(result, origin || '', 200);
      } else {
        // Create new user
        const userData = {
          email: body.email,
          password: body.password,
          firstName: body.firstName,
          lastName: body.lastName,
          role: body.role,
          companyName: companyName,
          active: body.active !== false
        };
        const result = createUser_(userData);
        return jsonResponse_(result, origin || '', 200);
      }
    }

    // Comments endpoint (create)
    if (endpoint === 'comments' || endpoint === 'api/comments') {
      const body = parseBody_(e);
      const token = (e.parameter && e.parameter.token) || body.token;
      const companyName = companyFromToken_(token);
      
      const leadId = body.leadId;
      const userEmail = body.userEmail;
      const userName = body.userName;
      const commentText = body.commentText;
      
      if (!leadId || !userEmail || !commentText) {
        return jsonResponse_({ error: 'Lead ID, user email, and comment text are required' }, origin || '', 400);
      }
      
      const result = addComment_(leadId, userEmail, userName, commentText);
      return jsonResponse_(result, origin || '', 200);
    }

    return jsonResponse_({ error: 'Not found' }, origin || '', 404);
  } catch (err) {
    const origin = (e && e.headers && e.headers.origin) || '';
    return jsonResponse_({ error: String(err.message || err) }, origin, 400);
  }
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  const ctype = (e.postData.type || '').toLowerCase();
  const raw = e.postData.contents;
  
  // Handle JSON data regardless of Content-Type (for our text/plain CORS bypass)
  if (ctype.indexOf('application/json') >= 0 || ctype.indexOf('text/plain') >= 0) {
    try { 
      return JSON.parse(raw);
    } catch (err) { 
      return {}; 
    }
  }
  if (ctype.indexOf('application/x-www-form-urlencoded') >= 0) {
    const out = {};
    raw.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      out[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    return out;
  }
  console.log('❌ Unsupported content type:', ctype);
  return {};
}

function normalizeLeadBody_(b) {
  // Map expected fields from API into internal payload
  return {
    companyName: b.companyName,
    customerFirstName: b.customerFirstName,
    customerLastName: b.customerLastName,
    customerPhone: b.customerPhone,
    customerEmail: b.customerEmail || '',
    address: {
      street: b.addressStreet || (b.address && b.address.street),
      city: b.addressCity || (b.address && b.address.city),
      state: b.addressState || (b.address && b.address.state),
      postal: b.addressPostal || (b.address && b.address.postal)
    },
    reasonForCall: b.reasonForCall,
    reasonCustom: b.reasonCustom,
    schedulingTold: b.schedulingTold || '',
    productSku: b.productSku,
    productName: b.productName,
    initialPrice: b.initialPrice,
    recurringPrice: b.recurringPrice,
    squareFootage: b.squareFootage,
    leadValue: b.leadValue,
    notes: b.notes
  };
}

// EMERGENCY FUNCTION: Direct Products sheet access without any infrastructure
function getProductsDirectly_(companyName) {
  console.log('🚨 EMERGENCY DIRECT ACCESS - Getting products for:', companyName);
  
  try {
    // Get spreadsheet directly
    const props = PropertiesService.getScriptProperties();
    const ssId = props.getProperty('PRIMARY_SPREADSHEET_ID');
    if (!ssId) {
      console.log('🚨 EMERGENCY - No spreadsheet ID found');
      return [];
    }
    
    const ss = SpreadsheetApp.openById(ssId);
    const sheet = ss.getSheetByName('Products');
    
    if (!sheet) {
      console.log('🚨 EMERGENCY - Products sheet does not exist');
      return [];
    }
    
    console.log('✅ EMERGENCY - Products sheet found, last row:', sheet.getLastRow());
    
    if (sheet.getLastRow() <= 1) {
      console.log('🚨 EMERGENCY - Products sheet is empty');
      return [];
    }
    
    // Read all data
    const values = sheet.getDataRange().getValues();
    console.log('✅ EMERGENCY - Read', values.length, 'rows from Products sheet');
    
    const products = [];
    
    // Process each row (skip header row)
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rowCompany = String(row[0] || '').trim();
      const active = String(row[5] || '').toLowerCase() === 'true';
      
      console.log('🔍 EMERGENCY - Row', i, 'Company:', rowCompany, 'Active:', active, 'Target:', companyName);
      
      if (active && rowCompany === companyName) {
        const product = {
          sku: String(row[1] || ''),
          name: String(row[2] || ''),
          initialPrice: Number(row[3] || 0),
          recurringPrice: Number(row[4] || 0),
          sqFtMin: Number(row[7] || 0),
          sqFtMax: Number(row[8] || 0)
        };
        products.push(product);
        console.log('✅ EMERGENCY - Added product:', product);
      }
    }
    
    console.log('✅ EMERGENCY - Final products for', companyName, ':', products);
    return products;
    
  } catch (error) {
    console.error('❌ EMERGENCY - Error in direct access:', error);
    return [];
  }
}

function jsonResponse_(obj, origin, status) {
  // Fixed: Create output first, then set MIME type and headers separately
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  // Note: For JSONP, headers are not needed since script tags bypass CORS
  return output;
}
