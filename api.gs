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
        const allProductsByCompany = getProductsByCompany_();
        const products = allProductsByCompany[companyName] || [];
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

    // Handle PATCH requests (for lead status updates from dashboard)
    const body = parseBody_(e);
    const methodOverride = (e.parameter && e.parameter._method) || (body && body._method) || '';
    const leadId = (e.parameter && e.parameter.id) || (body && body.id);
    
    if (String(methodOverride).toUpperCase() === 'PATCH' && leadId && endpoint === 'leads') {
      const token = (e.parameter && e.parameter.token) || (body && body.token);
      const companyName = companyFromToken_(token);
      const status = (e.parameter && e.parameter.status) || (body && body.status);
      console.log('🔄 PATCH request:', { leadId, companyName, status, methodOverride });
      const result = updateLeadStatusForCompany_(companyName, leadId, status, 'client ui');
      return jsonResponse_(result, origin || '', 200);
    }
    
    // Debug: If we reach here for leads endpoint, something is wrong
    if (endpoint === 'leads') {
      console.log('⚠️ Leads endpoint reached but conditions not met:', {
        methodOverride,
        leadId,
        endpoint,
        isPatch: String(methodOverride).toUpperCase() === 'PATCH',
        hasLeadId: !!leadId,
        isLeadsEndpoint: endpoint === 'leads'
      });
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
    address: {
      street: b.addressStreet || (b.address && b.address.street),
      city: b.addressCity || (b.address && b.address.city),
      state: b.addressState || (b.address && b.address.state),
      postal: b.addressPostal || (b.address && b.address.postal)
    },
    reasonForCall: b.reasonForCall,
    reasonCustom: b.reasonCustom,
    productSku: b.productSku,
    productName: b.productName,
    productPrice: b.productPrice,
    leadValue: b.leadValue,
    notes: b.notes
  };
}

function jsonResponse_(obj, origin, status) {
  // Fixed: Create output first, then set MIME type and headers separately
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  // Note: For JSONP, headers are not needed since script tags bypass CORS
  return output;
}
