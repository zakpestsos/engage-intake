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
    $('#leadValue').value = '';
  }
  
  function onProductChange() {
    const sel = $('#product'); 
    const opt = sel.options[sel.selectedIndex];
    const price = Number(opt && opt.getAttribute('data-price')) || 0;
    $('#productPrice').value = price ? String(price) : '';
    if (!$('#leadValue').value) $('#leadValue').value = price ? String(price) : '';
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
    products.forEach(p => {
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
    
    // Auto-focus to first name field
    setTimeout(() => {
      $('#firstName').focus();
    }, 100);
  }

  function updateTabIndexForCompanyMode() {
    // Shift all tabindex down by 1 since company field (tabindex 1) is hidden
    $('#firstName').setAttribute('tabindex', '1');
    $('#lastName').setAttribute('tabindex', '2');
    $('#addressStreet').setAttribute('tabindex', '3');
    $('#addressCity').setAttribute('tabindex', '4');
    $('#addressState').setAttribute('tabindex', '5');
    $('#addressPostal').setAttribute('tabindex', '6');
    $('#reason').setAttribute('tabindex', '7');
    $('#reasonOther').setAttribute('tabindex', '8');
    $('#product').setAttribute('tabindex', '9');
    $('#leadValue').setAttribute('tabindex', '10');
    $('#notes').setAttribute('tabindex', '11');
    $('#submitBtn').setAttribute('tabindex', '12');
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
    if (companyField.style.display !== 'none' && !companyField.value.trim()) {
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
    
    document.querySelectorAll('.error').forEach(el => el.textContent = '');
    Object.keys(errors).forEach(k => { 
      const el = document.querySelector('.error[data-for="'+k+'"]'); 
      if (el) el.textContent = errors[k]; 
    });
    return Object.keys(errors).length === 0;
  }

  async function fetchJSON(url, opts) {
    console.log('🌐 fetchJSON called with:', { url, opts });
    
    try {
      const res = await fetch(url, Object.assign({ 
        headers: { 'Content-Type': 'application/json' }
      }, opts || {}));
      
      console.log('📡 Fetch response received:', {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        url: res.url
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
      
      const jsonData = await res.json();
      console.log('✅ JSON response parsed successfully:', jsonData);
      return jsonData;
      
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

  async function loadConfig() {
    // Check if we have a company token in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const companyToken = urlParams.get('token');
    
    console.log('Loading config from:', API() + '/api/config');
    console.log('API_BASE from config:', API());
    console.log('Company token from URL:', companyToken);
    
    // If we have a token, load config for specific company
    const configUrl = companyToken ? 
      API() + '?api=config&token=' + encodeURIComponent(companyToken) :
      API() + '?api=config';
      
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
    }
  }

  async function submitLead(payload) {
    const res = await fetchJSON(API() + '?api=leads', {
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
    $('#leadValue').value = '';
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
    
    // Enhanced Debug: Check config loading
    console.log('🔧 Debugging configuration loading...');
    console.log('📋 window.APP_CONFIG:', window.APP_CONFIG);
    console.log('🌐 API_BASE function result:', API());
    console.log('🗝️ PLACES_KEY function result:', PLACES_KEY());
    console.log('📍 Current page URL:', window.location.href);
    console.log('🔗 Current origin:', window.location.origin);
    
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
    
    // Load configuration
    try { 
      await loadConfig(); 
    } catch (e) { 
      console.error('💥 Config loading failed with full error details:', e);
      
      // Enhanced error message
      let errorMsg = 'Failed to load configuration.';
      if (e.name === 'TypeError' && e.message.includes('Failed to fetch')) {
        errorMsg += ' CORS or network issue detected.';
      } else {
        errorMsg += ` Error: ${e.message}`;
      }
      
      showError(errorMsg); 
    }
    
    // Event listeners
    $('#company').addEventListener('change', function(){ 
      populateProducts(this.value); 
    });
    
    $('#product').addEventListener('change', onProductChange);
    
    $('#reason').addEventListener('change', function(){ 
      $('#reasonOtherWrap').style.display = (this.value === 'Other…') ? 'block' : 'none'; 
    });
    
    $('#intakeForm').addEventListener('submit', async function(e){
      e.preventDefault();
      clearError();
      if (!validate()) return;
      
      const productSel = $('#product'); 
      const opt = productSel.options[productSel.selectedIndex];
      // Use token-based company or selected company
      const companyName = window.SELECTED_COMPANY || $('#company').value.trim();
      
      const payload = {
        companyName: companyName,
        customerFirstName: $('#firstName').value.trim(),
        customerLastName: $('#lastName').value.trim(),
        address: addressParts,
        reasonForCall: $('#reason').value.trim(),
        reasonCustom: $('#reasonOther').value.trim(),
        productSku: opt ? opt.getAttribute('data-sku') : '',
        productName: productSel.value.trim(),
        productPrice: $('#productPrice').value ? Number($('#productPrice').value) : '',
        leadValue: $('#leadValue').value ? Number($('#leadValue').value) : '',
        notes: $('#notes').value.trim()
      };
      
      $('#submitBtn').disabled = true;
      try {
        await submitLead(payload);
        showToast('Lead submitted successfully.');
        resetForm();
      } catch (err) {
        showError('Submit failed. Check API_BASE in config.js and ensure CORS is enabled.');
      } finally {
        $('#submitBtn').disabled = false;
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
