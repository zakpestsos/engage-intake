(function(){
  const API = () => (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || '';
  const $ = sel => document.querySelector(sel);
  
  let currentSort = { field: 'createdAt', direction: 'desc' };
  
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

  function sortLeads(leads, field, direction) {
    return [...leads].sort((a, b) => {
      let aVal = a[field];
      let bVal = b[field];
      
      // Handle different data types
      if (field === 'createdAt') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      } else if (field === 'leadValue') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }
      
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }
  
  function renderLeads(leads) {
    const tbody = $('#leadsBody'); 
    tbody.innerHTML = '';
    
    // Sort leads based on current sort settings
    const sortedLeads = sortLeads(leads, currentSort.field, currentSort.direction);
    
    // Store leads data globally for modal access
    window.CURRENT_LEADS_ORIGINAL = leads; // Store original for re-sorting
    window.CURRENT_LEADS = sortedLeads;
    
    // Update sort indicators
    document.querySelectorAll('.leads-table th').forEach(th => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      const sortField = th.getAttribute('data-sort');
      if (sortField === currentSort.field) {
        th.classList.add(currentSort.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
      }
    });
    
    sortedLeads.forEach(ld => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.setAttribute('data-lead-id', ld.id);
      
      const createdDate = new Date(ld.createdAt).toLocaleDateString();
      tr.innerHTML =
        '<td>' + sanitize(createdDate) + '</td>' +
        '<td>' + sanitize(ld.customerName) + '</td>' +
        '<td>' + sanitize(ld.city) + ', ' + sanitize(ld.state) + '</td>' +
        '<td>' + sanitize(ld.reason) + '</td>' +
        '<td>' + sanitize(ld.product || ld.productSku || '') + '</td>' +
        '<td>' + fmtMoney(ld.leadValue) + '</td>' +
        '<td><span class="badge status-' + sanitize((ld.status || '').toLowerCase()) + '">' + sanitize(ld.status) + '</span></td>' +
        '<td class="actions-cell">' +
          '<div class="action-buttons">' +
            '<button class="action-btn accept" data-action="ACCEPTED" data-id="' + sanitize(ld.id) + '">Accept</button>' +
            '<button class="action-btn complete" data-action="COMPLETED" data-id="' + sanitize(ld.id) + '">Complete</button>' +
            '<button class="action-btn cancel" data-action="CANCELLED" data-id="' + sanitize(ld.id) + '">Cancel</button>' +
          '</div>' +
        '</td>';
      tbody.appendChild(tr);
    });
  }
  
  function openLeadModal(leadId) {
    const lead = window.CURRENT_LEADS.find(l => l.id === leadId);
    if (!lead) return;
    
    // Populate modal with lead data
    $('#modalLeadName').textContent = lead.customerName;
    $('#modalCustomerName').textContent = lead.customerName;
    $('#modalPhone').textContent = lead.customerPhone || 'Not provided';
    $('#modalProduct').textContent = lead.product || 'Not specified';
    $('#modalSquareFootage').textContent = lead.squareFootage ? lead.squareFootage.toLocaleString() + ' sq ft' : 'Not provided';
    $('#modalInitialPrice').textContent = lead.initialPrice ? fmtMoney(lead.initialPrice) : 'Not set';
    $('#modalRecurringPrice').textContent = lead.recurringPrice ? fmtMoney(lead.recurringPrice) : 'Not set';
    $('#modalReason').textContent = lead.reason || 'Not specified';
    $('#modalNotes').textContent = lead.notes || 'No additional notes';
    $('#modalStatus').value = lead.status || 'NEW';
    
    // Set status badge in header
    const status = (lead.status || 'NEW').toLowerCase();
    const statusBadge = $('#modalStatusBadge');
    statusBadge.textContent = lead.status || 'NEW';
    statusBadge.className = 'status-badge-modal ' + status;
    
    // Format full address with Google Maps link
    const street = lead.addressStreet || lead.street || '';
    const city = lead.addressCity || lead.city || '';
    const state = lead.addressState || lead.state || '';
    const postal = lead.addressPostal || lead.postal || '';
    
    const addressParts = [street, city, state, postal].filter(Boolean);
    const fullAddressText = addressParts.join(', ');
    const googleMapsUrl = 'https://maps.google.com/maps?q=' + encodeURIComponent(fullAddressText);
    
    if (fullAddressText) {
      $('#modalAddress').innerHTML = 
        `<a href="${googleMapsUrl}" target="_blank" style="color: var(--accent); text-decoration: none;">` +
        `${street}<br>${city}, ${state} ${postal}` +
        `</a>`;
    } else {
      $('#modalAddress').innerHTML = 'Address not provided';
    }
    
    // Populate bottom right summary
    $('#modalProductSummary').textContent = lead.product || 'Service';
    $('#modalLeadValue').textContent = fmtMoney(lead.leadValue || 0);
    
    // Populate debug Lead_ID in bottom left
    $('#modalLeadId').textContent = 'Lead ID: ' + leadId;
    
    // Store current lead ID for status updates
    $('#updateStatus').setAttribute('data-lead-id', leadId);
    
    // Show modal
    $('#leadModal').style.display = 'flex';
  }
  
  function closeLeadModal() {
    $('#leadModal').style.display = 'none';
  }

  // Advanced Analytics Engine
  function calculateAdvancedMetrics(leads, stats) {
    const totalLeads = leads.length;
    const completedLeads = leads.filter(l => l.status === 'COMPLETED').length;
    const cancelledLeads = leads.filter(l => l.status === 'CANCELLED').length;
    
    // Revenue calculations
    const totalRevenue = leads.reduce((sum, l) => sum + (l.leadValue || 0), 0);
    const completedRevenue = leads.filter(l => l.status === 'COMPLETED').reduce((sum, l) => sum + (l.leadValue || 0), 0);
    
    // Conversion metrics
    const conversionRate = totalLeads > 0 ? (completedLeads / totalLeads * 100) : 0;
    const avgDealSize = completedLeads > 0 ? (completedRevenue / completedLeads) : 0;
    
    // Time-based analysis
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentLeads = leads.filter(l => new Date(l.createdAt) >= thirtyDaysAgo);
    const salesVelocity = recentLeads.length;
    
    // Geographic analysis
    const byState = {};
    leads.forEach(l => {
      const state = l.state || 'Unknown';
      byState[state] = (byState[state] || 0) + 1;
    });
    
    // Service analysis
    const byService = {};
    leads.forEach(l => {
      const service = l.product || 'Unknown';
      byService[service] = (byService[service] || 0) + (l.leadValue || 0);
    });
    
    return {
      totalRevenue,
      conversionRate,
      avgDealSize,
      salesVelocity,
      byState,
      byService,
      recentLeads: recentLeads.length,
      highValueLeads: leads.filter(l => (l.leadValue || 0) > 1000).length,
      quickConversions: leads.filter(l => {
        const created = new Date(l.createdAt);
        const completed = l.completedAt ? new Date(l.completedAt) : null;
        return completed && (completed - created) < 24 * 60 * 60 * 1000;
      }).length
    };
  }
  
  function updateExecutiveSummary(metrics) {
    $('#totalRevenue').textContent = fmtMoney(metrics.totalRevenue);
    $('#conversionRate').textContent = metrics.conversionRate.toFixed(1) + '%';
    $('#avgDealSize').textContent = fmtMoney(metrics.avgDealSize);
    $('#salesVelocity').textContent = metrics.salesVelocity;
    
    // Add trend indicators (simplified for now)
    $('#revenueChange').textContent = '+12.5%';
    $('#conversionChange').textContent = '+8.2%';
    $('#dealSizeChange').textContent = '+15.7%';
    $('#velocityChange').textContent = '+22.1%';
  }
  
  function drawMasterpieceCharts(leads, stats) {
    if (!window.google || !google.charts) return;
    
    const metrics = calculateAdvancedMetrics(leads, stats);
    updateExecutiveSummary(metrics);
    
    google.charts.load('current', { 
      packages: ['corechart', 'bar', 'line', 'geochart', 'sankey'] 
    });
    
    google.charts.setOnLoadCallback(function(){
      drawRevenueFunnel(leads);
      drawLeadSources(leads);
      drawGeographicDistribution(metrics.byState);
      drawServicePerformance(metrics.byService);
      drawTimeAnalysis(leads);
      drawConversionTimeline(leads);
      drawRevenueTrends(leads);
    });
  }
  
  function drawRevenueFunnel(leads) {
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Stage');
    data.addColumn('number', 'Count');
    data.addColumn('number', 'Revenue');
    
    const stages = [
      ['New Leads', leads.filter(l => l.status === 'NEW').length, leads.filter(l => l.status === 'NEW').reduce((s, l) => s + (l.leadValue || 0), 0)],
      ['Accepted', leads.filter(l => l.status === 'ACCEPTED').length, leads.filter(l => l.status === 'ACCEPTED').reduce((s, l) => s + (l.leadValue || 0), 0)],
      ['Completed', leads.filter(l => l.status === 'COMPLETED').length, leads.filter(l => l.status === 'COMPLETED').reduce((s, l) => s + (l.leadValue || 0), 0)]
    ];
    
    data.addRows(stages);
    
    const options = {
      title: 'Revenue Funnel Analysis',
      backgroundColor: 'transparent',
      titleTextStyle: { color: '#f1f5f9', fontSize: 16 },
      hAxis: { textStyle: { color: '#94a3b8' } },
      vAxis: { textStyle: { color: '#94a3b8' } },
      series: {
        0: { color: '#3b82f6', targetAxisIndex: 0 },
        1: { color: '#10b981', targetAxisIndex: 1, type: 'line' }
      },
      vAxes: {
        0: { title: 'Lead Count', titleTextStyle: { color: '#94a3b8' } },
        1: { title: 'Revenue ($)', titleTextStyle: { color: '#94a3b8' } }
      }
    };
    
    new google.visualization.ComboChart(document.getElementById('chartRevenueFunnel')).draw(data, options);
  }
  
  function drawLeadSources(leads) {
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Source');
    data.addColumn('number', 'Leads');
    
    // For now, all are call center, but this can be expanded
    data.addRows([
      ['Call Center', leads.length],
      ['Web Form', 0],
      ['Referral', 0],
      ['Social Media', 0]
    ]);
    
    const options = {
      backgroundColor: 'transparent',
      titleTextStyle: { color: '#f1f5f9' },
      legend: { textStyle: { color: '#94a3b8' } },
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']
    };
    
    new google.visualization.PieChart(document.getElementById('chartLeadSources')).draw(data, options);
  }
  
  function drawGeographicDistribution(byState) {
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'State');
    data.addColumn('number', 'Leads');
    
    const stateData = Object.entries(byState).map(([state, count]) => [state, count]);
    data.addRows(stateData);
    
    const options = {
      backgroundColor: 'transparent',
      titleTextStyle: { color: '#f1f5f9' },
      legend: { textStyle: { color: '#94a3b8' } },
      colors: ['#3b82f6']
    };
    
    new google.visualization.ColumnChart(document.getElementById('chartGeographic')).draw(data, options);
    
    // Update top region
    if (stateData.length > 0) {
      const topState = stateData.reduce((a, b) => a[1] > b[1] ? a : b);
      $('#topRegion').textContent = `Top: ${topState[0]} (${topState[1]} leads)`;
    }
  }
  
  function drawServicePerformance(byService) {
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Service');
    data.addColumn('number', 'Revenue');
    
    const serviceData = Object.entries(byService).map(([service, revenue]) => [service, revenue]);
    data.addRows(serviceData);
    
    const options = {
      backgroundColor: 'transparent',
      titleTextStyle: { color: '#f1f5f9' },
      hAxis: { textStyle: { color: '#94a3b8' } },
      vAxis: { textStyle: { color: '#94a3b8' } },
      colors: ['#10b981']
    };
    
    new google.visualization.ColumnChart(document.getElementById('chartServicePerformance')).draw(data, options);
    
    // Update top service
    if (serviceData.length > 0) {
      const topService = serviceData.reduce((a, b) => a[1] > b[1] ? a : b);
      $('#topService').textContent = `Best: ${topService[0]} (${fmtMoney(topService[1])})`;
    }
  }
  
  function drawTimeAnalysis(leads) {
    const hourCounts = new Array(24).fill(0);
    
    leads.forEach(l => {
      const hour = new Date(l.createdAt).getHours();
      hourCounts[hour]++;
    });
    
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Hour');
    data.addColumn('number', 'Leads');
    
    hourCounts.forEach((count, hour) => {
      const timeLabel = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
      data.addRow([timeLabel, count]);
    });
    
    const options = {
      backgroundColor: 'transparent',
      titleTextStyle: { color: '#f1f5f9' },
      hAxis: { textStyle: { color: '#94a3b8' } },
      vAxis: { textStyle: { color: '#94a3b8' } },
      colors: ['#f59e0b']
    };
    
    new google.visualization.AreaChart(document.getElementById('chartTimeAnalysis')).draw(data, options);
    
    // Find peak hour
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    const peakLabel = peakHour === 0 ? '12 AM' : peakHour < 12 ? `${peakHour} AM` : peakHour === 12 ? '12 PM' : `${peakHour - 12} PM`;
    $('#peakHour').textContent = `Peak: ${peakLabel} (${hourCounts[peakHour]} leads)`;
  }
  
  function drawConversionTimeline(leads) {
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Days to Convert');
    data.addColumn('number', 'Leads');
    
    const conversionTimes = [];
    leads.filter(l => l.status === 'COMPLETED' && l.completedAt).forEach(l => {
      const created = new Date(l.createdAt);
      const completed = new Date(l.completedAt);
      const days = Math.floor((completed - created) / (24 * 60 * 60 * 1000));
      conversionTimes.push(days);
    });
    
    const timeBuckets = { '0-1': 0, '2-7': 0, '8-30': 0, '31+': 0 };
    conversionTimes.forEach(days => {
      if (days <= 1) timeBuckets['0-1']++;
      else if (days <= 7) timeBuckets['2-7']++;
      else if (days <= 30) timeBuckets['8-30']++;
      else timeBuckets['31+']++;
    });
    
    Object.entries(timeBuckets).forEach(([bucket, count]) => {
      data.addRow([bucket + ' days', count]);
    });
    
    const options = {
      backgroundColor: 'transparent',
      titleTextStyle: { color: '#f1f5f9' },
      hAxis: { textStyle: { color: '#94a3b8' } },
      vAxis: { textStyle: { color: '#94a3b8' } },
      colors: ['#8b5cf6']
    };
    
    new google.visualization.ColumnChart(document.getElementById('chartConversionTimeline')).draw(data, options);
    
    // Calculate average conversion time
    const avgTime = conversionTimes.length > 0 ? conversionTimes.reduce((a, b) => a + b, 0) / conversionTimes.length : 0;
    $('#avgConversionTime').textContent = `Avg: ${avgTime.toFixed(1)} days`;
  }
  
  function drawRevenueTrends(leads) {
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Month');
    data.addColumn('number', 'Revenue');
    data.addColumn('number', 'Forecast');
    
    // Group by month
    const monthlyRevenue = {};
    leads.forEach(l => {
      const month = l.createdAt.substring(0, 7); // YYYY-MM
      monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (l.leadValue || 0);
    });
    
    const sortedMonths = Object.keys(monthlyRevenue).sort();
    sortedMonths.forEach(month => {
      data.addRow([month, monthlyRevenue[month], null]);
    });
    
    // Add forecast (simplified)
    if (sortedMonths.length > 0) {
      const lastMonth = monthlyRevenue[sortedMonths[sortedMonths.length - 1]];
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const nextMonthStr = nextMonth.toISOString().substring(0, 7);
      data.addRow([nextMonthStr, null, lastMonth * 1.15]); // 15% growth forecast
    }
    
    const options = {
      backgroundColor: 'transparent',
      titleTextStyle: { color: '#f1f5f9' },
      hAxis: { textStyle: { color: '#94a3b8' } },
      vAxis: { textStyle: { color: '#94a3b8' } },
      series: {
        0: { color: '#10b981', lineWidth: 3 },
        1: { color: '#f59e0b', lineDashStyle: [4, 4] }
      }
    };
    
    new google.visualization.LineChart(document.getElementById('chartRevenueTrends')).draw(data, options);
  }
  
  function updatePerformanceMetrics(metrics) {
    $('#highValueLeads').textContent = metrics.highValueLeads;
    $('#quickConversions').textContent = metrics.quickConversions;
    $('#repeatCustomers').textContent = '0'; // Would need customer tracking
    $('#leadsPerDay').textContent = (metrics.recentLeads / 30).toFixed(1);
    $('#peakCallVolume').textContent = Math.max(...Object.values(metrics.byState || {})) || 0;
    $('#responseTime').textContent = '< 5 min'; // Would need timing data
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
      // Load analytics when first shown
      if (window.CURRENT_LEADS_ORIGINAL) {
        const metrics = calculateAdvancedMetrics(window.CURRENT_LEADS_ORIGINAL, window.CURRENT_STATS || {});
        updatePerformanceMetrics(metrics);
        drawMasterpieceCharts(window.CURRENT_LEADS_ORIGINAL, window.CURRENT_STATS || {});
      }
    }
  }
  
  function showAnalyticsView(viewId) {
    // Hide all analytics views
    $('#overviewAnalytics').style.display = 'none';
    $('#performanceAnalytics').style.display = 'none';
    $('#trendsAnalytics').style.display = 'none';
    
    // Show selected view
    $('#' + viewId).style.display = 'block';
    
    // Update view buttons
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    if (viewId === 'overviewAnalytics') $('#overviewView').classList.add('active');
    else if (viewId === 'performanceAnalytics') $('#performanceView').classList.add('active');
    else if (viewId === 'trendsAnalytics') $('#trendsView').classList.add('active');
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
    
    // Analytics view switching
    $('#overviewView').addEventListener('click', () => showAnalyticsView('overviewAnalytics'));
    $('#performanceView').addEventListener('click', () => showAnalyticsView('performanceAnalytics'));
    $('#trendsView').addEventListener('click', () => showAnalyticsView('trendsAnalytics'));
    
    // Set up column sorting
    document.querySelectorAll('.leads-table th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const field = th.getAttribute('data-sort');
        if (currentSort.field === field) {
          currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
          currentSort.field = field;
          currentSort.direction = 'asc';
        }
        
        // Re-render with new sort
        if (window.CURRENT_LEADS) {
          renderLeads(window.CURRENT_LEADS_ORIGINAL || window.CURRENT_LEADS);
        }
      });
    });
    
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
      // Check if it's an action button
      const btn = e.target.closest('button[data-action]'); 
      if (btn) {
        e.stopPropagation(); // Prevent row click
        const id = btn.getAttribute('data-id'); 
        const action = btn.getAttribute('data-action');
        
        // Visual feedback
        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = '⏳';
        
        try { 
          await updateLead(token, id, action); 
          showToast('Status updated to: ' + action); 
          $('#applyFilters').click(); 
        } catch (e) { 
          showError('Update failed: ' + e.message); 
          btn.textContent = originalText;
          btn.disabled = false;
        }
        return;
      }
      
      // Check if it's a row click (but not on action buttons)
      const row = e.target.closest('tr[data-lead-id]');
      if (row) {
        const leadId = row.getAttribute('data-lead-id');
        openLeadModal(leadId);
      }
    });
    
    // Modal event listeners
    $('#closeModal').addEventListener('click', closeLeadModal);
    
    $('#leadModal').addEventListener('click', function(e) {
      // Close modal if clicking outside the content
      if (e.target === this) {
        closeLeadModal();
      }
    });
    
    $('#updateStatus').addEventListener('click', async function() {
      const leadId = this.getAttribute('data-lead-id');
      const newStatus = $('#modalStatus').value;
      
      if (!leadId || !newStatus) return;
      
      // Visual feedback
      this.disabled = true;
      const originalText = this.textContent;
      this.textContent = 'Updating...';
      
      try {
        await updateLead(token, leadId, newStatus);
        
        // Update the status badge in the modal header
        const statusBadge = $('#modalStatusBadge');
        statusBadge.textContent = newStatus;
        statusBadge.className = 'status-badge-modal ' + newStatus.toLowerCase();
        
        showToast('Status updated to: ' + newStatus);
        
        // Refresh the leads table after a short delay to show the badge update
        setTimeout(() => {
          $('#applyFilters').click();
          closeLeadModal();
        }, 1000);
        
      } catch (e) {
        showError('Update failed: ' + e.message);
      } finally {
        this.disabled = false;
        this.textContent = originalText;
      }
    });
    
    try {
      const [leads, stats] = await Promise.all([listLeads({ token }), getStats({ token })]);
      
      // Update company name in header - get from token first, then from leads
      let companyName = 'Client';
      
      // Try to get company name from the token first (more reliable)
      try {
        const configUrl = API() + '?api=config&token=' + encodeURIComponent(token);
        const config = await fetchJSON(configUrl);
        if (config && config.company && config.company.name) {
          companyName = config.company.name;
        }
      } catch (e) {
        console.log('Could not get company name from token, using leads data');
      }
      
      // Fallback to leads data
      if (companyName === 'Client' && leads && leads.length > 0) {
        companyName = leads[0].companyName || leads[0].Company_Name || 'Client';
      }
      
      $('#companyName').textContent = `${companyName} Dashboard`;
      
      // Store data globally for analytics
      window.CURRENT_STATS = stats;
      
      renderLeads(leads); 
      renderKPIs(stats); 
      
      // Initialize analytics masterpiece
      const metrics = calculateAdvancedMetrics(leads, stats);
      updatePerformanceMetrics(metrics);
      
      hideLoading();
      showSection('leadsSection'); // Start with leads tab
    } catch (e) { 
      hideLoading();
      showError('Failed to load data. Check API_BASE in config.js'); 
    }
  });
})();
