/* Export Utilities for Lead Data */
/* Supports CSV and XLSX export with filtered data */

(function() {
  // Helper function to format date for filename
  function getDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  // Helper function to sanitize cell data for CSV
  function sanitizeCSVCell(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  // Helper function to create download blob
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Export leads to CSV format
  window.exportToCSV = function(leads, companyName = 'Leads') {
    if (!leads || leads.length === 0) {
      alert('No data to export');
      return;
    }

    // Define headers
    const headers = [
      'Lead ID',
      'Created Date',
      'Customer Name',
      'Phone',
      'Email',
      'Address Street',
      'City',
      'State',
      'Postal Code',
      'Reason for Call',
      'Reason Custom',
      'Scheduling Told',
      'Product/Service',
      'Square Footage',
      'Initial Price',
      'Recurring Price',
      'Lead Value',
      'Status',
      'Notes'
    ];

    // Build CSV rows
    const rows = leads.map(lead => [
      lead.id || '',
      lead.createdAt || '',
      lead.customerName || '',
      lead.customerPhone || '',
      lead.customerEmail || '',
      lead.addressStreet || lead.street || '',
      lead.city || '',
      lead.state || '',
      lead.postal || lead.addressPostal || '',
      lead.reason || '',
      lead.reasonCustom || '',
      lead.schedulingTold || '',
      lead.product || '',
      lead.squareFootage || '',
      lead.initialPrice || 0,
      lead.recurringPrice || 0,
      lead.leadValue || 0,
      lead.status || '',
      lead.notes || ''
    ]);

    // Build CSV content
    const csvContent = [
      headers.map(h => sanitizeCSVCell(h)).join(','),
      ...rows.map(row => row.map(cell => sanitizeCSVCell(cell)).join(','))
    ].join('\n');

    // Create and download blob
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `${companyName.replace(/\s+/g, '_')}_Leads_${getDateString()}.csv`;
    downloadBlob(blob, filename);

    console.log(`✅ Exported ${leads.length} leads to CSV: ${filename}`);
  };

  // Export leads to XLSX format using SheetJS
  window.exportToXLSX = function(leads, companyName = 'Leads') {
    if (!leads || leads.length === 0) {
      alert('No data to export');
      return;
    }

    // Check if SheetJS is loaded
    if (typeof XLSX === 'undefined') {
      alert('XLSX library not loaded. Please refresh the page and try again.');
      console.error('SheetJS (XLSX) library not found. Make sure it\'s loaded from CDN.');
      return;
    }

    try {
      // Transform leads data into clean format for Excel
      const worksheetData = leads.map(lead => ({
        'Lead ID': lead.id || '',
        'Created Date': lead.createdAt || '',
        'Customer Name': lead.customerName || '',
        'Phone': lead.customerPhone || '',
        'Email': lead.customerEmail || '',
        'Address Street': lead.addressStreet || lead.street || '',
        'City': lead.city || '',
        'State': lead.state || '',
        'Postal Code': lead.postal || lead.addressPostal || '',
        'Reason for Call': lead.reason || '',
        'Reason Custom': lead.reasonCustom || '',
        'Scheduling Told': lead.schedulingTold || '',
        'Product/Service': lead.product || '',
        'Square Footage': lead.squareFootage || '',
        'Initial Price': lead.initialPrice || 0,
        'Recurring Price': lead.recurringPrice || 0,
        'Lead Value': lead.leadValue || 0,
        'Status': lead.status || '',
        'Notes': lead.notes || ''
      }));

      // Create worksheet from JSON
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);

      // Set column widths for better readability
      const columnWidths = [
        { wch: 12 },  // Lead ID
        { wch: 18 },  // Created Date
        { wch: 20 },  // Customer Name
        { wch: 15 },  // Phone
        { wch: 25 },  // Email
        { wch: 30 },  // Address Street
        { wch: 15 },  // City
        { wch: 8 },   // State
        { wch: 10 },  // Postal Code
        { wch: 25 },  // Reason for Call
        { wch: 30 },  // Reason Custom
        { wch: 25 },  // Scheduling Told
        { wch: 30 },  // Product/Service
        { wch: 12 },  // Square Footage
        { wch: 12 },  // Initial Price
        { wch: 14 },  // Recurring Price
        { wch: 12 },  // Lead Value
        { wch: 12 },  // Status
        { wch: 40 }   // Notes
      ];
      worksheet['!cols'] = columnWidths;

      // Create workbook and add worksheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

      // Generate filename
      const filename = `${companyName.replace(/\s+/g, '_')}_Leads_${getDateString()}.xlsx`;

      // Write and download file
      XLSX.writeFile(workbook, filename);

      console.log(`✅ Exported ${leads.length} leads to XLSX: ${filename}`);
    } catch (error) {
      console.error('Error exporting to XLSX:', error);
      alert('Error exporting to Excel. Please try CSV export instead.');
    }
  };

  // Export analytics summary as CSV
  window.exportAnalyticsCSV = function(metrics, companyName = 'Analytics') {
    if (!metrics) {
      alert('No analytics data to export');
      return;
    }

    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Calls', metrics.totalCalls || 0],
      ['Appointments (Accepted + Completed)', metrics.appointments || 0],
      ['Sales (Completed)', metrics.sales || 0],
      ['Call → Appointment Conversion %', (metrics.callToAppt || 0).toFixed(2) + '%'],
      ['Appointment → Sale Conversion %', (metrics.apptToSale || 0).toFixed(2) + '%'],
      ['Revenue from Converted Calls', '$' + (metrics.convertedRevenue || 0).toFixed(2)],
      ['Average Deal Size', metrics.avgDealSize ? '$' + metrics.avgDealSize.toFixed(2) : '$0.00']
    ];

    const csvContent = [
      headers.map(h => sanitizeCSVCell(h)).join(','),
      ...rows.map(row => row.map(cell => sanitizeCSVCell(cell)).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `${companyName.replace(/\s+/g, '_')}_Analytics_${getDateString()}.csv`;
    downloadBlob(blob, filename);

    console.log(`✅ Exported analytics summary to CSV: ${filename}`);
  };

  console.log('📦 Export utilities loaded (CSV & XLSX support)');
})();

