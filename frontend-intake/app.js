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
    if (!$('#company').value.trim()) errors.company = 'Required';
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
    const res = await fetch(url, Object.assign({ 
      headers: { 'Content-Type': 'application/json' }
    }, opts || {}));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function loadConfig() {
    console.log('Loading config from:', API() + '/api/config');
    console.log('API_BASE from config:', API());
    const cfg = await fetchJSON(API() + '/api/config');
    console.log('Config loaded successfully:', cfg);
    PRODUCTS_BY_COMPANY = cfg.productsByCompany || {};
    populateCompanies(cfg.companies || []);
  }

  async function submitLead(payload) {
    const res = await fetchJSON(API() + '/api/leads', {
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
    
    // Debug: Check config loading
    console.log('window.APP_CONFIG:', window.APP_CONFIG);
    console.log('Checking API_BASE availability...');
    
    // Load configuration
    try { 
      await loadConfig(); 
    } catch (e) { 
      console.error('Config loading failed:', e);
      showError('Failed to load configuration. Check API_BASE in config.js'); 
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
      const payload = {
        companyName: $('#company').value.trim(),
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
