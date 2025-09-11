/* JSON API via ContentService with URL routing and CORS checks */

function handleApiGet_(e) {
  try {
    const path = (e && e.pathInfo) ? String(e.pathInfo) : ''; // e.g., api/config
    const { origin } = allowOrigin_(e);

    const urlPath = path.replace(/^\/+/, '');
    // Basic route detection
    if (urlPath === 'api/config') {
      const token = e.parameter && e.parameter.token;
      if (token) {
        // Token-based config: return company-specific data
        const companyName = companyFromToken_(token);
        const company = { name: companyName };
        const products = getProductsByCompany_(companyName);
        const payload = { company, products };
        return jsonResponse_(payload, origin);
      } else {
        // Traditional config: return all companies and products
        const payload = getConfig_();
        return jsonResponse_(payload, origin);
      }
    }

    if (urlPath === 'api/leads') {
      const token = e.parameter && e.parameter.token;
      const companyName = companyFromToken_(token);
      const status = e.parameter && e.parameter.status;
      const from = e.parameter && e.parameter.from;
      const to = e.parameter && e.parameter.to;
      const payload = listLeadsForCompany_(companyName, { status, from, to });
      return jsonResponse_(payload, origin);
    }

    if (urlPath === 'api/stats') {
      const token = e.parameter && e.parameter.token;
      const companyName = companyFromToken_(token);
      const from = e.parameter && e.parameter.from;
      const to = e.parameter && e.parameter.to;
      const payload = getStatsForCompany_(companyName, { from, to });
      return jsonResponse_(payload, origin);
    }

    return jsonResponse_({ error: 'Not found' }, origin, 404);
  } catch (err) {
    return jsonResponse_({ error: String(err.message || err) }, (e && e.headers && e.headers.origin) || '', 400);
  }
}

function handleApiPost_(e) {
  try {
    const path = (e && e.pathInfo) ? String(e.pathInfo) : '';
    const { origin } = allowOrigin_(e);

    if (path === 'api/leads') {
      const body = parseBody_(e);
      const payload = normalizeLeadBody_(body);
      const result = createLead_(payload, 'agent ui');
      return jsonResponse_(result, origin);
    }

    // PATCH via POST (with _method=PATCH) to api/leads/:id
    const patchId = (path.match(/^api\/leads\/([^\/]+)$/) || [])[1];
    if (patchId) {
      const body = parseBody_(e);
      const methodOverride = (e.parameter && e.parameter._method) || (body && body._method) || '';
      if (String(methodOverride).toUpperCase() !== 'PATCH') {
        return jsonResponse_({ error: 'Use PATCH override' }, origin, 405);
      }
      const token = (e.parameter && e.parameter.token) || (body && body.token);
      const companyName = companyFromToken_(token);
      const status = (e.parameter && e.parameter.status) || (body && body.status);
      const result = updateLeadStatusForCompany_(companyName, patchId, status, 'client ui');
      return jsonResponse_(result, origin);
    }

    return jsonResponse_({ error: 'Not found' }, origin, 404);
  } catch (err) {
    const origin = (e && e.headers && e.headers.origin) || '';
    return jsonResponse_({ error: String(err.message || err) }, origin, 400);
  }
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  const ctype = (e.postData.type || '').toLowerCase();
  const raw = e.postData.contents;
  if (ctype.indexOf('application/json') >= 0) {
    try { return JSON.parse(raw); } catch (err) { return {}; }
  }
  if (ctype.indexOf('application/x-www-form-urlencoded') >= 0) {
    const out = {};
    raw.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      out[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    return out;
  }
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
  // Apps Script Web Apps handle CORS automatically for most cases
  // For additional security, we validate origins in the calling functions
  const out = ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return out;
}
