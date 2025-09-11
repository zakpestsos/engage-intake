(function(){
  const API = () => (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || '';
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
  
  function fmtMoney(v) { 
    return '$' + (Number(v || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 }); 
  }
  
  function getToken() { 
    const u = new URL(window.location.href); 
    return (u.searchParams.get('token') || '').trim(); 
  }

  async function fetchJSON(url, opts) {
    // For GET requests, use JSONP to bypass CORS (same as intake form)
    if (!opts || !opts.method || opts.method === 'GET') {
      return await fetchViaJSONP(url);
    }
    
    // For POST requests, use text/plain approach
    try {
      const fetchOptions = Object.assign({ 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      }, opts || {});
      
      const res = await fetch(url, fetchOptions);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    } catch (error) {
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
  
  async function listLeads(q) { 
    const p = new URLSearchParams({ 
      token: q.token, 
      status: q.status || '', 
      from: q.from || '', 
      to: q.to || '' 
    });
    return fetchJSON(API() + '?api=leads&' + p.toString());
  }
  
  async function getStats(q) {
    const p = new URLSearchParams({ 
      token: q.token, 
      from: q.from || '', 
      to: q.to || '' 
    });
    return fetchJSON(API() + '?api=stats&' + p.toString());
  }
  
  async function updateLead(token, id, status) {
    return fetchJSON(API() + '?api=leads&id=' + encodeURIComponent(id), {
      method: 'POST',
      body: JSON.stringify({ _method: 'PATCH', token, status })
    });
  }

  function renderKPIs(stats) {
    const counts = stats.counts || {};
    $('#kpiNew').textContent = counts.NEW || 0;
    $('#kpiCancel').textContent = counts.CANCELLED || 0;
    $('#kpiAccepted').textContent = counts.ACCEPTED || 0;
    $('#kpiCompleted').textContent = counts.COMPLETED || 0;
    const pv = stats.productionValue || {};
    $('#kpiCaptured').textContent = fmtMoney(pv.capturedTotal || 0);
    $('#kpiCommitted').textContent = fmtMoney(pv.committedTotal || 0);
  }

  function renderLeads(leads) {
    const tbody = $('#leadsBody'); 
    tbody.innerHTML = '';
    leads.forEach(ld => {
      const tr = document.createElement('tr');
      const createdDate = new Date(ld.createdAt).toLocaleDateString();
      tr.innerHTML =
        '<td>' + sanitize(createdDate) + '</td>' +
        '<td>' + sanitize(ld.customerName) + '</td>' +
        '<td>' + sanitize(ld.city) + ', ' + sanitize(ld.state) + '</td>' +
        '<td>' + sanitize(ld.reason) + '</td>' +
        '<td>' + sanitize(ld.product || ld.productSku || '') + '</td>' +
        '<td>' + fmtMoney(ld.leadValue) + '</td>' +
        '<td><span class="badge status-' + sanitize((ld.status || '').toLowerCase()) + '">' + sanitize(ld.status) + '</span></td>' +
        '<td>' +
          '<button class="small" data-action="ACCEPTED" data-id="' + sanitize(ld.id) + '">Accept</button> ' +
          '<button class="small" data-action="COMPLETED" data-id="' + sanitize(ld.id) + '">Complete</button> ' +
          '<button class="small danger" data-action="CANCELLED" data-id="' + sanitize(ld.id) + '">Cancel</button>' +
        '</td>';
      tbody.appendChild(tr);
    });
  }

  function drawCharts(stats) {
    if (!window.google || !google.charts) return;
    google.charts.load('current', { packages: ['corechart'] });
    google.charts.setOnLoadCallback(function(){
      // Leads by day
      const d1 = new google.visualization.DataTable();
      d1.addColumn('string','Date'); 
      d1.addColumn('number','Leads');
      (stats.leadsByDay || []).forEach(r => d1.addRow([r.date, Number(r.count || 0)]));
      new google.visualization.LineChart(document.getElementById('chartLeadsByDay')).draw(d1, { 
        title: 'Leads by Day', 
        legend: { position:'none' }, 
        height: 320,
        backgroundColor: 'transparent',
        titleTextStyle: { color: '#e5e7eb' },
        hAxis: { textStyle: { color: '#9ca3af' } },
        vAxis: { textStyle: { color: '#9ca3af' } }
      });

      // Leads by Reason
      const d2 = new google.visualization.DataTable();
      d2.addColumn('string','Reason'); 
      d2.addColumn('number','Count');
      (stats.leadsByReason || []).forEach(r => d2.addRow([r.reason, Number(r.count || 0)]));
      new google.visualization.PieChart(document.getElementById('chartLeadsByReason')).draw(d2, { 
        title: 'Leads by Reason', 
        height: 320,
        backgroundColor: 'transparent',
        titleTextStyle: { color: '#e5e7eb' },
        legend: { textStyle: { color: '#9ca3af' } }
      });

      // PV by Month
      const d3 = new google.visualization.DataTable();
      d3.addColumn('string','Month'); 
      d3.addColumn('number','Production Value');
      (stats.productionValueByMonth || []).forEach(r => d3.addRow([r.month, Number(r.total || 0)]));
      new google.visualization.ColumnChart(document.getElementById('chartPvByMonth')).draw(d3, { 
        title: 'Production Value by Month', 
        legend: { position:'none' }, 
        height: 320,
        backgroundColor: 'transparent',
        titleTextStyle: { color: '#e5e7eb' },
        hAxis: { textStyle: { color: '#9ca3af' } },
        vAxis: { textStyle: { color: '#9ca3af' } }
      });
    });
  }

  function showLoading() {
    $('#loadingSpinner').style.display = 'block';
    $('#mainDashboard').style.display = 'none';
  }
  
  function hideLoading() {
    $('#loadingSpinner').style.display = 'none';
    $('#mainDashboard').style.display = 'block';
  }

  function showSection(sectionId) {
    // Hide all sections
    $('#leadsSection').style.display = 'none';
    $('#analyticsSection').style.display = 'none';
    
    // Show selected section
    $('#' + sectionId).style.display = 'block';
    
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    if (sectionId === 'leadsSection') {
      $('#leadsTab').classList.add('active');
    } else if (sectionId === 'analyticsSection') {
      $('#analyticsTab').classList.add('active');
    }
  }

  document.addEventListener('DOMContentLoaded', async function(){
    clearError();
    showLoading();
    
    const token = getToken();
    if (!token) { 
      hideLoading();
      $('#unauthorized').style.display = 'block'; 
      return; 
    }
    
    function currentFilters() {
      return { 
        token, 
        status: $('#statusFilter').value.trim(), 
        from: $('#fromDate').value, 
        to: $('#toDate').value 
      };
    }
    
    // Set up navigation
    $('#leadsTab').addEventListener('click', () => showSection('leadsSection'));
    $('#analyticsTab').addEventListener('click', () => showSection('analyticsSection'));
    
    $('#applyFilters').addEventListener('click', async function(){
      clearError();
      try {
        const [leads, stats] = await Promise.all([ 
          listLeads(currentFilters()), 
          getStats(currentFilters()) 
        ]);
        renderLeads(leads); 
        renderKPIs(stats); 
        drawCharts(stats);
      } catch (e) { 
        showError('Failed to load data. Check API_BASE in config.js'); 
      }
    });
    
    $('#leadsBody').addEventListener('click', async function(e){
      const btn = e.target.closest('button[data-action]'); 
      if (!btn) return;
      const id = btn.getAttribute('data-id'); 
      const action = btn.getAttribute('data-action');
      
      // Visual feedback
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = '⏳';
      
      try { 
        await updateLead(token, id, action); 
        showToast('✅ Status updated to: ' + action); 
        $('#applyFilters').click(); 
      } catch (e) { 
        showError('Update failed: ' + e.message); 
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });
    
    try {
      const [leads, stats] = await Promise.all([listLeads({ token }), getStats({ token })]);
      
      // Update company name in header
      if (leads && leads.length > 0) {
        const companyName = leads[0].Company_Name || 'Client';
        $('#companyName').textContent = `📊 ${companyName} Dashboard`;
      }
      
      renderLeads(leads); 
      renderKPIs(stats); 
      drawCharts(stats);
      
      hideLoading();
      showSection('leadsSection'); // Start with leads tab
    } catch (e) { 
      hideLoading();
      showError('Failed to load data. Check API_BASE in config.js'); 
    }
  });
})();
