(function(){
  const API = () => (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || '';
  const PLACES_KEY = () => (window.APP_CONFIG && window.APP_CONFIG.PLACES_API_KEY) || '';
  
  let COMPANY_PRODUCTS = {};
  let allServices = [];
  let filteredServices = [];
  let selectedService = null;
  let selectedCustomerNeed = null;
  let addressParts = { street: '', city: '', state: '', postal: '' };
  let placesAutocomplete = null;
  let currentAreaUnit = 'sqft';
  let currentCallType = 'new-sale'; // 'new-sale' or 'service'

  const $ = sel => document.querySelector(sel);
  const $$ = sel => document.querySelectorAll(sel);
  
  // Utility Functions
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
  
  function showToast(msg, isError = false) { 
    const t = $('#toast'); 
    t.textContent = msg; 
    t.classList.add('show');
    if (isError) {
      t.classList.add('error');
    } else {
      t.classList.remove('error');
    }
    setTimeout(() => t.classList.remove('show'), 3000); 
  }
  
  function sanitize(s) { 
    const span = document.createElement('span'); 
    span.innerText = (s == null) ? '' : String(s); 
    return span.innerHTML; 
  }

  // Call Type Handling
  function setCallType(type) {
    currentCallType = type;
    
    // Update button states
    $('#newSaleBtn').classList.toggle('active', type === 'new-sale');
    $('#serviceBtn').classList.toggle('active', type === 'service');
    
    if (type === 'new-sale') {
      // New Sale mode: Show service selection
      $('#serviceCardTitle').innerHTML = 'Select Service <span class="required" id="serviceRequired">*</span><span class="service-count" id="serviceCount">' + 
        (allServices.length > 0 ? allServices.length + ' services available' : 'Enter property area first') + '</span>';
      $('#serviceSearch').style.display = 'block';
      $('#newSaleServiceContent').style.display = 'block';
      $('#serviceCallNeedsContent').style.display = 'none';
      $('#newSaleReasonWrap').style.display = 'block';
      $('#notesLabel').textContent = 'Call Notes & Details';
      showToast('New Sale mode - Service selection required');
    } else {
      // Service mode: Show customer needs (replaces service issue dropdown)
      $('#serviceCardTitle').innerHTML = 'What Does Customer Need? <span class="required">*</span>';
      $('#serviceSearch').style.display = 'none';
      $('#newSaleServiceContent').style.display = 'none';
      $('#serviceCallNeedsContent').style.display = 'block';
      $('#newSaleReasonWrap').style.display = 'none';
      $('#notesLabel').textContent = 'Service Issue Details';
      showToast('Service Call mode - Select customer need');
      
      // Clear selected service when switching to service mode
      selectedService = null;
      selectedCustomerNeed = null;
      hideSelectedService();
    }
  }

  function initCallTypeButtons() {
    $('#newSaleBtn').addEventListener('click', () => setCallType('new-sale'));
    $('#serviceBtn').addEventListener('click', () => setCallType('service'));
  }

  // Customer Needs Selection
  function initCustomerNeeds() {
    $$('.need-card').forEach(card => {
      card.addEventListener('click', () => {
        const needValue = card.getAttribute('data-need');
        selectCustomerNeed(needValue);
      });
    });
  }

  function selectCustomerNeed(need) {
    selectedCustomerNeed = need;
    
    // Update card states
    $$('.need-card').forEach(card => {
      card.classList.toggle('selected', card.getAttribute('data-need') === need);
    });
    
    // Clear error
    clearFieldError('customerNeed');
    
    showToast('Customer need selected: ' + need);
  }

  // Area Converter
  function initAreaConverter() {
    const sqftBtn = $('#sqftBtn');
    const acreBtn = $('#acreBtn');
    
    sqftBtn.addEventListener('click', () => setAreaUnit('sqft'));
    acreBtn.addEventListener('click', () => setAreaUnit('acres'));
  }
  
  function setAreaUnit(unit) {
    currentAreaUnit = unit;
    const sqftBtn = $('#sqftBtn');
    const acreBtn = $('#acreBtn');
    const areaInput = $('#areaInput');
    
    if (unit === 'sqft') {
      sqftBtn.classList.add('active');
      acreBtn.classList.remove('active');
      areaInput.placeholder = 'Enter square feet';
    } else {
      acreBtn.classList.add('active');
      sqftBtn.classList.remove('active');
      areaInput.placeholder = 'Enter acres';
    }
    
    onAreaInputChange();
  }
  
  function updateAreaConversion() {
    const areaInput = $('#areaInput');
    const conversionDisplay = $('#conversionDisplay');
    const value = Number(areaInput.value) || 0;
    
    if (value <= 0) {
      conversionDisplay.textContent = '';
      return;
    }
    
    if (currentAreaUnit === 'acres') {
      const sqft = Math.round(value * 43560);
      conversionDisplay.textContent = `≈ ${sqft.toLocaleString()} square feet`;
    } else {
      const acres = (value / 43560).toFixed(3);
      conversionDisplay.textContent = `≈ ${acres} acres`;
    }
  }
  
  function getSquareFootage() {
    const areaInput = $('#areaInput');
    const value = Number(areaInput.value) || 0;
    
    if (currentAreaUnit === 'acres') {
      return Math.round(value * 43560);
    } else {
      return value;
    }
  }

  function onAreaInputChange() {
    const areaValue = Number($('#areaInput').value) || 0;
    updateAreaConversion();
    
    if (areaValue > 0) {
      loadServicesForArea(getSquareFootage());
    } else {
      clearServiceGrid();
    }
  }

  // Service Grid Management
  function loadServicesForArea(sqft) {
    allServices = [];
    
    Object.keys(COMPANY_PRODUCTS).forEach(productName => {
      const variants = COMPANY_PRODUCTS[productName];
      
      const matchingVariant = variants.find(p => 
        sqft >= p.sqFtMin && sqft <= p.sqFtMax
      );
      
      if (matchingVariant) {
        allServices.push({
          name: productName,
          sku: matchingVariant.sku,
          initialPrice: matchingVariant.initialPrice,
          recurringPrice: matchingVariant.recurringPrice,
          sqFtMin: matchingVariant.sqFtMin,
          sqFtMax: matchingVariant.sqFtMax
        });
      }
    });
    
    filteredServices = [...allServices];
    renderServiceGrid();
    updateServiceCount();
  }

  function clearServiceGrid() {
    const grid = $('#serviceGrid');
    grid.innerHTML = `
      <div class="no-services">
        <div class="no-services-icon">📏</div>
        <div class="no-services-text">Enter property area above to view available services</div>
      </div>
    `;
    selectedService = null;
    hideSelectedService();
    updateServiceCount();
  }

  function renderServiceGrid() {
    const grid = $('#serviceGrid');
    
    if (filteredServices.length === 0) {
      grid.innerHTML = `
        <div class="no-services">
          <div class="no-services-icon">🔍</div>
          <div class="no-services-text">No services match your search</div>
        </div>
      `;
      return;
    }
    
    grid.innerHTML = filteredServices.map(service => `
      <div class="service-item ${selectedService && selectedService.name === service.name ? 'selected' : ''}" 
           data-service-name="${sanitize(service.name)}">
        <div class="service-item-header">
          <div class="service-item-name">${sanitize(service.name)}</div>
          <div class="service-item-check">${selectedService && selectedService.name === service.name ? '✓' : ''}</div>
        </div>
        <div class="service-item-pricing">
          <div class="service-price">
            <div class="service-price-label">Initial</div>
            <div class="service-price-value">$${service.initialPrice.toFixed(2)}</div>
          </div>
          <div class="service-price">
            <div class="service-price-label">Recurring</div>
            <div class="service-price-value">$${service.recurringPrice.toFixed(2)}</div>
          </div>
        </div>
      </div>
    `).join('');
    
    $$('.service-item').forEach(card => {
      card.addEventListener('click', () => {
        const serviceName = card.getAttribute('data-service-name');
        const service = allServices.find(s => s.name === serviceName);
        if (service) {
          selectService(service);
        }
      });
    });
  }

  function selectService(service) {
    selectedService = service;
    renderServiceGrid();
    showSelectedService();
    clearFieldError('product');
  }

  function showSelectedService() {
    const display = $('#selectedServiceDisplay');
    display.innerHTML = `
      <div class="selected-service-info">
        <div class="selected-service-name">${sanitize(selectedService.name)}</div>
        <div class="selected-service-pricing">
          <div class="pricing-box">
            <div class="pricing-label">Initial Price</div>
            <div class="pricing-value">$${selectedService.initialPrice.toFixed(2)}</div>
          </div>
          <div class="pricing-box">
            <div class="pricing-label">Recurring</div>
            <div class="pricing-value">$${selectedService.recurringPrice.toFixed(2)}</div>
          </div>
        </div>
      </div>
    `;
  }

  function hideSelectedService() {
    $('#selectedServiceDisplay').innerHTML = `
      <div class="no-selection">
        <div class="no-selection-icon">⬆️</div>
        <div class="no-selection-text">Select a service above</div>
      </div>
    `;
  }

  function updateServiceCount() {
    const count = filteredServices.length;
    const countEl = $('#serviceCount');
    if (!countEl) return; // Element not visible in service call mode
    
    if (count === 0 && allServices.length === 0) {
      countEl.textContent = 'Enter property area first';
      countEl.style.color = '#94a3b8';
    } else {
      countEl.textContent = `${count} service${count !== 1 ? 's' : ''} available`;
      countEl.style.color = '#10b981';
    }
  }

  // Service Search
  function initServiceSearch() {
    const searchInput = $('#serviceSearch');
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      
      if (!query) {
        filteredServices = [...allServices];
      } else {
        filteredServices = allServices.filter(service => 
          service.name.toLowerCase().includes(query)
        );
      }
      
      renderServiceGrid();
      updateServiceCount();
    });
  }

  // Phone Formatting
  function formatPhoneNumber(value) {
    const digits = value.replace(/\D/g, '');
    
    if (digits.length >= 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    } else if (digits.length >= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length >= 3) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return digits;
    }
  }
  
  function onPhoneInput(e) {
    const input = e.target;
    const cursorPos = input.selectionStart;
    const oldValue = input.value;
    const formatted = formatPhoneNumber(oldValue);
    
    if (formatted !== oldValue) {
      input.value = formatted;
      const diff = formatted.length - oldValue.length;
      input.setSelectionRange(cursorPos + diff, cursorPos + diff);
    }
  }

  // Google Places
  function initPlaces() {
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      console.error('Google Places API not available');
      return;
    }
    
    const streetInput = $('#addressStreet');
    if (!streetInput) return;
    
    try {
      placesAutocomplete = new google.maps.places.Autocomplete(streetInput, {
        fields: ['address_components', 'formatted_address'],
        types: ['address']
      });
      
      placesAutocomplete.addListener('place_changed', () => {
        const place = placesAutocomplete.getPlace();
        
        if (!place || !place.address_components) return;
        
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
        
        addressParts = { 
          street: streetAddress, 
          city: city, 
          state: state, 
          postal: postal 
        };
        
        if (streetAddress) $('#addressStreet').value = streetAddress;
        if (city) $('#addressCity').value = city;
        if (state) $('#addressState').value = state.toUpperCase().slice(0, 2);
        if (postal) $('#addressPostal').value = postal;
        
        showToast('Address auto-filled');
      });
      
    } catch (error) {
      console.error('Error initializing Google Places:', error);
    }
  }

  // Validation
  function clearFieldError(fieldId) {
    const errorEl = document.querySelector('.error[data-for="' + fieldId + '"]');
    if (errorEl) {
      errorEl.textContent = '';
    }
  }

  function validate() {
    const errors = {};
    
    // Basic customer information
    if (!$('#firstName').value.trim()) errors.firstName = 'Required';
    if (!$('#lastName').value.trim()) errors.lastName = 'Required';
    if (!$('#customerPhone').value.trim()) errors.customerPhone = 'Required';
    if (!$('#addressStreet').value.trim()) errors.addressStreet = 'Required';
    if (!$('#addressCity').value.trim()) errors.addressCity = 'Required';
    if (!$('#addressState').value.trim()) errors.addressState = 'Required';
    if (!$('#addressPostal').value.trim()) errors.addressPostal = 'Required';
    if (!$('#schedulingTold').value.trim()) errors.schedulingTold = 'Required';
    
    // Call type specific validation
    if (currentCallType === 'new-sale') {
      // New Sale: Require service selection and new sale reason
      if (!$('#newSaleReason').value.trim()) errors.newSaleReason = 'Required';
      if (!selectedService) errors.product = 'Please select a service';
      
      const areaValue = Number($('#areaInput').value) || 0;
      if (areaValue <= 0) {
        errors.squareFootage = 'Required for new sales';
      }
    } else {
      // Service Call: Require customer need selection
      if (!selectedCustomerNeed) errors.customerNeed = 'Please select what customer needs';
    }
    
    $$('.error').forEach(el => el.textContent = '');
    Object.keys(errors).forEach(k => { 
      const el = document.querySelector('.error[data-for="'+k+'"]'); 
      if (el) el.textContent = errors[k]; 
    });
    
    return Object.keys(errors).length === 0;
  }

  // API Communication
  async function fetchJSON(url, opts) {
    if (!opts || !opts.method || opts.method === 'GET') {
      return await fetchViaJSONP(url);
    }
    
    try {
      const fetchOptions = Object.assign({ 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      }, opts || {});
      
      const res = await fetch(url, fetchOptions);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const responseText = await res.text();
      return JSON.parse(responseText);
      
    } catch (error) {
      console.error('fetchJSON error:', error);
      throw error;
    }
  }

  async function fetchViaJSONP(url) {
    return new Promise((resolve, reject) => {
      const callbackName = 'jsonp_callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const separator = url.includes('?') ? '&' : '?';
      const jsonpUrl = url + separator + 'callback=' + callbackName;
      
      window[callbackName] = function(data) {
        delete window[callbackName];
        document.head.removeChild(script);
        resolve(data);
      };
      
      const script = document.createElement('script');
      script.src = jsonpUrl;
      script.onerror = function() {
        delete window[callbackName];
        document.head.removeChild(script);
        reject(new Error('JSONP request failed'));
      };
      
      const timeout = setTimeout(() => {
        delete window[callbackName];
        if (script.parentNode) {
          document.head.removeChild(script);
        }
        reject(new Error('JSONP request timed out'));
      }, 10000);
      
      const originalCallback = window[callbackName];
      window[callbackName] = function(data) {
        clearTimeout(timeout);
        originalCallback(data);
      };
      
      document.head.appendChild(script);
    });
  }

  async function loadConfig() {
    const urlParams = new URLSearchParams(window.location.search);
    const companyToken = urlParams.get('token');
    
    if (!companyToken) {
      throw new Error('No company token provided in URL');
    }
    
    const configUrl = API() + '?api=config&token=' + encodeURIComponent(companyToken);
      
    const cfg = await fetchJSON(configUrl);
    
    if (cfg.error) {
      throw new Error(cfg.error);
    }
    
    if (cfg.company) {
      window.CURRENT_COMPANY = cfg.company;
      window.SELECTED_COMPANY = cfg.company.name;
      setupCompanyMode(cfg.company, cfg.products || []);
    } else {
      throw new Error('Invalid response from server');
    }
  }

  function setupCompanyMode(company, products) {
    $('#companyName').textContent = company.name;
    
    const productGroups = {};
    (Array.isArray(products) ? products : []).forEach(p => {
      if (!productGroups[p.name]) {
        productGroups[p.name] = [];
      }
      productGroups[p.name].push(p);
    });
    
    COMPANY_PRODUCTS = productGroups;
    window.COMPANY_PRODUCTS = productGroups;
    
    hideLoading();
    
    setTimeout(() => {
      $('#firstName').focus();
    }, 100);
  }

  async function submitLead(payload) {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    const url = API() + '?api=leads&token=' + encodeURIComponent(token);
    
    const res = await fetchJSON(url, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res;
  }

  function hideLoading() {
    $('#loadingSpinner').style.display = 'none';
    $('#mainForm').style.display = 'block';
  }

  function resetForm() {
    $('#intakeForm').reset();
    addressParts = { street: '', city: '', state: '', postal: '' };
    selectedService = null;
    selectedCustomerNeed = null;
    clearServiceGrid();
    currentAreaUnit = 'sqft';
    setAreaUnit('sqft');
    
    // Clear customer need selections
    $$('.need-card').forEach(card => card.classList.remove('selected'));
    
    // Reset to New Sale mode
    setCallType('new-sale');
    
    // Clear all error messages
    $$('.error').forEach(el => el.textContent = '');
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', async function(){
    clearError();
    initCallTypeButtons();
    initCustomerNeeds();
    initAreaConverter();
    initServiceSearch();
    
    if (!window.APP_CONFIG || !API()) {
      showError('Configuration not loaded. Check config.js file.');
      return;
    }
    
    try { 
      await loadConfig(); 
    } catch (e) { 
      console.error('Config loading failed:', e);
      $('#loadingSpinner').style.display = 'none';
      showError(`Failed to load: ${e.message}`); 
    }
    
    // Event listeners
    $('#areaInput').addEventListener('input', onAreaInputChange);
    $('#customerPhone').addEventListener('input', onPhoneInput);
    
    $('#intakeForm').addEventListener('submit', async function(e){
      e.preventDefault();
      clearError();
      
      if (!validate()) {
        showToast('Please fill in all required fields', true);
        return;
      }
      
      const companyName = window.SELECTED_COMPANY;
      
      // Determine reason for call based on call type
      let reasonForCall, reasonCustom;
      if (currentCallType === 'new-sale') {
        reasonForCall = $('#newSaleReason').value.trim();
        reasonCustom = '';
      } else {
        // Service Call: Use customer need as reason
        reasonForCall = 'Service Call';
        reasonCustom = selectedCustomerNeed || '';
      }
      
      const payload = {
        companyName: companyName,
        customerFirstName: $('#firstName').value.trim(),
        customerLastName: $('#lastName').value.trim(),
        customerPhone: $('#customerPhone').value.trim(),
        customerEmail: $('#customerEmail').value.trim(),
        address: {
          street: $('#addressStreet').value.trim(),
          city: $('#addressCity').value.trim(),
          state: $('#addressState').value.trim(),
          postal: $('#addressPostal').value.trim()
        },
        reasonForCall: reasonForCall,
        reasonCustom: reasonCustom,
        schedulingTold: $('#schedulingTold').value.trim(),
        squareFootage: currentCallType === 'new-sale' ? getSquareFootage() : 0,
        notes: $('#notes').value.trim()
      };
      
      // Add product info only for new sales
      if (currentCallType === 'new-sale' && selectedService) {
        payload.productSku = selectedService.sku;
        payload.productName = selectedService.name;
        payload.initialPrice = selectedService.initialPrice;
        payload.recurringPrice = selectedService.recurringPrice;
        payload.leadValue = selectedService.initialPrice;
      } else {
        // Service calls - no product selected but include customer need in productName for reference
        payload.productSku = '';
        payload.productName = selectedCustomerNeed || '';
        payload.initialPrice = 0;
        payload.recurringPrice = 0;
        payload.leadValue = 0;
      }
      
      $('#submitBtn').disabled = true;
      $('#submitBtn').querySelector('.btn-text').textContent = 'Saving...';
      
      try {
        await submitLead(payload);
        showToast('Lead saved successfully!');
        resetForm();
      } catch (err) {
        console.error('Submit failed:', err);
        showToast(`Submit failed: ${err.message}`, true);
      } finally {
        $('#submitBtn').disabled = false;
        $('#submitBtn').querySelector('.btn-text').textContent = 'Save Lead';
      }
    });

    // Ctrl+Enter shortcut
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        $('#submitBtn').click();
      }
    });

    // Load Places library
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

