(function(){
  const API = () => (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || '';
  const PLACES_KEY = () => (window.APP_CONFIG && window.APP_CONFIG.PLACES_API_KEY) || '';
  
  let PRODUCTS_BY_COMPANY = {};
  let addressParts = { street: '', city: '', state: '', postal: '' };
  let placesAutocomplete = null;

  const $ = sel => document.querySelector(sel);
  
  function showError(msg) { 
    const b = $('#errorBanner'); 
    b.textContent = msg; 
    b.style.display = 'block'; 
  }
  
  function clearError() { 
    const b = $('#errorBanner'); 
    b.style.display = 'none'; 
    b.textContent = ''; 
  }
  
  function showToast(msg) { 
    const t = $('#toast'); 
    t.textContent = msg; 
    t.classList.add('show'); 
    setTimeout(() => t.classList.remove('show'), 2400); 
  }
  
  function sanitize(s) { 
    const span = document.createElement('span'); 
    span.innerText = (s == null) ? '' : String(s); 
    return span.innerHTML; 
  }

  function populateCompanies(companies) {
    const sel = $('#company'); 
    sel.innerHTML = '<option value="">Select company</option>' + 
      companies.map(c => '<option value="' + sanitize(c.name) + '">' + sanitize(c.name) + '</option>').join('');
  }
  
  function populateProducts(company) {
    const sel = $('#product');
    const items = PRODUCTS_BY_COMPANY[company] || [];
    sel.innerHTML = '<option value="">Select product</option>' + 
      items.map(p => '<option data-sku="' + sanitize(p.sku) + '" data-price="' + Number(p.price) + '">' + sanitize(p.name) + '</option>').join('');
    $('#productPrice').value = '';
    // Note: Lead Value field removed per requirements
  }
  
  function onProductChange() {
    const sel = $('#product'); 
    const opt = sel.options[sel.selectedIndex];
    const price = Number(opt && opt.getAttribute('data-price')) || 0;
    $('#productPrice').value = price ? '$' + price.toFixed(2) : '';
    // Note: Lead Value field removed per requirements - value is set server-side to product price
  }

  function showLoading() {
    $('#loadingSpinner').style.display = 'block';
    $('#mainForm').style.display = 'none';
  }
  
  function hideLoading() {
    $('#loadingSpinner').style.display = 'none';
    $('#mainForm').style.display = 'block';
  }

  function setupCompanyMode(company, products) {
    // Hide the company selection section
    const companySection = document.querySelector('.form-section');
    if (companySection) {
      companySection.style.display = 'none';
    }
    
    // Update the header to show the company name
    const header = document.querySelector('.intake-header h2');
    if (header) {
      header.innerHTML = `📞 Call Intake Form<br><span style="font-size: 0.7em; color: var(--primary); font-weight: normal;">for ${sanitize(company.name)}</span>`;
    }
    
    // Populate products for this company only
    const sel = $('#product');
    sel.innerHTML = '<option value="">Select product/service...</option>';
    
    // Ensure products is an array
    const productArray = Array.isArray(products) ? products : [];
    
    productArray.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.name;
      opt.setAttribute('data-sku', p.sku);
      opt.setAttribute('data-price', p.price);
      opt.textContent = `${p.name} - $${p.price}`;
      sel.appendChild(opt);
    });
    
    // Store company info for form submission
    window.SELECTED_COMPANY = company.name;
    
    // Update tabindex since company field is hidden
    updateTabIndexForCompanyMode();
    
    // Hide loading and show form
    hideLoading();
    
    // Auto-focus to first name field
    setTimeout(() => {
      $('#firstName').focus();
    }, 100);
  }

  function updateTabIndexForCompanyMode() {
    // Shift all tabindex down by 1 since company field (tabindex 1) is hidden
    // Also removed Lead Value field per requirements
    $('#firstName').setAttribute('tabindex', '1');
    $('#lastName').setAttribute('tabindex', '2');
    $('#addressStreet').setAttribute('tabindex', '3');
    $('#addressCity').setAttribute('tabindex', '4');
    $('#addressState').setAttribute('tabindex', '5');
    $('#addressPostal').setAttribute('tabindex', '6');
    $('#reason').setAttribute('tabindex', '7');
    $('#reasonOther').setAttribute('tabindex', '8');
    $('#product').setAttribute('tabindex', '9');
    $('#notes').setAttribute('tabindex', '10');
    $('#submitBtn').setAttribute('tabindex', '11');
  }

  function initPlaces() {
    console.log('Initializing Google Places autocomplete...');
    
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      console.error('Google Places API not available');
      showToast('❌ Google Places API not loaded');
      return;
    }
    
    const streetInput = $('#addressStreet');
    if (!streetInput) {
      console.error('Street address input not found');
      return;
    }
    
    try {
      placesAutocomplete = new google.maps.places.Autocomplete(streetInput, {
        fields: ['address_components', 'formatted_address'],
        types: ['address']
      });
      
      console.log('Google Places autocomplete initialized successfully');
      
      // Visual indicator
      streetInput.placeholder = '🌍 Start typing address...';
      streetInput.style.borderLeft = '3px solid #10b981';
      showToast('📍 Google Places autocomplete ready!');
      
      placesAutocomplete.addListener('place_changed', () => {
        console.log('Place changed event triggered');
        
        const place = placesAutocomplete.getPlace();
        console.log('Selected place:', place);
        
        if (!place || !place.address_components) {
          console.log('No address components found');
          return;
        }
        
        // Parse address components
        const byType = {};
        place.address_components.forEach(c => {
          c.types.forEach(t => byType[t] = c.long_name);
        });
        
        const streetNumber = byType['street_number'] || '';
        const route = byType['route'] || '';
        const streetAddress = [streetNumber, route].filter(Boolean).join(' ').trim();
        const city = byType['locality'] || byType['postal_town'] || '';
        const state = byType['administrative_area_level_1'] || '';
        const postal = byType['postal_code'] || '';
        
        // Update address parts
        addressParts = { 
          street: streetAddress, 
          city: city, 
          state: state, 
          postal: postal 
        };
        
        // Auto-fill the address fields
        if (streetAddress) $('#addressStreet').value = streetAddress;
        if (city) $('#addressCity').value = city;
        if (state) $('#addressState').value = state.toUpperCase().slice(0, 2);
        if (postal) $('#addressPostal').value = postal;
        
        console.log('Address fields auto-filled:', addressParts);
        showToast('✅ Address auto-filled from Google Places');
        
        // Auto-advance to next logical field
        setTimeout(() => {
          const reasonField = $('#reason');
          if (reasonField) reasonField.focus();
        }, 200);
      });
      
    } catch (error) {
      console.error('Error initializing Google Places:', error);
      showToast('❌ Failed to initialize Google Places: ' + error.message);
      
      streetInput.placeholder = 'Enter street address manually';
      streetInput.style.borderLeft = '3px solid #ef4444';
    }
  }

  function validate() {
    const errors = {};
    
    // Only validate company if it's visible (not in token mode)
    const companyField = $('#company');
    const companySection = companyField.closest('.form-section');
    const isCompanyVisible = companySection && companySection.style.display !== 'none';
    
    console.log('🔍 Company field validation:', {
      fieldExists: !!companyField,
      sectionExists: !!companySection,
      sectionDisplay: companySection ? companySection.style.display : 'not found',
      isVisible: isCompanyVisible,
      fieldValue: companyField ? companyField.value : 'no field',
      selectedCompany: window.SELECTED_COMPANY
    });
    
    if (isCompanyVisible && !companyField.value.trim() && !window.SELECTED_COMPANY) {
      errors.company = 'Required';
    }
    
    if (!$('#firstName').value.trim()) errors.firstName = 'Required';
    if (!$('#lastName').value.trim()) errors.lastName = 'Required';
    if (!$('#addressStreet').value.trim()) errors.addressStreet = 'Required';
    if (!$('#addressCity').value.trim()) errors.addressCity = 'Required';
    if (!$('#addressState').value.trim()) errors.addressState = 'Required';
    if (!$('#addressPostal').value.trim()) errors.addressPostal = 'Required';
    if (!$('#reason').value.trim()) errors.reason = 'Required';
    if (!$('#product').value.trim()) errors.product = 'Required';
    
    console.log('🔍 Validation errors found:', errors);
    console.log('📋 Field values:', {
      firstName: $('#firstName').value,
      lastName: $('#lastName').value,
      addressStreet: $('#addressStreet').value,
      addressCity: $('#addressCity').value,
      addressState: $('#addressState').value,
      addressPostal: $('#addressPostal').value,
      reason: $('#reason').value,
      product: $('#product').value
    });
    
    document.querySelectorAll('.error').forEach(el => el.textContent = '');
    Object.keys(errors).forEach(k => { 
      const el = document.querySelector('.error[data-for="'+k+'"]'); 
      if (el) el.textContent = errors[k]; 
    });
    
    const isValid = Object.keys(errors).length === 0;
    console.log('📊 Final validation result:', isValid, 'Errors:', Object.keys(errors));
    return isValid;
  }

  async function fetchJSON(url, opts) {
    console.log('🌐 fetchJSON called with:', { url, opts });
    
    // For GET requests, try JSONP-style approach to bypass CORS
    if (!opts || !opts.method || opts.method === 'GET') {
      console.log('🔄 Attempting JSONP-style approach for GET request');
      return await fetchViaJSONP(url);
    }
    
    // For POST requests, use text/plain approach
    console.log('📤 Using text/plain POST request for:', opts.method);
    
    try {
      // Use text/plain to avoid CORS preflight requests with Apps Script
      const fetchOptions = Object.assign({ 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      }, opts || {});
      
      console.log('📤 Fetch options:', fetchOptions);
      console.log('🔍 Headers being sent:', fetchOptions.headers);
      
      const res = await fetch(url, fetchOptions);
      
      console.log('📡 Fetch response received:', {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        url: res.url,
        type: res.type,
        redirected: res.redirected
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ HTTP Error Response:', {
          status: res.status,
          statusText: res.statusText,
          body: errorText
        });
        throw new Error(`HTTP ${res.status}: ${res.statusText} - ${errorText}`);
      }
      
      const responseText = await res.text();
      console.log('📝 Raw response text:', responseText);
      
      try {
        const jsonData = JSON.parse(responseText);
        console.log('✅ JSON response parsed successfully:', jsonData);
        return jsonData;
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        console.error('📄 Response was not valid JSON:', responseText);
        throw new Error(`Invalid JSON response: ${responseText}`);
      }
      
    } catch (error) {
      console.error('💥 fetchJSON error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        url: url
      });
      
      // Enhanced error information
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        console.error('🚫 This is likely a CORS or network connectivity issue');
        console.error('🔍 Troubleshooting info:', {
          'Current API_BASE': API(),
          'Target URL': url,
          'Browser Origin': window.location.origin,
          'User Agent': navigator.userAgent
        });
      }
      
      throw error;
    }
  }

  async function fetchViaJSONP(url) {
    console.log('🔄 Using JSONP-style approach for:', url);
    
    return new Promise((resolve, reject) => {
      // Create a unique callback name
      const callbackName = 'jsonp_callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      // Add callback parameter to URL
      const separator = url.includes('?') ? '&' : '?';
      const jsonpUrl = url + separator + 'callback=' + callbackName;
      
      console.log('📞 JSONP URL:', jsonpUrl);
      
      // Create global callback function
      window[callbackName] = function(data) {
        console.log('✅ JSONP callback received data:', data);
        delete window[callbackName]; // Clean up
        document.head.removeChild(script); // Clean up
        resolve(data);
      };
      
      // Create script tag
      const script = document.createElement('script');
      script.src = jsonpUrl;
      script.onerror = function() {
        console.error('❌ JSONP script loading failed');
        delete window[callbackName]; // Clean up
        document.head.removeChild(script); // Clean up
        reject(new Error('JSONP request failed'));
      };
      
      // Add timeout
      const timeout = setTimeout(() => {
        console.error('⏰ JSONP request timed out');
        delete window[callbackName]; // Clean up
        if (script.parentNode) {
          document.head.removeChild(script); // Clean up
        }
        reject(new Error('JSONP request timed out'));
      }, 10000);
      
      // Clear timeout when callback is called
      const originalCallback = window[callbackName];
      window[callbackName] = function(data) {
        clearTimeout(timeout);
        originalCallback(data);
      };
      
      // Add script to head to trigger request
      document.head.appendChild(script);
    });
  }

  async function loadConfig() {
    // Check if we have a company token in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const companyToken = urlParams.get('token');
    
    // If we have a token, load config for specific company
    const configUrl = companyToken ? 
      API() + '?api=config&token=' + encodeURIComponent(companyToken) :
      API() + '?api=config';
      
    console.log('Loading config from:', configUrl);
    console.log('API_BASE from config:', API());
    console.log('Company token from URL:', companyToken);
      
    const cfg = await fetchJSON(configUrl);
    console.log('Config loaded successfully:', cfg);
    
    // Store the company info if token-based
    if (companyToken && cfg.company) {
      window.CURRENT_COMPANY = cfg.company;
      setupCompanyMode(cfg.company, cfg.products || []);
    } else {
      // Traditional mode - show all companies
      PRODUCTS_BY_COMPANY = cfg.productsByCompany || {};
      populateCompanies(cfg.companies || []);
      hideLoading();
      setTimeout(() => $('#company').focus(), 100);
    }
  }

  async function submitLead(payload) {
    // Add token to the request if we have one
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    const url = token ? 
      API() + '?api=leads&token=' + encodeURIComponent(token) :
      API() + '?api=leads';
      
    console.log('📤 Submit URL with token:', url);
    
    const res = await fetchJSON(url, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res;
  }

  function resetForm() {
    $('#intakeForm').reset();
    addressParts = { street: '', city: '', state: '', postal: '' };
    $('#product').innerHTML = '<option value="">Select product</option>';
    $('#productPrice').value = '';
    $('#reasonOtherWrap').style.display = 'none';
    
    // Reset address field styling
    const streetField = $('#addressStreet');
    if (streetField && window.google && window.google.maps) {
      streetField.placeholder = '🌍 Start typing address...';
      streetField.style.borderLeft = '3px solid #10b981';
    }
  }

  document.addEventListener('DOMContentLoaded', async function(){
    clearError();
    
    // Basic config check
    console.log('Loading intake form...');
    
    // Check if config loaded properly
    if (!window.APP_CONFIG) {
      console.error('❌ window.APP_CONFIG is not defined! config.js may not have loaded.');
      showError('Configuration not loaded. Check if config.js is accessible.');
      return;
    }
    
    if (!API()) {
      console.error('❌ API_BASE is empty or undefined!');
      showError('API_BASE not configured. Check config.js file.');
      return;
    }
    
    console.log('✅ Configuration appears loaded, attempting API call...');
    
    // First test basic connectivity
    console.log('🧪 Testing basic Apps Script connectivity...');
    try {
      const testUrl = API() + '?test=ping&callback=testPingCallback';
      console.log('🧪 Testing URL:', testUrl);
      
      window.testPingCallback = function(data) {
        console.log('🎉 BASIC CONNECTIVITY TEST SUCCESSFUL:', data);
        delete window.testPingCallback;
        
        // Now try loading config
        loadConfigAfterTest();
      };
      
      const testScript = document.createElement('script');
      testScript.src = testUrl;
      testScript.onerror = function() {
        console.error('❌ BASIC CONNECTIVITY TEST FAILED');
        showError('Apps Script endpoint not responding. Check deployment.');
      };
      document.head.appendChild(testScript);
      
    } catch (e) {
      console.error('💥 Basic connectivity test failed:', e);
      showError('Failed to test Apps Script connectivity.');
    }
    
    async function loadConfigAfterTest() {
      console.log('🚀 Basic test passed, now loading config...');
      
      try { 
        await loadConfig(); 
      } catch (e) { 
        console.error('💥 Config loading failed with full error details:', e);
        
        // Hide loading and show error
        hideLoading();
        
        // Enhanced error message
        let errorMsg = 'Failed to load configuration.';
        if (e.name === 'TypeError' && e.message.includes('Failed to fetch')) {
          errorMsg += ' CORS or network issue detected.';
        } else {
          errorMsg += ` Error: ${e.message}`;
        }
        
        showError(errorMsg); 
      }
    }
    
    // Event listeners
    $('#company').addEventListener('change', function(){ 
      populateProducts(this.value); 
    });
    
    $('#product').addEventListener('change', onProductChange);
    
    $('#reason').addEventListener('change', function(){ 
      $('#reasonOtherWrap').style.display = (this.value === 'Other…') ? 'block' : 'none'; 
    });
    
    // Add direct button click handler for debugging
    $('#submitBtn').addEventListener('click', function(e) {
      console.log('🔘 SUBMIT BUTTON CLICKED');
      console.log('🔘 Button disabled?', this.disabled);
      console.log('🔘 Event target:', e.target);
      console.log('🔘 Form element:', $('#intakeForm'));
      
      // Test if form submission works
      console.log('🧪 Testing form submission trigger...');
      
      // Check if all required fields are filled
      const requiredFields = ['firstName', 'lastName', 'addressStreet', 'addressCity', 'addressState', 'addressPostal', 'reason', 'product'];
      const fieldStatus = {};
      requiredFields.forEach(fieldId => {
        const field = $('#' + fieldId);
        fieldStatus[fieldId] = field ? field.value.trim() : 'FIELD_NOT_FOUND';
      });
      console.log('📋 Required field status:', fieldStatus);
      
      // Check if company is selected (token mode or manual)
      console.log('🏢 Company selection status:', {
        tokenCompany: window.SELECTED_COMPANY,
        dropdownCompany: $('#company').value,
        finalCompany: window.SELECTED_COMPANY || $('#company').value.trim()
      });
    });
    
    $('#intakeForm').addEventListener('submit', async function(e){
      console.log('🚀 FORM SUBMIT EVENT TRIGGERED');
      e.preventDefault();
      clearError();
      
      console.log('📝 Starting form validation...');
      const validationResult = validate();
      console.log('✅ Validation result:', validationResult);
      
      if (!validationResult) {
        console.log('❌ Validation failed, stopping submission');
        return;
      }
      
      console.log('✅ Validation passed, proceeding with submission');
      
      const productSel = $('#product'); 
      const opt = productSel.options[productSel.selectedIndex];
      // Use token-based company or selected company
      const companyName = window.SELECTED_COMPANY || $('#company').value.trim();
      
      console.log('🏢 Company for submission:', companyName);
      console.log('📦 Selected product:', opt ? opt.value : 'none');
      
      const payload = {
        companyName: companyName,
        customerFirstName: $('#firstName').value.trim(),
        customerLastName: $('#lastName').value.trim(),
        address: {
          street: $('#addressStreet').value.trim(),
          city: $('#addressCity').value.trim(),
          state: $('#addressState').value.trim(),
          postal: $('#addressPostal').value.trim()
        },
        reasonForCall: $('#reason').value.trim(),
        reasonCustom: $('#reasonOther').value.trim(),
        productSku: opt ? opt.getAttribute('data-sku') : '',
        productName: productSel.value.trim(),
        productPrice: $('#productPrice').value ? Number($('#productPrice').value.replace('$', '')) : '',
        leadValue: $('#productPrice').value ? Number($('#productPrice').value.replace('$', '')) : '', // Use product price as lead value
        notes: $('#notes').value.trim()
      };
      
      console.log('💾 Form submission payload:', payload);
      
      $('#submitBtn').disabled = true;
      $('#submitBtn').textContent = '⏳ Saving...';
      
      try {
        console.log('📤 Submitting lead...');
        const result = await submitLead(payload);
        console.log('✅ Lead submitted successfully:', result);
        showToast('✅ Lead saved to CRM!');
        resetForm();
      } catch (err) {
        console.error('💥 Submit failed with error:', err);
        showError(`Submit failed: ${err.message}`);
      } finally {
        $('#submitBtn').disabled = false;
        $('#submitBtn').textContent = '💾 Save Lead (Ctrl+Enter)';
      }
    });

    // Load Places library if configured
    const placesKey = PLACES_KEY();
    if (placesKey) {
      const s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(placesKey) + '&libraries=places&v=weekly';
      s.async = true; 
      s.defer = true; 
      s.onload = () => initPlaces();
      document.head.appendChild(s);
    }
  });
})();
