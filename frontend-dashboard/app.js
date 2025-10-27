(function(){
  const API = () => (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || '';
  const $ = sel => document.querySelector(sel);
  
  let currentSort = { field: 'createdAt', direction: 'desc' };
  
  // User session state
  let currentUser = null;
  let allUsers = [];
  
  // Polling state for real-time updates
  let pollingInterval = null;
  let lastPollTimestamp = null;
  let knownLeadIds = new Set();
  let leadStatusMap = new Map(); // leadId -> status
  let leadAssignmentMap = new Map(); // leadId -> assignedTo
  let recentAssignmentChanges = new Map(); // leadId -> timestamp (tracks user-initiated changes)
  let isPollingInProgress = false;
  let consecutiveErrors = 0;
  const POLL_INTERVAL_MS = 10000; // 10 seconds
  const MAX_CONSECUTIVE_ERRORS = 3;
  const ASSIGNMENT_PROTECTION_MS = 30000; // 30 seconds protection for manual changes
  
  // Track if tab is visible (pause polling when hidden)
  let isTabVisible = true;
  document.addEventListener('visibilitychange', function() {
    isTabVisible = !document.hidden;
    if (isTabVisible) {
      console.log('Tab visible - resuming polling');
      pollForUpdates(); // Immediate check when tab becomes visible
    }
  });
  
  // Track modal resize state
  let isResizingModal = false;
  let recentlyResizedModal = false;
  let resizeTimeout = null;

  // ====================
  // SESSION MANAGEMENT
  // ====================
  
  function checkSession() {
    try {
      const sessionData = localStorage.getItem('engage_user_session');
      if (sessionData) {
        currentUser = JSON.parse(sessionData);
        console.log('✅ Session restored:', currentUser.email);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking session:', error);
      return false;
    }
  }
  
  function saveSession(user) {
    try {
      localStorage.setItem('engage_user_session', JSON.stringify(user));
      currentUser = user;
      console.log('✅ Session saved:', user.email);
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }
  
  function clearSession() {
    try {
      localStorage.removeItem('engage_user_session');
      currentUser = null;
      console.log('✅ Session cleared');
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }
  
  function showLoginModal() {
    $('#loginModal').style.display = 'flex';
    $('#loginEmail').focus();
  }
  
  function hideLoginModal() {
    $('#loginModal').style.display = 'none';
    $('#loginEmail').value = '';
    $('#loginPassword').value = '';
    $('#loginError').style.display = 'none';
  }
  
  async function handleLogin(email, password) {
    const loginButton = $('#loginButton');
    const btnText = loginButton.querySelector('.btn-text');
    const btnSpinner = loginButton.querySelector('.btn-spinner');
    const loginError = $('#loginError');
    
    try {
      // Show loading state
      loginButton.disabled = true;
      btnText.style.display = 'none';
      btnSpinner.style.display = 'inline-block';
      loginError.style.display = 'none';
      
      const token = getToken();
      if (!token) {
        throw new Error('No token found in URL');
      }
      
      // Call login API
      const response = await fetch(API() + '?api=login&token=' + encodeURIComponent(token), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify({
          email: email,
          password: password,
          token: token
        })
      });
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      if (result.success && result.user) {
        // Save session
        saveSession(result.user);
        
        // Update UI
        updateUserMenu();
        
        // Hide login modal
        hideLoginModal();
        
        // Initialize dashboard
        showToast('Welcome back, ' + result.user.firstName + '!');
        
        return true;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Login error:', error);
      loginError.textContent = error.message || 'Login failed. Please try again.';
      loginError.style.display = 'block';
      return false;
    } finally {
      // Reset button state
      loginButton.disabled = false;
      btnText.style.display = 'inline';
      btnSpinner.style.display = 'none';
    }
  }
  
  function handleLogout() {
    clearSession();
    stopPolling();
    showLoginModal();
    $('#mainDashboard').style.display = 'none';
    showToast('You have been logged out');
  }
  
  function updateUserMenu() {
    if (!currentUser) return;
    
    // Get initials
    const firstInitial = (currentUser.firstName || '').charAt(0).toUpperCase();
    const lastInitial = (currentUser.lastName || '').charAt(0).toUpperCase();
    const initials = firstInitial + lastInitial;
    
    // Update user badge
    $('#userBadge').textContent = initials;
    $('#userBadge').style.backgroundColor = getColorForInitials(initials, currentUser.email);
    
    // Update user name
    $('#userName').textContent = currentUser.fullName || currentUser.email;
    
    // Show Users tab if admin
    if (currentUser.role === 'Admin') {
      $('#usersTab').style.display = 'inline-block';
    }
  }
  
  function getColorForInitials(initials, email = null) {
    // Check if user has custom color
    if (email && allUsers && Array.isArray(allUsers)) {
      const user = allUsers.find(u => u.Email === email);
      if (user && user.Icon_Color) {
        return user.Icon_Color;
      }
    }
    
    // Generate a consistent color based on initials (fallback)
    const colors = [
      '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', 
      '#10b981', '#06b6d4', '#6366f1', '#ef4444'
    ];
    const hash = initials.charCodeAt(0) + (initials.charCodeAt(1) || 0);
    return colors[hash % colors.length];
  }
  
  function getUserInitials(email) {
    if (!email) return '??';
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  }

  // ====================
  // USER MANAGEMENT UI
  // ====================
  
  async function loadAllUsers() {
    try {
      const token = getToken();
      if (!token) {
        console.error('No token found');
        return;
      }
      
      console.log('📡 Loading users...');
      
      // Use fetchJSON for JSONP support (same as other API calls)
      const users = await fetchJSON(API() + '?api=users&token=' + encodeURIComponent(token));
      
      console.log('📦 Raw users data:', users);
      
      if (users && Array.isArray(users) && !users.error) {
        // Map users to have consistent property names
        allUsers = users.map(u => ({
          Email: u.email || u.Email,
          email: u.email || u.Email,
          firstName: u.firstName || u.First_Name || '',
          lastName: u.lastName || u.Last_Name || '',
          First_Name: u.firstName || u.First_Name || '',
          Last_Name: u.lastName || u.Last_Name || '',
          role: u.role || u.Role || 'User',
          Role: u.role || u.Role || 'User',
          active: u.active !== false && u.Active !== false,
          Active: u.active !== false && u.Active !== false,
          Icon_Color: u.iconColor || u.Icon_Color || '#3b82f6',
          iconColor: u.iconColor || u.Icon_Color || '#3b82f6',
          companyName: u.companyName || u.Company_Name || '',
          Company_Name: u.companyName || u.Company_Name || ''
        }));
        console.log('✅ Loaded', allUsers.length, 'users:', allUsers);
        
        // Always try to render the table
        const tbody = $('#usersTableBody');
        console.log('📋 Tbody element:', tbody);
        
        if (tbody) {
          renderUsersTable(allUsers);
          console.log('✅ Rendered users table');
        } else {
          console.error('❌ usersTableBody not found in DOM');
        }
      } else {
        console.error('❌ Invalid users data:', users);
        throw new Error(users?.error || 'Failed to load users');
      }
    } catch (error) {
      console.error('❌ Error loading users:', error);
      showError('Failed to load users: ' + error.message);
    }
  }
  
  function renderUsersTable(users) {
    const tbody = $('#usersTableBody');
    if (!tbody) return;
    
    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #94a3b8;">No users found. Click "Add User" to create one.</td></tr>';
      return;
    }
    
    tbody.innerHTML = users.map(user => {
      const initials = (user.firstName?.charAt(0) || '') + (user.lastName?.charAt(0) || '');
      const color = getColorForInitials(initials, user.Email);
      const roleClass = (user.role || 'user').toLowerCase();
      
      return `
        <tr>
          <td>
            <div class="user-name-cell">
              <div class="user-avatar" style="background-color: ${color}">${initials.toUpperCase()}</div>
              <span>${user.firstName} ${user.lastName}</span>
            </div>
          </td>
          <td>${user.email}</td>
          <td><span class="user-role-badge ${roleClass}">${user.role || 'User'}</span></td>
          <td><span class="user-status-badge ${user.active ? 'active' : 'inactive'}">${user.active ? 'Active' : 'Inactive'}</span></td>
          <td>
            <div class="user-actions">
              <button class="btn-icon" onclick="window.editUser('${user.email}')" title="Edit User">✏️</button>
              <button class="btn-icon" onclick="window.toggleUserStatus('${user.email}', ${user.active})" title="${user.active ? 'Deactivate' : 'Activate'}">
                ${user.active ? '🚫' : '✅'}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }
  
  function openUserModal(mode = 'create', userData = null) {
    const modal = $('#userModal');
    const title = $('#userModalTitle');
    const form = $('#userForm');
    
    // Set modal title
    title.textContent = mode === 'create' ? 'Add User' : 'Edit User';
    
    // Reset form
    form.reset();
    
    // If editing, populate fields
    if (mode === 'edit' && userData) {
      $('#userEmail').value = userData.email;
      $('#userEmail').disabled = true; // Can't change email
      $('#userFirstName').value = userData.firstName || '';
      $('#userLastName').value = userData.lastName || '';
      $('#userPassword').value = '';
      $('#userPassword').required = false; // Not required when editing
      $('#userPassword').placeholder = 'Leave blank to keep current password';
      $('#userRole').value = userData.role || 'User';
      $('#userActive').checked = userData.active !== false;
      $('#userIconColor').value = userData.iconColor || '#3b82f6';
    } else {
      $('#userEmail').disabled = false;
      $('#userPassword').required = true;
      $('#userPassword').placeholder = '';
      $('#userIconColor').value = '#3b82f6';
    }
    
    // Show modal
    modal.style.display = 'flex';
  }
  
  function closeUserModal() {
    const modal = $('#userModal');
    modal.style.display = 'none';
    $('#userForm').reset();
  }
  
  async function handleUserFormSubmit(e) {
    e.preventDefault();
    
    const email = $('#userEmail').value.trim();
    const firstName = $('#userFirstName').value.trim();
    const lastName = $('#userLastName').value.trim();
    const password = $('#userPassword').value;
    const role = $('#userRole').value;
    const active = $('#userActive').checked;
    const iconColor = $('#userIconColor').value;
    
    const isEditing = $('#userEmail').disabled;
    const saveBtn = $('#saveUserBtn');
    
    try {
      // Show loading state
      saveBtn.disabled = true;
      saveBtn.textContent = isEditing ? 'Updating...' : 'Creating...';
      
      const token = getToken();
      const endpoint = API() + '?api=users&token=' + encodeURIComponent(token);
      
      const payload = {
        email: email,
        firstName: firstName,
        lastName: lastName,
        role: role,
        active: active,
        iconColor: iconColor,
        token: token
      };
      
      // Only include password if provided (or if creating new user)
      if (password) {
        payload.password = password;
      }
      
      // Add _method for updates
      if (isEditing) {
        payload._method = 'PATCH';
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Success!
      showToast(isEditing ? 'User updated successfully!' : 'User created successfully!');
      closeUserModal();
      
      // Reload users table
      await loadAllUsers();
      
      // If we edited the current user, update their session and badge
      if (isEditing && currentUser && email === currentUser.email) {
        currentUser.firstName = firstName;
        currentUser.lastName = lastName;
        currentUser.fullName = firstName + ' ' + lastName;
        currentUser.role = role;
        currentUser.iconColor = iconColor;
        saveSession(currentUser);
        updateUserMenu();
      }
      
    } catch (error) {
      console.error('Error saving user:', error);
      showError('Failed to save user: ' + error.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save User';
    }
  }
  
  // Make functions available globally for onclick handlers
  window.editUser = function(email) {
    const user = allUsers.find(u => u.email === email);
    if (user) {
      openUserModal('edit', user);
    }
  };
  
  window.toggleUserStatus = async function(email, currentStatus) {
    const action = currentStatus ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this user?`)) {
      return;
    }
    
    try {
      const token = getToken();
      const endpoint = API() + '?api=users&token=' + encodeURIComponent(token);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify({
          _method: 'PATCH',
          email: email,
          active: !currentStatus,
          token: token
        })
      });
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      showToast(`User ${action}d successfully`);
      await loadAllUsers();
      
    } catch (error) {
      console.error('Error toggling user status:', error);
      showError('Failed to update user status: ' + error.message);
    }
  };

  // ====================
  // COMMENTS SYSTEM
  // ====================
  
  let currentLeadId = null;
  let currentComments = [];
  
  async function loadCommentsForLead(leadId) {
    try {
      const token = getToken();
      if (!token || !leadId) return;
      
      currentLeadId = leadId;
      
      // Use fetchJSON for JSONP support
      const comments = await fetchJSON(API() + '?api=comments&leadId=' + encodeURIComponent(leadId) + '&token=' + encodeURIComponent(token));
      
      if (!comments.error) {
        currentComments = comments;
        renderComments(comments);
      } else {
        throw new Error(comments.error);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      currentComments = [];
      renderComments([]);
    }
  }
  
  function renderComments(comments) {
    const commentsList = $('#commentsList');
    const commentsCount = $('#commentsCount');
    const commentsCountBadge = $('#commentsCountBadge');
    
    if (!commentsList) return;
    
    // Update count
    commentsCount.textContent = comments.length;
    if (commentsCountBadge) {
      commentsCountBadge.textContent = comments.length;
    }
    
    if (comments.length === 0) {
      commentsList.innerHTML = '<div class="comments-empty">No comments yet. Be the first to add one!</div>';
      return;
    }
    
    commentsList.innerHTML = comments.map(comment => {
      const initials = getUserInitials(comment.userEmail);
      const color = getColorForInitials(initials, comment.userEmail);
      const timestamp = new Date(comment.createdAt).toLocaleString();
      
      return `
        <div class="comment-item">
          <div class="comment-header">
            <div class="comment-avatar" style="background-color: ${color}">${initials}</div>
            <div class="comment-meta">
              <div class="comment-author">${comment.userName || comment.userEmail}</div>
              <div class="comment-time">${timestamp}</div>
            </div>
          </div>
          <div class="comment-text">${sanitize(comment.commentText)}</div>
        </div>
      `;
    }).join('');
  }
  
  async function addCommentToLead() {
    const commentInput = $('#commentInput');
    const addBtn = $('#addCommentBtn');
    const commentText = commentInput.value.trim();
    
    if (!commentText || !currentLeadId || !currentUser) {
      return;
    }
    
    try {
      // Show loading state
      addBtn.disabled = true;
      addBtn.textContent = 'Posting...';
      
      const token = getToken();
      const endpoint = API() + '?api=comments&token=' + encodeURIComponent(token);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify({
          leadId: currentLeadId,
          userEmail: currentUser.email,
          userName: currentUser.fullName || currentUser.email,
          commentText: commentText,
          token: token
        })
      });
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Success! Clear input and reload comments
      commentInput.value = '';
      await loadCommentsForLead(currentLeadId);
      
    } catch (error) {
      console.error('Error adding comment:', error);
      showError('Failed to add comment: ' + error.message);
    } finally {
      addBtn.disabled = false;
      addBtn.textContent = 'Post';
    }
  }
  
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
  
  async function updateLead(token, id, status, userEmail) {
    return fetchJSON(API() + '?api=leads&id=' + encodeURIComponent(id), {
      method: 'POST',
      body: JSON.stringify({ _method: 'PATCH', token, status, userEmail: userEmail || '' })
    });
  }

  // Calculate conversion metrics for Joel's key metrics
  function calculateConversionMetrics(leads) {
    const totalCalls = leads.length;
    const appointments = leads.filter(l => l.status === 'ACCEPTED' || l.status === 'COMPLETED').length;
    const sales = leads.filter(l => l.status === 'COMPLETED').length;
    
    const callToAppt = totalCalls > 0 ? (appointments / totalCalls * 100) : 0;
    const apptToSale = appointments > 0 ? (sales / appointments * 100) : 0;
    const convertedRevenue = leads
      .filter(l => l.status === 'COMPLETED')
      .reduce((sum, l) => sum + (Number(l.leadValue) || 0), 0);
    
    const avgDealSize = sales > 0 ? (convertedRevenue / sales) : 0;
    
    return { 
      callToAppt, 
      apptToSale, 
      convertedRevenue, 
      totalCalls, 
      appointments, 
      sales,
      avgDealSize
    };
  }

  // Update conversion metrics display
  function updateConversionMetrics(metrics) {
    $('#callToAppt').textContent = metrics.callToAppt.toFixed(1) + '%';
    $('#apptToSale').textContent = metrics.apptToSale.toFixed(1) + '%';
    $('#convertedRevenue').textContent = fmtMoney(metrics.convertedRevenue);
    
    // Update detail text
    $('#callToApptDetail').textContent = `${metrics.appointments} of ${metrics.totalCalls} calls accepted`;
    $('#apptToSaleDetail').textContent = `${metrics.sales} of ${metrics.appointments} appointments closed`;
    $('#convertedRevenueDetail').textContent = `From ${metrics.sales} completed ${metrics.sales === 1 ? 'sale' : 'sales'}`;
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
      
      // Generate ownership badge if applicable
      let ownershipBadge = '';
      let ownerEmail = null;
      if (ld.status === 'ACCEPTED' && ld.Accepted_By) {
        ownerEmail = ld.Accepted_By;
      } else if (ld.status === 'COMPLETED' && ld.Completed_By) {
        ownerEmail = ld.Completed_By;
      } else if (ld.status === 'CANCELLED' && ld.Cancelled_By) {
        ownerEmail = ld.Cancelled_By;
      }
      
      if (ownerEmail) {
        const initials = getUserInitials(ownerEmail);
        const color = getColorForInitials(initials, ownerEmail);
        ownershipBadge = `<span class="ownership-badge"><div class="ownership-initials" style="background-color: ${color}">${initials}</div></span>`;
      }
      
      // Generate assigned to dropdown
      const assignedTo = ld.Assigned_To || ld.assignedTo || '';
      let assignedToHtml = '<select class="assign-dropdown" data-lead-id="' + sanitize(ld.id) + '">';
      assignedToHtml += '<option value="">Unassigned</option>';
      
      // Add all users to dropdown
      if (allUsers && Array.isArray(allUsers)) {
        allUsers.forEach(user => {
          const selected = user.Email === assignedTo ? ' selected' : '';
          const userName = (user.First_Name || '') + ' ' + (user.Last_Name || '');
          assignedToHtml += '<option value="' + sanitize(user.Email) + '"' + selected + '>' + sanitize(userName.trim() || user.Email) + '</option>';
        });
      }
      assignedToHtml += '</select>';
      
      // Show assigned user badge if assigned
      let assignedBadge = '';
      if (assignedTo && allUsers) {
        const assignedUser = allUsers.find(u => u.Email === assignedTo);
        if (assignedUser) {
          const initials = getUserInitials(assignedTo);
          const color = getColorForInitials(initials, assignedTo);
          assignedBadge = '<div class="ownership-initials" style="background-color: ' + color + '; margin-left: 8px; display: inline-block;">' + initials + '</div>';
        }
      }
      
      tr.innerHTML =
        '<td>' + sanitize(createdDate) + '</td>' +
        '<td>' + sanitize(ld.customerName) + '</td>' +
        '<td>' + sanitize(ld.city) + ', ' + sanitize(ld.state) + '</td>' +
        '<td>' + sanitize(ld.reason) + '</td>' +
        '<td>' + sanitize(ld.product || ld.productSku || '') + '</td>' +
        '<td>' + fmtMoney(ld.leadValue) + '</td>' +
        '<td><span class="badge status-' + sanitize((ld.status || '').toLowerCase()) + '">' + sanitize(ld.status) + '</span>' + ownershipBadge + '</td>' +
        '<td class="assigned-cell">' + assignedToHtml + assignedBadge + '</td>' +
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

  // Render leads as cards for card view
  function renderLeadsCards(leads) {
    const grid = $('#leadsCardGrid');
    grid.innerHTML = '';
    
    // Sort leads based on current sort settings
    const sortedLeads = sortLeads(leads, currentSort.field, currentSort.direction);
    
    sortedLeads.forEach(lead => {
      const card = document.createElement('div');
      card.className = 'lead-card';
      card.setAttribute('data-lead-id', lead.id);
      
      const createdDate = new Date(lead.createdAt).toLocaleDateString();
      
      // Generate ownership badge if applicable
      let ownershipBadge = '';
      let ownerEmail = null;
      if (lead.status === 'ACCEPTED' && lead.Accepted_By) {
        ownerEmail = lead.Accepted_By;
      } else if (lead.status === 'COMPLETED' && lead.Completed_By) {
        ownerEmail = lead.Completed_By;
      } else if (lead.status === 'CANCELLED' && lead.Cancelled_By) {
        ownerEmail = lead.Cancelled_By;
      }
      
      if (ownerEmail) {
        const initials = getUserInitials(ownerEmail);
        const color = getColorForInitials(initials, ownerEmail);
        ownershipBadge = `<span class="ownership-badge"><div class="ownership-initials" style="background-color: ${color}">${initials}</div></span>`;
      }
      
      card.innerHTML = `
        <div class="lead-card-header">
          <div class="lead-customer">${sanitize(lead.customerName)}</div>
          <div><span class="badge status-${sanitize((lead.status || '').toLowerCase())}">${sanitize(lead.status)}</span>${ownershipBadge}</div>
        </div>
        <div class="lead-card-body">
          <div class="lead-info">
            <div class="info-row">
              <span class="info-label">Product:</span>
              <span class="info-value">${sanitize(lead.product || lead.productSku || 'Service')}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Location:</span>
              <span class="info-value">${sanitize(lead.city)}, ${sanitize(lead.state)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Created:</span>
              <span class="info-value">${createdDate}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Value:</span>
              <span class="info-value lead-value">${fmtMoney(lead.leadValue)}</span>
            </div>
          </div>
        </div>
        <div class="lead-card-actions">
          <button class="card-action-btn accept" data-action="ACCEPTED" data-id="${sanitize(lead.id)}">Accept</button>
          <button class="card-action-btn complete" data-action="COMPLETED" data-id="${sanitize(lead.id)}">Complete</button>
          <button class="card-action-btn cancel" data-action="CANCELLED" data-id="${sanitize(lead.id)}">Cancel</button>
        </div>
      `;
      
      // Add click handler to open modal when clicking card (but not buttons)
      card.addEventListener('click', function(e) {
        if (!e.target.closest('button')) {
          openLeadModal(lead.id);
        }
      });
      
      grid.appendChild(card);
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
    $('#modalScheduling').textContent = lead.schedulingTold || 'Not specified';
    $('#modalNotes').textContent = lead.notes || 'No additional notes';
    $('#modalStatus').value = lead.status || 'NEW';
    
    // Set status badge in header
    const status = (lead.status || 'NEW').toLowerCase();
    const statusBadge = $('#modalStatusBadge');
    statusBadge.textContent = lead.status || 'NEW';
    statusBadge.className = 'status-badge-modal ' + status;
    
    // Add ownership information if available
    let ownershipHTML = '';
    if (lead.Accepted_By || lead.Completed_By || lead.Cancelled_By) {
      ownershipHTML = '<div class="ownership-info"><h4>Lead History</h4>';
      
      if (lead.Accepted_By) {
        const initials = getUserInitials(lead.Accepted_By);
        const color = getColorForInitials(initials, lead.Accepted_By);
        const timestamp = lead.Accepted_At ? new Date(lead.Accepted_At).toLocaleString() : '';
        ownershipHTML += `<div class="ownership-item"><div class="user-avatar" style="background-color: ${color}">${initials}</div><span>Accepted by ${lead.Accepted_By}${timestamp ? ' on ' + timestamp : ''}</span></div>`;
      }
      
      if (lead.Completed_By) {
        const initials = getUserInitials(lead.Completed_By);
        const color = getColorForInitials(initials, lead.Completed_By);
        const timestamp = lead.Completed_At ? new Date(lead.Completed_At).toLocaleString() : '';
        ownershipHTML += `<div class="ownership-item"><div class="user-avatar" style="background-color: ${color}">${initials}</div><span>Completed by ${lead.Completed_By}${timestamp ? ' on ' + timestamp : ''}</span></div>`;
      }
      
      if (lead.Cancelled_By) {
        const initials = getUserInitials(lead.Cancelled_By);
        const color = getColorForInitials(initials, lead.Cancelled_By);
        const timestamp = lead.Cancelled_At ? new Date(lead.Cancelled_At).toLocaleString() : '';
        ownershipHTML += `<div class="ownership-item"><div class="user-avatar" style="background-color: ${color}">${initials}</div><span>Cancelled by ${lead.Cancelled_By}${timestamp ? ' on ' + timestamp : ''}</span></div>`;
      }
      
      ownershipHTML += '</div>';
    }
    
    // Insert ownership info before the Notes section
    const notesSection = document.querySelector('#modalNotes').closest('.modal-section');
    if (notesSection && ownershipHTML) {
      const existingOwnership = notesSection.previousElementSibling;
      if (existingOwnership && existingOwnership.classList.contains('ownership-info')) {
        existingOwnership.remove();
      }
      notesSection.insertAdjacentHTML('beforebegin', ownershipHTML);
    }
    
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
    
    // Clear previous comments immediately to prevent carryover
    const commentsList = $('#commentsList');
    const commentsCount = $('#commentsCount');
    const commentsCountBadge = $('#commentsCountBadge');
    if (commentsList) {
      commentsList.innerHTML = '<div class="comments-empty">Loading comments...</div>';
    }
    if (commentsCount) {
      commentsCount.textContent = '0';
    }
    if (commentsCountBadge) {
      commentsCountBadge.textContent = '0';
    }
    
    // Load comments for this lead
    loadCommentsForLead(leadId);
    
    // Show modals
    $('#leadModal').style.display = 'flex';
    $('#commentsModal').style.display = 'flex';
  }
  
  function closeLeadModal() {
    $('#leadModal').style.display = 'none';
    // Also close comments modal if open
    $('#commentsModal').style.display = 'none';
    // Remove the shift class
    const leadModal = document.querySelector('#leadModal .modal-content');
    if (leadModal) {
      leadModal.classList.remove('with-comments');
    }
  }

  // Advanced Analytics Engine
  function calculateAdvancedMetrics(leads, stats) {
    const totalLeads = leads.length;
    const completedLeads = leads.filter(l => l.status === 'COMPLETED').length;
    const cancelledLeads = leads.filter(l => l.status === 'CANCELLED').length;
    
    // Revenue calculations - ONLY count COMPLETED leads for actual revenue
    const completedRevenue = leads.filter(l => l.status === 'COMPLETED').reduce((sum, l) => sum + (Number(l.leadValue) || 0), 0);
    const totalRevenue = completedRevenue; // Total Revenue = Completed Revenue (actual money earned)
    
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
    
    // Service analysis - ONLY count COMPLETED leads for revenue
    const byService = {};
    leads.filter(l => l.status === 'COMPLETED').forEach(l => {
      const service = l.product || 'Unknown';
      byService[service] = (byService[service] || 0) + (Number(l.leadValue) || 0);
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
  
  // Draw conversion funnel chart (Joel's key metric visualization)
  function drawConversionFunnel(metrics) {
    console.log('📊 Drawing conversion funnel...');
    
    if (!window.google || !google.visualization) {
      console.error('Google Charts not loaded');
      return;
    }
    
    const data = google.visualization.arrayToDataTable([
      ['Stage', 'Count', { role: 'style' }],
      ['Total Calls', metrics.totalCalls, '#3b82f6'],
      ['Appointments\n(Accepted)', metrics.appointments, '#10b981'],
      ['Sales\n(Completed)', metrics.sales, '#f59e0b']
    ]);
    
    const options = {
      title: 'Lead Conversion Funnel',
      backgroundColor: 'transparent',
      titleTextStyle: { color: '#f1f5f9', fontSize: 18, bold: true },
      legend: 'none',
      hAxis: { 
        textStyle: { color: '#94a3b8', fontSize: 12 },
        gridlines: { color: '#334155' }
      },
      vAxis: { 
        textStyle: { color: '#94a3b8', fontSize: 12 },
        gridlines: { color: '#334155' },
        minValue: 0
      },
      chartArea: { width: '80%', height: '70%' },
      height: 400,
      bar: { groupWidth: '60%' }
    };
    
    const chart = new google.visualization.ColumnChart(document.getElementById('conversionFunnelChart'));
    chart.draw(data, options);
    console.log('✅ Conversion funnel drawn');
  }

  function drawMasterpieceCharts(leads, stats) {
    console.log('🎨 Drawing masterpiece charts with', leads.length, 'leads');
    
    if (!window.google || !google.charts) {
      console.error('❌ Google Charts not available');
      return;
    }
    
    const metrics = calculateAdvancedMetrics(leads, stats);
    updateExecutiveSummary(metrics);
    
    // Calculate and draw conversion metrics
    const conversionMetrics = calculateConversionMetrics(leads);
    updateConversionMetrics(conversionMetrics);
    
    google.charts.load('current', { 
      packages: ['corechart'] 
    });
    
    google.charts.setOnLoadCallback(function(){
      console.log('📊 Google Charts loaded, drawing charts...');
      try {
        drawConversionFunnel(conversionMetrics);
        drawRevenueFunnel(leads);
        drawLeadSources(leads);
        drawGeographicDistribution(metrics.byState);
        drawServicePerformance(metrics.byService);
        drawTimeAnalysis(leads);
        drawConversionTimeline(leads);
        drawRevenueTrends(leads);
        console.log('✅ All charts drawn successfully');
      } catch (error) {
        console.error('❌ Error drawing charts:', error);
      }
    });
  }
  
  function drawRevenueFunnel(leads) {
    console.log('📊 Drawing revenue funnel...');
    const data = google.visualization.arrayToDataTable([
      ['Stage', 'Count', { role: 'style' }, { role: 'annotation' }],
      ['New Leads', leads.filter(l => l.status === 'NEW').length, '#3b82f6', ''],
      ['Accepted', leads.filter(l => l.status === 'ACCEPTED').length, '#10b981', ''],
      ['Completed', leads.filter(l => l.status === 'COMPLETED').length, '#f59e0b', '']
    ]);
    
    const options = {
      backgroundColor: 'transparent',
      legend: 'none',
      hAxis: { 
        textStyle: { color: '#94a3b8', fontSize: 13 },
        gridlines: { color: 'transparent' }
      },
      vAxis: { 
        textStyle: { color: '#94a3b8', fontSize: 13 },
        gridlines: { color: '#334155' },
        minValue: 0
      },
      chartArea: { width: '85%', height: '75%' },
      height: 350,
      bar: { groupWidth: '65%' },
      annotations: {
        textStyle: {
          fontSize: 14,
          color: '#e2e8f0',
          bold: true
        }
      }
    };
    
    const chart = new google.visualization.ColumnChart(document.getElementById('chartRevenueFunnel'));
    chart.draw(data, options);
    console.log('✅ Revenue funnel drawn');
  }
  
  function drawLeadSources(leads) {
    console.log('📊 Drawing lead sources...');
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Source');
    data.addColumn('number', 'Leads');
    
    // For now, all are call center, but this can be expanded
    data.addRows([
      ['Call Center', leads.length]
    ]);
    
    const options = {
      backgroundColor: 'transparent',
      legend: { 
        position: 'bottom',
        textStyle: { color: '#94a3b8', fontSize: 12 }
      },
      pieHole: 0.4,
      colors: ['#3b82f6', '#10b981', '#f59e0b'],
      chartArea: { width: '90%', height: '80%' },
      height: 280,
      pieSliceText: 'percentage',
      pieSliceTextStyle: {
        color: '#e2e8f0',
        fontSize: 14,
        bold: true
      },
      tooltip: {
        textStyle: { color: '#1e293b', fontSize: 13 },
        showColorCode: true
      }
    };
    
    const chart = new google.visualization.PieChart(document.getElementById('chartLeadSources'));
    chart.draw(data, options);
    console.log('✅ Lead sources drawn');
  }
  
  function drawGeographicDistribution(byState) {
    console.log('📊 Drawing geographic distribution...', byState);
    
    const stateData = Object.entries(byState).map(([state, count]) => [state, count]);
    if (stateData.length === 0) {
      stateData.push(['No Data', 0]);
    }
    
    // Sort by count descending
    stateData.sort((a, b) => b[1] - a[1]);
    
    const data = google.visualization.arrayToDataTable([
      ['State', 'Leads', { role: 'style' }],
      ...stateData.map((row, i) => [
        row[0], 
        row[1], 
        i === 0 ? '#10b981' : '#3b82f6' // Top state in green
      ])
    ]);
    
    const options = {
      backgroundColor: 'transparent',
      legend: 'none',
      hAxis: { 
        textStyle: { color: '#94a3b8', fontSize: 12 },
        gridlines: { color: 'transparent' }
      },
      vAxis: { 
        textStyle: { color: '#94a3b8', fontSize: 12 },
        gridlines: { color: '#334155' },
        minValue: 0
      },
      chartArea: { width: '85%', height: '70%' },
      height: 280,
      bar: { groupWidth: '70%' }
    };
    
    const chart = new google.visualization.ColumnChart(document.getElementById('chartGeographic'));
    chart.draw(data, options);
    
    // Update top region
    if (stateData.length > 0 && stateData[0][0] !== 'No Data') {
      const topState = stateData[0];
      $('#topRegion').textContent = `Top: ${topState[0]} (${topState[1]} leads)`;
    }
    console.log('✅ Geographic distribution drawn');
  }
  
  function drawServicePerformance(byService) {
    console.log('📊 Drawing service performance...', byService);
    
    const serviceData = Object.entries(byService).map(([service, revenue]) => [service, revenue]);
    if (serviceData.length === 0) {
      serviceData.push(['No Data', 0]);
    }
    
    // Sort by revenue descending and take top 10
    serviceData.sort((a, b) => b[1] - a[1]);
    const topServices = serviceData.slice(0, 10);
    
    const data = google.visualization.arrayToDataTable([
      ['Service', 'Revenue', { role: 'style' }],
      ...topServices.map((row, i) => [
        row[0].length > 25 ? row[0].substring(0, 25) + '...' : row[0], 
        row[1],
        i === 0 ? '#10b981' : '#3b82f6' // Top service in green
      ])
    ]);
    
    const options = {
      backgroundColor: 'transparent',
      legend: 'none',
      hAxis: { 
        textStyle: { color: '#94a3b8', fontSize: 11 },
        slantedText: true,
        slantedTextAngle: 45,
        gridlines: { color: 'transparent' }
      },
      vAxis: { 
        textStyle: { color: '#94a3b8', fontSize: 12 },
        gridlines: { color: '#334155' },
        minValue: 0,
        format: 'currency'
      },
      chartArea: { width: '85%', height: '60%' },
      height: 280,
      bar: { groupWidth: '70%' }
    };
    
    const chart = new google.visualization.ColumnChart(document.getElementById('chartServicePerformance'));
    chart.draw(data, options);
    
    // Update top service
    if (topServices.length > 0 && topServices[0][0] !== 'No Data') {
      const topService = topServices[0];
      $('#topService').textContent = `Best: ${topService[0]} (${fmtMoney(topService[1])})`;
    }
    console.log('✅ Service performance drawn');
  }
  
  function drawTimeAnalysis(leads) {
    console.log('📊 Drawing time analysis...');
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Reason');
    data.addColumn('number', 'Count');
    
    // Group by reason for call
    const reasonCounts = {};
    leads.forEach(l => {
      const reason = l.reason || 'Other';
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });
    
    const reasonData = Object.entries(reasonCounts).map(([reason, count]) => [reason, count]);
    if (reasonData.length === 0) {
      reasonData.push(['No Data', 0]);
    }
    data.addRows(reasonData);
    
    const options = {
      backgroundColor: 'transparent',
      titleTextStyle: { color: '#f1f5f9' },
      hAxis: { textStyle: { color: '#94a3b8' } },
      vAxis: { textStyle: { color: '#94a3b8' } },
      colors: ['#f59e0b'],
      height: 300
    };
    
    const chart = new google.visualization.ColumnChart(document.getElementById('chartTimeAnalysis'));
    chart.draw(data, options);
    
    // Find top reason
    if (reasonData.length > 0 && reasonData[0][0] !== 'No Data') {
      const topReason = reasonData.reduce((a, b) => a[1] > b[1] ? a : b);
      $('#peakHour').textContent = `Most Common: ${topReason[0]} (${topReason[1]} leads)`;
    }
    console.log('✅ Time analysis drawn');
  }
  
  function drawConversionTimeline(leads) {
    console.log('📊 Drawing conversion timeline...');
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Status');
    data.addColumn('number', 'Count');
    
    const statusCounts = {
      'NEW': leads.filter(l => l.status === 'NEW').length,
      'ACCEPTED': leads.filter(l => l.status === 'ACCEPTED').length,
      'COMPLETED': leads.filter(l => l.status === 'COMPLETED').length,
      'CANCELLED': leads.filter(l => l.status === 'CANCELLED').length
    };
    
    Object.entries(statusCounts).forEach(([status, count]) => {
      data.addRow([status, count]);
    });
    
    const options = {
      backgroundColor: 'transparent',
      titleTextStyle: { color: '#f1f5f9' },
      hAxis: { textStyle: { color: '#94a3b8' } },
      vAxis: { textStyle: { color: '#94a3b8' } },
      colors: ['#8b5cf6'],
      height: 300
    };
    
    const chart = new google.visualization.ColumnChart(document.getElementById('chartConversionTimeline'));
    chart.draw(data, options);
    
    // Calculate completion rate
    const completionRate = leads.length > 0 ? (statusCounts.COMPLETED / leads.length * 100) : 0;
    $('#avgConversionTime').textContent = `Completion: ${completionRate.toFixed(1)}%`;
    console.log('✅ Conversion timeline drawn');
  }
  
  function drawRevenueTrends(leads) {
    console.log('📊 Drawing revenue trends...');
    
    // Group by day for more granular view - ONLY count COMPLETED leads for actual revenue
    const dailyRevenue = {};
    leads.filter(l => l.status === 'COMPLETED').forEach(l => {
      const date = l.createdAt.substring(0, 10); // YYYY-MM-DD
      dailyRevenue[date] = (dailyRevenue[date] || 0) + (Number(l.leadValue) || 0);
    });
    
    const sortedDates = Object.keys(dailyRevenue).sort();
    
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Date');
    data.addColumn('number', 'Daily Revenue');
    
    if (sortedDates.length === 0) {
      data.addRow(['No Data', 0]);
    } else {
      sortedDates.forEach(date => {
        // Format date for better display (MM/DD)
        const dateObj = new Date(date);
        const formatted = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
        data.addRow([formatted, dailyRevenue[date]]);
      });
    }
    
    const options = {
      backgroundColor: 'transparent',
      legend: 'none',
      hAxis: { 
        textStyle: { color: '#94a3b8', fontSize: 11 },
        gridlines: { color: '#334155' },
        slantedText: true,
        slantedTextAngle: 45
      },
      vAxis: { 
        textStyle: { color: '#94a3b8', fontSize: 12 },
        gridlines: { color: '#334155' },
        minValue: 0,
        format: 'currency'
      },
      chartArea: { width: '85%', height: '70%' },
      height: 450,
      lineWidth: 3,
      pointSize: 6,
      colors: ['#10b981'],
      curveType: 'function',
      tooltip: {
        textStyle: { color: '#1e293b', fontSize: 13 },
        showColorCode: false
      }
    };
    
    const chart = new google.visualization.LineChart(document.getElementById('chartRevenueTrends'));
    chart.draw(data, options);
    console.log('✅ Revenue trends drawn');
  }
  
  // Comprehensive Trend Analysis Functions
  function calculateTrendMetrics(leads) {
    console.log('📊 Calculating trend metrics...');
    
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Current week leads
    const currentWeekLeads = leads.filter(l => new Date(l.createdAt) >= sevenDaysAgo);
    const lastWeekLeads = leads.filter(l => {
      const date = new Date(l.createdAt);
      return date >= fourteenDaysAgo && date < sevenDaysAgo;
    });
    
    // Week-over-week growth
    const currentWeekRevenue = currentWeekLeads.filter(l => l.status === 'COMPLETED')
      .reduce((sum, l) => sum + (Number(l.leadValue) || 0), 0);
    const lastWeekRevenue = lastWeekLeads.filter(l => l.status === 'COMPLETED')
      .reduce((sum, l) => sum + (Number(l.leadValue) || 0), 0);
    const weekOverWeekGrowth = lastWeekRevenue > 0 
      ? ((currentWeekRevenue - lastWeekRevenue) / lastWeekRevenue * 100) 
      : 0;
    
    // Lead velocity (7-day average)
    const leadVelocity = currentWeekLeads.length / 7;
    
    // 30-day projection (simple linear extrapolation)
    const last30DaysRevenue = leads.filter(l => {
      const date = new Date(l.createdAt);
      return date >= thirtyDaysAgo && l.status === 'COMPLETED';
    }).reduce((sum, l) => sum + (Number(l.leadValue) || 0), 0);
    const dailyAvgRevenue = last30DaysRevenue / 30;
    const monthProjection = dailyAvgRevenue * 30;
    
    // Conversion trend
    const currentWeekConversion = currentWeekLeads.length > 0
      ? (currentWeekLeads.filter(l => l.status === 'COMPLETED').length / currentWeekLeads.length * 100)
      : 0;
    const lastWeekConversion = lastWeekLeads.length > 0
      ? (lastWeekLeads.filter(l => l.status === 'COMPLETED').length / lastWeekLeads.length * 100)
      : 0;
    const conversionTrend = lastWeekConversion > 0
      ? ((currentWeekConversion - lastWeekConversion) / lastWeekConversion * 100)
      : 0;
    
    return {
      weekOverWeekGrowth,
      weekOverWeekRevenue: { current: currentWeekRevenue, last: lastWeekRevenue },
      leadVelocity,
      monthProjection,
      conversionTrend,
      currentWeekConversion,
      lastWeekConversion
    };
  }
  
  function updateTrendMetrics(metrics) {
    $('#weekOverWeekGrowth').textContent = (metrics.weekOverWeekGrowth >= 0 ? '+' : '') + metrics.weekOverWeekGrowth.toFixed(1) + '%';
    $('#weekOverWeekDetail').textContent = `$${metrics.weekOverWeekRevenue.current.toFixed(0)} vs $${metrics.weekOverWeekRevenue.last.toFixed(0)}`;
    
    $('#leadVelocity').textContent = metrics.leadVelocity.toFixed(1);
    $('#leadVelocityDetail').textContent = 'Leads per day (7-day avg)';
    
    $('#monthProjection').textContent = fmtMoney(metrics.monthProjection);
    $('#monthProjectionDetail').textContent = 'Based on current trend';
    
    $('#conversionTrend').textContent = (metrics.conversionTrend >= 0 ? '+' : '') + metrics.conversionTrend.toFixed(1) + '%';
    $('#conversionTrendDetail').textContent = `${metrics.currentWeekConversion.toFixed(1)}% vs ${metrics.lastWeekConversion.toFixed(1)}%`;
  }
  
  function drawLeadVolumeTrend(leads) {
    console.log('📊 Drawing lead volume trend...');
    
    // Group by day
    const dailyVolume = {};
    leads.forEach(l => {
      const date = l.createdAt.substring(0, 10);
      dailyVolume[date] = (dailyVolume[date] || 0) + 1;
    });
    
    const sortedDates = Object.keys(dailyVolume).sort();
    
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Date');
    data.addColumn('number', 'Leads');
    
    if (sortedDates.length === 0) {
      data.addRow(['No Data', 0]);
    } else {
      sortedDates.forEach(date => {
        const dateObj = new Date(date);
        const formatted = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
        data.addRow([formatted, dailyVolume[date]]);
      });
    }
    
    const options = {
      backgroundColor: 'transparent',
      legend: 'none',
      hAxis: { 
        textStyle: { color: '#94a3b8', fontSize: 11 },
        slantedText: true,
        slantedTextAngle: 45
      },
      vAxis: { 
        textStyle: { color: '#94a3b8', fontSize: 12 },
        gridlines: { color: '#334155' },
        minValue: 0
      },
      chartArea: { width: '85%', height: '70%' },
      height: 300,
      colors: ['#3b82f6'],
      lineWidth: 2,
      pointSize: 5,
      curveType: 'function'
    };
    
    const chart = new google.visualization.LineChart(document.getElementById('chartLeadVolumeTrend'));
    chart.draw(data, options);
    
    // Update average
    const avgDaily = leads.length / sortedDates.length;
    $('#avgDailyLeads').textContent = `Avg: ${avgDaily.toFixed(1)}/day`;
  }
  
  function drawConversionRateTrend(leads) {
    console.log('📊 Drawing conversion rate trend...');
    
    // Group by day and calculate conversion rate
    const dailyData = {};
    leads.forEach(l => {
      const date = l.createdAt.substring(0, 10);
      if (!dailyData[date]) {
        dailyData[date] = { total: 0, completed: 0 };
      }
      dailyData[date].total++;
      if (l.status === 'COMPLETED') {
        dailyData[date].completed++;
      }
    });
    
    const sortedDates = Object.keys(dailyData).sort();
    
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Date');
    data.addColumn('number', 'Conversion %');
    
    let totalConversion = 0;
    sortedDates.forEach(date => {
      const dateObj = new Date(date);
      const formatted = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
      const conversionRate = dailyData[date].total > 0 
        ? (dailyData[date].completed / dailyData[date].total * 100) 
        : 0;
      data.addRow([formatted, conversionRate]);
      totalConversion += conversionRate;
    });
    
    const options = {
      backgroundColor: 'transparent',
      legend: 'none',
      hAxis: { 
        textStyle: { color: '#94a3b8', fontSize: 11 },
        slantedText: true,
        slantedTextAngle: 45
      },
      vAxis: { 
        textStyle: { color: '#94a3b8', fontSize: 12 },
        gridlines: { color: '#334155' },
        minValue: 0,
        format: '#\'%\''
      },
      chartArea: { width: '85%', height: '70%' },
      height: 300,
      colors: ['#10b981'],
      lineWidth: 2,
      pointSize: 5,
      curveType: 'function'
    };
    
    const chart = new google.visualization.LineChart(document.getElementById('chartConversionRateTrend'));
    chart.draw(data, options);
    
    // Update average
    const avgConversion = sortedDates.length > 0 ? totalConversion / sortedDates.length : 0;
    $('#trendConversionAvg').textContent = `Avg: ${avgConversion.toFixed(1)}%`;
  }
  
  function drawDealSizeTrend(leads) {
    console.log('📊 Drawing deal size trend...');
    
    // Group completed leads by day and calculate average deal size
    const dailyDeals = {};
    leads.filter(l => l.status === 'COMPLETED').forEach(l => {
      const date = l.createdAt.substring(0, 10);
      if (!dailyDeals[date]) {
        dailyDeals[date] = { total: 0, count: 0 };
      }
      dailyDeals[date].total += (Number(l.leadValue) || 0);
      dailyDeals[date].count++;
    });
    
    const sortedDates = Object.keys(dailyDeals).sort();
    
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Date');
    data.addColumn('number', 'Avg Deal Size');
    
    let totalAvg = 0;
    sortedDates.forEach(date => {
      const dateObj = new Date(date);
      const formatted = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
      const avgSize = dailyDeals[date].count > 0 
        ? (dailyDeals[date].total / dailyDeals[date].count) 
        : 0;
      data.addRow([formatted, avgSize]);
      totalAvg += avgSize;
    });
    
    if (sortedDates.length === 0) {
      data.addRow(['No Data', 0]);
    }
    
    const options = {
      backgroundColor: 'transparent',
      legend: 'none',
      hAxis: { 
        textStyle: { color: '#94a3b8', fontSize: 11 },
        slantedText: true,
        slantedTextAngle: 45
      },
      vAxis: { 
        textStyle: { color: '#94a3b8', fontSize: 12 },
        gridlines: { color: '#334155' },
        minValue: 0,
        format: 'currency'
      },
      chartArea: { width: '85%', height: '70%' },
      height: 300,
      colors: ['#8b5cf6'],
      lineWidth: 2,
      pointSize: 5,
      curveType: 'function'
    };
    
    const chart = new google.visualization.LineChart(document.getElementById('chartDealSizeTrend'));
    chart.draw(data, options);
    
    // Update average
    const overallAvg = sortedDates.length > 0 ? totalAvg / sortedDates.length : 0;
    $('#trendDealSizeAvg').textContent = `Avg: ${fmtMoney(overallAvg)}`;
  }
  
  function drawStatusFlow(leads) {
    console.log('📊 Drawing status flow...');
    
    // Group by week and status
    const weeklyStatus = {};
    leads.forEach(l => {
      const date = new Date(l.createdAt);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      const weekKey = weekStart.toISOString().substring(0, 10);
      
      if (!weeklyStatus[weekKey]) {
        weeklyStatus[weekKey] = { NEW: 0, ACCEPTED: 0, COMPLETED: 0, CANCELLED: 0 };
      }
      weeklyStatus[weekKey][l.status] = (weeklyStatus[weekKey][l.status] || 0) + 1;
    });
    
    const sortedWeeks = Object.keys(weeklyStatus).sort().slice(-8); // Last 8 weeks
    
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Week');
    data.addColumn('number', 'NEW');
    data.addColumn('number', 'ACCEPTED');
    data.addColumn('number', 'COMPLETED');
    data.addColumn('number', 'CANCELLED');
    
    sortedWeeks.forEach(week => {
      const weekDate = new Date(week);
      const formatted = `${weekDate.getMonth() + 1}/${weekDate.getDate()}`;
      data.addRow([
        formatted,
        weeklyStatus[week].NEW || 0,
        weeklyStatus[week].ACCEPTED || 0,
        weeklyStatus[week].COMPLETED || 0,
        weeklyStatus[week].CANCELLED || 0
      ]);
    });
    
    if (sortedWeeks.length === 0) {
      data.addRow(['No Data', 0, 0, 0, 0]);
    }
    
    const options = {
      backgroundColor: 'transparent',
      isStacked: true,
      legend: { position: 'top', textStyle: { color: '#94a3b8', fontSize: 12 } },
      hAxis: { 
        textStyle: { color: '#94a3b8', fontSize: 11 }
      },
      vAxis: { 
        textStyle: { color: '#94a3b8', fontSize: 12 },
        gridlines: { color: '#334155' },
        minValue: 0
      },
      chartArea: { width: '85%', height: '65%' },
      height: 300,
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
    };
    
    const chart = new google.visualization.ColumnChart(document.getElementById('chartStatusFlow'));
    chart.draw(data, options);
  }
  
  function drawAllTrendCharts(leads) {
    console.log('📊 Drawing all trend charts...');
    
    const trendMetrics = calculateTrendMetrics(leads);
    updateTrendMetrics(trendMetrics);
    
    google.charts.setOnLoadCallback(function() {
      try {
        drawRevenueTrends(leads);
        drawLeadVolumeTrend(leads);
        drawConversionRateTrend(leads);
        drawDealSizeTrend(leads);
        drawStatusFlow(leads);
        console.log('✅ All trend charts drawn');
      } catch (error) {
        console.error('❌ Error drawing trend charts:', error);
      }
    });
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
    $('#loadingSpinner').style.display = 'flex';
    $('#mainDashboard').style.display = 'none';
  }
  
  function hideLoading() {
    $('#loadingSpinner').style.display = 'none';
    $('#mainDashboard').style.display = 'block';
  }

  function showSection(sectionId) {
    console.log('🔄 Switching to section:', sectionId);
    
    // Hide all sections (both display and active class)
    $('#leadsSection').style.display = 'none';
    $('#analyticsSection').style.display = 'none';
    const usersSection = $('#usersSection');
    if (usersSection) {
      usersSection.classList.remove('active');
      console.log('🔄 Removed active class from usersSection');
    }
    
    // Show selected section
    const targetSection = $('#' + sectionId);
    if (targetSection) {
      if (sectionId === 'usersSection') {
        // Users section needs 'active' class due to !important in CSS
        targetSection.classList.add('active');
        console.log('✅ Added active class to usersSection');
      } else {
        targetSection.style.display = 'block';
      }
      console.log('✅ Section displayed:', sectionId);
    } else {
      console.error('❌ Section not found:', sectionId);
    }
    
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
    } else if (sectionId === 'usersSection') {
      const usersTab = $('#usersTab');
      if (usersTab) {
        usersTab.classList.add('active');
        console.log('✅ Users tab activated');
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
    else if (viewId === 'trendsAnalytics') {
      $('#trendsView').classList.add('active');
      // Draw trend charts when trends view is shown
      if (window.CURRENT_LEADS_ORIGINAL && window.CURRENT_LEADS_ORIGINAL.length > 0) {
        drawAllTrendCharts(window.CURRENT_LEADS_ORIGINAL);
      }
    }
  }

  // ====================
  // REAL-TIME POLLING FUNCTIONS
  // ====================
  
  async function pollForUpdates() {
    // Don't poll if tab is hidden or already polling
    if (!isTabVisible || isPollingInProgress) {
      return;
    }
    
    isPollingInProgress = true;
    
    try {
      const token = getToken();
      if (!token) return;
      
      // Fetch latest leads with current filters
      const statusFilter = $('#statusFilter') ? $('#statusFilter').value : '';
      const fromDate = $('#fromDate') ? $('#fromDate').value : '';
      const toDate = $('#toDate') ? $('#toDate').value : '';
      
      const query = { token };
      if (statusFilter) query.status = statusFilter;
      if (fromDate) query.from = fromDate;
      if (toDate) query.to = toDate;
      
      const freshLeads = await listLeads(query);
      
      if (!freshLeads || !Array.isArray(freshLeads)) return;
      
      // Detect new leads and changes
      const newLeads = [];
      const updatedLeads = [];
      
      freshLeads.forEach(lead => {
        const isNew = !knownLeadIds.has(lead.id);
        const oldStatus = leadStatusMap.get(lead.id);
        const oldAssignment = leadAssignmentMap.get(lead.id);
        const statusChanged = oldStatus && oldStatus !== lead.status;
        const assignmentChanged = oldAssignment !== undefined && oldAssignment !== (lead.assignedTo || '');
        
        // Check if this lead's assignment was recently changed by user
        const recentChangeTime = recentAssignmentChanges.get(lead.id);
        const isProtectedAssignment = recentChangeTime && (Date.now() - recentChangeTime < ASSIGNMENT_PROTECTION_MS);
        
        if (isNew) {
          newLeads.push(lead);
          knownLeadIds.add(lead.id);
          leadStatusMap.set(lead.id, lead.status);
          leadAssignmentMap.set(lead.id, lead.assignedTo || '');
        } else if (statusChanged) {
          updatedLeads.push({ lead, oldStatus });
          leadStatusMap.set(lead.id, lead.status);
          // Only update assignment if not protected
          if (!isProtectedAssignment) {
            leadAssignmentMap.set(lead.id, lead.assignedTo || '');
          }
        } else if (assignmentChanged && !isProtectedAssignment) {
          // Only track assignment change if not protected by recent user change
          leadAssignmentMap.set(lead.id, lead.assignedTo || '');
        }
      });
      
      // Show notifications and update UI
      if (newLeads.length > 0) {
        showNewLeadNotification(newLeads);
        // Refresh the leads table
        $('#applyFilters').click();
      } else if (updatedLeads.length > 0) {
        showUpdateNotification(updatedLeads);
        // Refresh the leads table
        $('#applyFilters').click();
      }
      
      // Reset error count on success
      consecutiveErrors = 0;
      updatePollingIndicator('online');
      
    } catch (error) {
      consecutiveErrors++;
      console.error('Polling error:', error);
      
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        updatePollingIndicator('offline');
        showError('Lost connection to server. Retrying...');
      }
    } finally {
      isPollingInProgress = false;
    }
  }
  
  function showNewLeadNotification(newLeads) {
    const count = newLeads.length;
    const message = count === 1 
      ? `🔔 New Lead: ${newLeads[0].customerFirstName} ${newLeads[0].customerLastName}`
      : `🔔 ${count} New Leads Received`;
    
    showToast(message);
    
    // Optional: Browser desktop notification (requires permission)
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('New Lead', {
        body: message
      });
    }
  }
  
  function showUpdateNotification(updatedLeads) {
    const count = updatedLeads.length;
    const message = count === 1
      ? `✏️ Lead Updated: ${updatedLeads[0].lead.customerFirstName} ${updatedLeads[0].lead.customerLastName} → ${updatedLeads[0].lead.status}`
      : `✏️ ${count} Leads Updated`;
    
    showToast(message);
  }
  
  function startPolling() {
    // Clear any existing interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    
    // Start new polling interval
    pollingInterval = setInterval(pollForUpdates, POLL_INTERVAL_MS);
    console.log('✅ Real-time updates started - checking every', POLL_INTERVAL_MS / 1000, 'seconds');
  }
  
  function stopPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
      console.log('⏸️ Real-time updates stopped');
    }
  }
  
  function resetPollingState() {
    // Reset tracking when filters change
    knownLeadIds.clear();
    leadStatusMap.clear();
    leadAssignmentMap.clear();
    recentAssignmentChanges.clear();
    lastPollTimestamp = null;
  }
  
  function updatePollingIndicator(status) {
    const indicator = $('#pollingIndicator');
    if (!indicator) return;
    
    if (status === 'online') {
      indicator.classList.remove('offline');
      const textEl = indicator.querySelector('.polling-text');
      if (textEl) textEl.textContent = 'Live';
    } else {
      indicator.classList.add('offline');
      const textEl = indicator.querySelector('.polling-text');
      if (textEl) textEl.textContent = 'Offline';
    }
  }
  
  // Request notification permission (optional)
  function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }
  }
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', function() {
    stopPolling();
  });

  document.addEventListener('DOMContentLoaded', async function(){
    clearError();
    showLoading();
    
    const token = getToken();
    if (!token) { 
      hideLoading();
      $('#unauthorized').style.display = 'block'; 
      return; 
    }
    
    // Set up login form handler (needs to be attached before checking session)
    $('#loginForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const email = $('#loginEmail').value.trim();
      const password = $('#loginPassword').value;
      
      const success = await handleLogin(email, password);
      if (success) {
        // After successful login, initialize the dashboard
        updateUserMenu();
        await initializeDashboard();
      }
    });
    
    // Logout button handler
    $('#logoutBtn').addEventListener('click', function() {
      if (confirm('Are you sure you want to log out?')) {
        handleLogout();
      }
    });
    
    // Check for existing session
    const hasSession = checkSession();
    if (!hasSession) {
      hideLoading();
      showLoginModal();
      // Wait for login before proceeding
      return;
    }
    
    // Update user menu with session data
    updateUserMenu();
    
    // Initialize dashboard if already logged in
    await initializeDashboard();
  });

  // Dashboard initialization function (called after login or if already logged in)
  async function initializeDashboard() {
    const token = getToken();
    if (!token) return;
    
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
    $('#usersTab').addEventListener('click', () => {
      showSection('usersSection');
      loadAllUsers(); // Load users when tab is clicked
    });
    
    // User Management event listeners
    $('#addUserBtn').addEventListener('click', () => openUserModal('create'));
    $('#closeUserModal').addEventListener('click', closeUserModal);
    $('#cancelUserBtn').addEventListener('click', closeUserModal);
    $('#userForm').addEventListener('submit', handleUserFormSubmit);
    
    // Comments modal close handler
    $('#closeCommentsModal').addEventListener('click', function() {
      // Close both modals
      closeLeadModal();
    });
    
    $('#addCommentBtn').addEventListener('click', addCommentToLead);
    $('#commentInput').addEventListener('keydown', function(e) {
      // Allow Ctrl+Enter or Cmd+Enter to submit
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        addCommentToLead();
      }
    });
    
    // Prevent dropdown from triggering row click (stop propagation)
    document.addEventListener('click', function(e) {
      if (e.target && (e.target.classList.contains('assign-dropdown') || e.target.closest('.assigned-cell'))) {
        e.stopPropagation();
      }
    }, true);
    
    // Assign dropdown handler (using event delegation)
    document.addEventListener('change', async function(e) {
      if (e.target && e.target.classList.contains('assign-dropdown')) {
        e.stopPropagation(); // Prevent triggering row click
        
        const leadId = e.target.getAttribute('data-lead-id');
        const assignedEmail = e.target.value;
        
        try {
          const token = getToken();
          if (!token) return;
          
          // Mark this assignment change as recent to protect from polling overwrites
          recentAssignmentChanges.set(leadId, Date.now());
          
          // Update lead assignment
          const response = await fetchJSON(API() + '?api=leads&id=' + encodeURIComponent(leadId) + '&token=' + encodeURIComponent(token) + '&_method=PATCH&assignedTo=' + encodeURIComponent(assignedEmail));
          
          if (response && !response.error) {
            showToast('Lead assignment updated');
            
            // Update local data immediately without full refresh
            if (window.CURRENT_LEADS) {
              const lead = window.CURRENT_LEADS.find(l => l.id === leadId);
              if (lead) {
                lead.assignedTo = assignedEmail;
                lead.Assigned_To = assignedEmail;
              }
            }
            if (window.CURRENT_LEADS_ORIGINAL) {
              const lead = window.CURRENT_LEADS_ORIGINAL.find(l => l.id === leadId);
              if (lead) {
                lead.assignedTo = assignedEmail;
                lead.Assigned_To = assignedEmail;
              }
            }
            
            // Update tracking maps
            leadAssignmentMap.set(leadId, assignedEmail);
            
            // Update the assignment badge visually without full table refresh
            const row = document.querySelector(`tr[data-lead-id="${leadId}"]`);
            if (row && allUsers) {
              const assignedCell = row.querySelector('.assigned-cell');
              if (assignedCell) {
                let assignedBadge = '';
                if (assignedEmail) {
                  const assignedUser = allUsers.find(u => u.Email === assignedEmail);
                  if (assignedUser) {
                    const initials = getUserInitials(assignedEmail);
                    const color = getColorForInitials(initials, assignedEmail);
                    assignedBadge = '<div class="ownership-initials" style="background-color: ' + color + '; margin-left: 8px; display: inline-block;">' + initials + '</div>';
                  }
                }
                // Update only the badge, keep the dropdown selected
                const existingDropdown = assignedCell.querySelector('.assign-dropdown');
                if (existingDropdown) {
                  const badgeElements = assignedCell.querySelectorAll('.ownership-initials');
                  badgeElements.forEach(el => el.remove());
                  if (assignedBadge) {
                    assignedCell.insertAdjacentHTML('beforeend', assignedBadge);
                  }
                }
              }
            }
          } else {
            throw new Error(response.error || 'Failed to update assignment');
          }
        } catch (error) {
          console.error('Error updating assignment:', error);
          showError('Failed to update assignment: ' + error.message);
        }
      }
    });
    
    // Analytics view switching
    $('#overviewView').addEventListener('click', () => showAnalyticsView('overviewAnalytics'));
    $('#performanceView').addEventListener('click', () => showAnalyticsView('performanceAnalytics'));
    $('#trendsView').addEventListener('click', () => showAnalyticsView('trendsAnalytics'));
    
    // View toggle (Table vs Card)
    let currentView = 'table';
    $('#tableViewBtn').addEventListener('click', function() {
      currentView = 'table';
      $('#tableViewContainer').style.display = 'block';
      $('#cardViewContainer').style.display = 'none';
      $('#tableViewBtn').classList.add('active');
      $('#cardViewBtn').classList.remove('active');
    });
    
    $('#cardViewBtn').addEventListener('click', function() {
      currentView = 'card';
      $('#tableViewContainer').style.display = 'none';
      $('#cardViewContainer').style.display = 'block';
      $('#cardViewBtn').classList.add('active');
      $('#tableViewBtn').classList.remove('active');
      
      // Render cards if we have leads
      if (window.CURRENT_LEADS_ORIGINAL) {
        renderLeadsCards(window.CURRENT_LEADS_ORIGINAL);
      }
    });
    
    // Export functionality
    $('#exportCSV').addEventListener('click', function() {
      if (!window.CURRENT_LEADS_ORIGINAL || window.CURRENT_LEADS_ORIGINAL.length === 0) {
        showToast('No data to export');
        return;
      }
      
      const companyName = $('#companyName').textContent.replace(' Dashboard', '');
      exportToCSV(window.CURRENT_LEADS_ORIGINAL, companyName);
      showToast('Exported ' + window.CURRENT_LEADS_ORIGINAL.length + ' leads to CSV');
    });
    
    $('#exportXLSX').addEventListener('click', function() {
      if (!window.CURRENT_LEADS_ORIGINAL || window.CURRENT_LEADS_ORIGINAL.length === 0) {
        showToast('No data to export');
        return;
      }
      
      const companyName = $('#companyName').textContent.replace(' Dashboard', '');
      exportToXLSX(window.CURRENT_LEADS_ORIGINAL, companyName);
      showToast('Exported ' + window.CURRENT_LEADS_ORIGINAL.length + ' leads to Excel');
    });
    
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
      
      // Add loading feedback
      const originalText = this.textContent;
      this.disabled = true;
      this.innerHTML = '<div class="button-spinner"></div> Filtering...';
      
      try {
        const [leads, stats] = await Promise.all([ 
          listLeads(currentFilters()), 
          getStats(currentFilters()) 
        ]);
        
        // Store updated data globally
        window.CURRENT_LEADS_ORIGINAL = leads;
        window.CURRENT_STATS = stats;
        
        // Update conversion metrics in leads section
        const conversionMetrics = calculateConversionMetrics(leads);
        updateConversionMetrics(conversionMetrics);
        
        renderLeads(leads); 
        renderKPIs(stats);
        
        // Re-render current view if card view is active
        if ($('#cardViewContainer').style.display !== 'none') {
          renderLeadsCards(leads);
        }
        
        // Update analytics if on analytics tab
        if ($('#analyticsSection').style.display !== 'none') {
          const metrics = calculateAdvancedMetrics(leads, stats);
          updatePerformanceMetrics(metrics);
          drawMasterpieceCharts(leads, stats);
        }
        
        // Reset polling state to track new baseline after filter change
        resetPollingState();
        if (leads && Array.isArray(leads)) {
          leads.forEach(lead => {
            knownLeadIds.add(lead.id);
            leadStatusMap.set(lead.id, lead.status);
            leadAssignmentMap.set(lead.id, lead.assignedTo || '');
          });
        }
        
      } catch (e) { 
        console.error('Filter error:', e);
        showError('Failed to apply filters: ' + e.message); 
      } finally {
        // Restore button
        this.disabled = false;
        this.textContent = originalText;
      }
    });
    
    // Handle action buttons in table view
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
          await updateLead(token, id, action, currentUser ? currentUser.email : ''); 
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
    
    // Handle action buttons in card view (event delegation)
    $('#leadsCardGrid').addEventListener('click', async function(e){
      const btn = e.target.closest('button[data-action]');
      if (btn) {
        e.stopPropagation(); // Prevent card click
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        
        // Visual feedback
        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = '⏳';
        
        try {
          await updateLead(token, id, action, currentUser ? currentUser.email : '');
          showToast('Status updated to: ' + action);
          $('#applyFilters').click();
        } catch (e) {
          showError('Update failed: ' + e.message);
          btn.textContent = originalText;
          btn.disabled = false;
        }
      }
    });
    
    // Modal event listeners
    $('#closeModal').addEventListener('click', closeLeadModal);
    
    $('#leadModal').addEventListener('click', function(e) {
      // Close modal if clicking outside the content
      // Don't close if currently resizing or recently resized (prevents accidental close)
      if (e.target === this && !isResizingModal && !recentlyResizedModal) {
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
        await updateLead(token, leadId, newStatus, currentUser ? currentUser.email : '');
        
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
    
    // Set default date range to last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    $('#analyticsFrom').value = thirtyDaysAgo.toISOString().split('T')[0];
    $('#analyticsTo').value = today.toISOString().split('T')[0];
    
    // Update Charts button handler
    $('#updateCharts').addEventListener('click', async function() {
      const originalText = this.textContent;
      this.disabled = true;
      this.textContent = 'Analyzing...';
      
      try {
        const fromDate = $('#analyticsFrom').value;
        const toDate = $('#analyticsTo').value;
        
        // Fetch filtered leads
        const filteredLeads = await listLeads({ token, from: fromDate, to: toDate });
        const filteredStats = await getStats({ token, from: fromDate, to: toDate });
        
        // Update analytics with filtered data
        const metrics = calculateAdvancedMetrics(filteredLeads, filteredStats);
        updatePerformanceMetrics(metrics);
        drawMasterpieceCharts(filteredLeads, filteredStats);
        
        showToast(`Analytics updated for ${fromDate} to ${toDate}`);
      } catch (e) {
        showError('Failed to update analytics: ' + e.message);
      } finally {
        this.disabled = false;
        this.textContent = originalText;
      }
    });
    
    let shouldShowLeadsSection = false;
    try {
      const [leads, stats] = await Promise.all([listLeads({ token }), getStats({ token })]);
      
      // Load users for assignment dropdown
      await loadAllUsers();
      
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
      
      // Calculate and display conversion metrics (Joel's key metrics)
      const conversionMetrics = calculateConversionMetrics(leads);
      updateConversionMetrics(conversionMetrics);
      
      renderLeads(leads); 
      renderKPIs(stats); 
      
      // Initialize analytics masterpiece
      const metrics = calculateAdvancedMetrics(leads, stats);
      updatePerformanceMetrics(metrics);
      
      // Initialize known leads for polling
      if (leads && Array.isArray(leads)) {
        leads.forEach(lead => {
          knownLeadIds.add(lead.id);
          leadStatusMap.set(lead.id, lead.status);
        });
      }
      
      // Start real-time polling for updates
      startPolling();
      
      shouldShowLeadsSection = true;
    } catch (e) { 
      showError('Failed to load data. Check API_BASE in config.js'); 
    } finally {
      hideLoading();
      if (shouldShowLeadsSection) {
        showSection('leadsSection'); // Start with leads tab
      }
    }
  }

  // ====================
  // MODAL RESIZE FUNCTIONALITY
  // ====================
  
  function makeModalResizable(modalSelector, contentSelector) {
    const modal = $(modalSelector);
    const content = document.querySelector(contentSelector);
    if (!modal || !content) return;

    let isResizing = false;
    let currentEdge = null;
    let startX, startY, startWidth, startHeight, startLeft, startTop;

    // Detect which edge we're near
    function getEdge(e) {
      const rect = content.getBoundingClientRect();
      const threshold = 10; // pixels from edge

      const nearRight = Math.abs(e.clientX - rect.right) < threshold;
      const nearLeft = Math.abs(e.clientX - rect.left) < threshold;
      const nearBottom = Math.abs(e.clientY - rect.bottom) < threshold;
      const nearTop = Math.abs(e.clientY - rect.top) < threshold;

      if (nearRight && nearBottom) return 'se';
      if (nearLeft && nearBottom) return 'sw';
      if (nearRight && nearTop) return 'ne';
      if (nearLeft && nearTop) return 'nw';
      if (nearRight) return 'e';
      if (nearLeft) return 'w';
      if (nearBottom) return 's';
      if (nearTop) return 'n';
      return null;
    }

    // Update cursor based on edge
    content.addEventListener('mousemove', (e) => {
      if (isResizing) return;
      
      const edge = getEdge(e);
      if (edge) {
        const cursors = {
          'n': 'ns-resize', 's': 'ns-resize',
          'e': 'ew-resize', 'w': 'ew-resize',
          'ne': 'nesw-resize', 'sw': 'nesw-resize',
          'nw': 'nwse-resize', 'se': 'nwse-resize'
        };
        content.style.cursor = cursors[edge];
      } else {
        content.style.cursor = '';
      }
    });

    // Start resizing
    content.addEventListener('mousedown', (e) => {
      currentEdge = getEdge(e);
      if (!currentEdge) return;

      isResizing = true;
      isResizingModal = true; // Set global flag
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = content.getBoundingClientRect();
      startWidth = rect.width;
      startHeight = rect.height;
      startLeft = rect.left;
      startTop = rect.top;

      e.preventDefault();
    });

    // Handle resizing
    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newLeft = startLeft;
      let newTop = startTop;

      // Horizontal resize
      if (currentEdge.includes('e')) {
        newWidth = Math.max(400, startWidth + deltaX);
      } else if (currentEdge.includes('w')) {
        newWidth = Math.max(400, startWidth - deltaX);
        newLeft = startLeft + deltaX;
      }

      // Vertical resize
      if (currentEdge.includes('s')) {
        newHeight = Math.max(500, startHeight + deltaY);
      } else if (currentEdge.includes('n')) {
        newHeight = Math.max(500, startHeight - deltaY);
        newTop = startTop + deltaY;
      }

      content.style.width = newWidth + 'px';
      content.style.height = newHeight + 'px';
      content.style.maxWidth = 'none';
      content.style.maxHeight = 'none';
      
      // Update position for west/north edges
      if (currentEdge.includes('w') || currentEdge.includes('n')) {
        content.style.left = newLeft + 'px';
        content.style.top = newTop + 'px';
        content.style.transform = 'none';
      }
    });

    // Stop resizing
    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        isResizingModal = false; // Clear global flag
        currentEdge = null;
        
        // Set recently resized flag to prevent accidental modal close
        recentlyResizedModal = true;
        
        // Clear the flag after 300ms to allow intentional closes
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(() => {
          recentlyResizedModal = false;
        }, 300);
      }
    });
  }

  // Initialize resize functionality when modals are opened
  setTimeout(() => {
    makeModalResizable('#leadModal', '#leadModal .modal-content');
    makeModalResizable('#commentsModal', '.comments-modal-content');
  }, 100);
  
})();
