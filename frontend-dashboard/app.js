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

  async function fetchJSON(url, opts){
    const res = await fetch(url, Object.assign({ 
      headers: { 'Content-Type': 'application/json' }
    }, opts || {}));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
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
    return fetchJSON(API() + '/api/leads/' + encodeURIComponent(id), {
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

  document.addEventListener('DOMContentLoaded', async function(){
    const token = getToken();
    if (!token) { 
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
      try { 
        await updateLead(token, id, action); 
        showToast('Updated status to: ' + action); 
        $('#applyFilters').click(); 
      } catch (e) { 
        showError('Update failed.'); 
      }
    });
    
    // Initial load
    $('#applyFilters').click();
  });
})();
