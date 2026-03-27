const CONFIG = {
  API_URL: window.RENTALPRO_API_URL || 'https://script.google.com/macros/s/AKfycbzb6zZjxzM6VAmAVAVrFeLRAKnYC1t4i5G6fxlyiYM_oW8VOpF3-Xhh0mHyZ8pa_Jps/exec'
};

const state = {
  tenants: [],
  payments: [],
  vendors: [],
  maintenance: [],
  charts: {}
};

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const el = {
  pageTitle: document.getElementById('pageTitle'),
  sidebar: document.getElementById('sidebar'),
  menuBtn: document.getElementById('menuBtn'),
  backdrop: document.getElementById('modalBackdrop'),
  kpiGrid: document.getElementById('kpiGrid'),
  reportGrid: document.getElementById('reportGrid')
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  bindNavigation();
  bindModalControls();
  bindForms();
  bindUtilities();
  await refreshAll();
}

function bindNavigation() {
  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-link').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.section').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      const section = btn.dataset.section;
      document.getElementById(`${section}Section`).classList.add('active');
      el.pageTitle.textContent = btn.textContent;
      el.sidebar.classList.remove('show');
    });
  });
  el.menuBtn.addEventListener('click', () => el.sidebar.classList.toggle('show'));
}

function bindModalControls() {
  document.querySelectorAll('[data-open-modal]').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.openModal));
  });
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });
  el.backdrop.addEventListener('click', closeAllModals);
  document.getElementById('quickAddBtn').addEventListener('click', () => openModal('tenantModal'));
}

function bindUtilities() {
  document.getElementById('refreshBtn').addEventListener('click', refreshAll);
  document.getElementById('tenantSearch').addEventListener('input', renderTenantsTable);
  document.getElementById('vendorSearch').addEventListener('input', renderVendorsTable);
  document.getElementById('paymentMonthFilter').addEventListener('change', renderPaymentsTable);
  document.getElementById('maintenanceStatusFilter').addEventListener('change', renderMaintenanceTable);

  document.getElementById('exportCSVBtn').addEventListener('click', exportCSV);
  document.getElementById('exportPDFBtn').addEventListener('click', exportPDF);

  const paymentTenant = document.getElementById('paymentTenantSelect');
  paymentTenant.addEventListener('change', hydratePaymentTenant);
  document.getElementById('paymentAmountPaid').addEventListener('input', computeLateFee);
  document.getElementById('paymentRentDue').addEventListener('input', computeLateFee);

  const maintenanceTenant = document.getElementById('maintenanceTenantSelect');
  maintenanceTenant.addEventListener('change', hydrateMaintenanceTenant);
}

function bindForms() {
  document.getElementById('tenantForm').addEventListener('submit', async e => {
    e.preventDefault();
    const payload = formDataToObject(e.target);
    if (payload.tenantId) {
      await api('updateTenant', payload);
    } else {
      await api('addTenant', payload);
    }
    closeAllModals();
    await refreshAll();
  });

  document.getElementById('paymentForm').addEventListener('submit', async e => {
    e.preventDefault();
    const payload = formDataToObject(e.target);
    payload.rentDue = Number(payload.rentDue);
    payload.amountPaid = Number(payload.amountPaid);
    payload.lateFee = Number(payload.lateFee || 0);
    if (payload.paymentId) {
      await api('updatePayment', payload);
    } else {
      await api('addPayment', payload);
    }
    closeAllModals();
    await refreshAll();
  });

  document.getElementById('vendorForm').addEventListener('submit', async e => {
    e.preventDefault();
    const payload = formDataToObject(e.target);
    if (payload.vendorId) {
      await api('updateVendor', payload);
    } else {
      await api('addVendor', payload);
    }
    closeAllModals();
    await refreshAll();
  });

  document.getElementById('maintenanceForm').addEventListener('submit', async e => {
    e.preventDefault();
    const payload = formDataToObject(e.target);
    payload.cost = Number(payload.cost || 0);
    if (payload.maintenanceId) {
      await api('updateMaintenance', payload);
    } else {
      await api('addMaintenance', payload);
    }
    closeAllModals();
    await refreshAll();
  });
}

async function refreshAll() {
  const [tenants, payments, vendors, maintenance] = await Promise.all([
    api('getTenants'),
    api('getPayments'),
    api('getVendors'),
    api('getMaintenance')
  ]);
  state.tenants = tenants || [];
  state.payments = payments || [];
  state.vendors = vendors || [];
  state.maintenance = maintenance || [];

  seedDropdowns();
  renderTenantsTable();
  renderPaymentsTable();
  renderVendorsTable();
  renderMaintenanceTable();
  renderDashboard();
  renderReports();
}

function renderDashboard() {
  const occupied = new Set(state.tenants.filter(t => t.paymentStatus !== 'Vacant').map(t => `${t.property}-${t.unit}`)).size;
  const monthlyRentExpected = state.tenants.reduce((acc, t) => acc + Number(t.rent || 0), 0);
  const totalCollected = state.payments.reduce((acc, p) => acc + Number(p.amountPaid || 0), 0);
  const outstanding = state.payments.reduce((acc, p) => acc + Number(p.balance || 0), 0);
  const openMaint = state.maintenance.filter(m => m.status !== 'Completed').length;

  const cards = [
    ['Total Units', state.tenants.length],
    ['Occupied Units', occupied],
    ['Monthly Rent Expected', fmt.format(monthlyRentExpected)],
    ['Total Collected', fmt.format(totalCollected)],
    ['Outstanding Balance', fmt.format(outstanding)],
    ['Open Maintenance Requests', openMaint]
  ];

  el.kpiGrid.innerHTML = cards.map(([label, value]) => `
    <article class="card kpi-card">
      <p>${label}</p>
      <h4>${value}</h4>
    </article>
  `).join('');

  renderCharts();
}

function renderCharts() {
  const monthlyMap = {};
  state.payments.forEach(p => {
    monthlyMap[p.monthTag] = (monthlyMap[p.monthTag] || 0) + Number(p.amountPaid || 0);
  });
  const months = Object.keys(monthlyMap).sort();

  const propMap = {};
  state.payments.forEach(p => {
    propMap[p.property] = (propMap[p.property] || 0) + Number(p.amountPaid || 0);
  });

  const paid = state.payments.filter(p => p.paymentStatus === 'Paid').length;
  const unpaid = state.payments.length - paid;

  destroyCharts();
  state.charts.line = new Chart(document.getElementById('incomeLineChart'), {
    type: 'line',
    data: { labels: months, datasets: [{ label: 'Income', data: months.map(m => monthlyMap[m]), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.2)', fill: true, tension: 0.25 }] },
    options: { responsive: true, maintainAspectRatio: false }
  });

  state.charts.bar = new Chart(document.getElementById('incomeBarChart'), {
    type: 'bar',
    data: { labels: Object.keys(propMap), datasets: [{ label: 'Income', data: Object.values(propMap), backgroundColor: '#38bdf8' }] },
    options: { responsive: true, maintainAspectRatio: false }
  });

  state.charts.pie = new Chart(document.getElementById('paidPieChart'), {
    type: 'pie',
    data: { labels: ['Paid', 'Unpaid'], datasets: [{ data: [paid, unpaid], backgroundColor: ['#16a34a', '#dc2626'] }] },
    options: { responsive: true, maintainAspectRatio: false }
  });
}


function destroyCharts() {
  Object.values(state.charts).forEach(chart => chart && chart.destroy && chart.destroy());
  state.charts = {};
}

function renderTenantsTable() {
  const q = document.getElementById('tenantSearch').value.toLowerCase();
  const rows = state.tenants.filter(t => `${t.tenantId} ${t.fullName}`.toLowerCase().includes(q));
  document.getElementById('tenantsTable').innerHTML = tableHtml([
    'Tenant ID', 'Full Name', 'Phone', 'Email', 'Property', 'Unit', 'Lease Dates', 'Rent', 'Deposit', 'Payment Status', 'Notes', 'Actions'
  ], rows.map(t => [
    t.tenantId, t.fullName, t.phone, t.email, t.property, t.unit, `${t.leaseStart} → ${t.leaseEnd}`,
    fmt.format(Number(t.rent || 0)), fmt.format(Number(t.deposit || 0)), statusBadge(t.paymentStatus), t.notes || '',
    actionButtons('tenant', t.tenantId)
  ]));
}

function renderPaymentsTable() {
  const month = document.getElementById('paymentMonthFilter').value;
  const rows = state.payments.filter(p => !month || p.monthTag === month);
  document.getElementById('paymentsTable').innerHTML = tableHtml([
    'Payment ID', 'Tenant ID', 'Name', 'Property', 'Unit', 'Month', 'Due Date', 'Rent Due', 'Paid', 'Late Fee', 'Balance', 'Status', 'Actions'
  ], rows.map(p => [
    p.paymentId, p.tenantId, p.tenantName, p.property, p.unit, p.monthTag, p.dueDate,
    fmt.format(Number(p.rentDue || 0)), fmt.format(Number(p.amountPaid || 0)), fmt.format(Number(p.lateFee || 0)),
    fmt.format(Number(p.balance || 0)), statusBadge(p.paymentStatus), actionButtons('payment', p.paymentId)
  ]));
}

function renderVendorsTable() {
  const q = document.getElementById('vendorSearch').value.toLowerCase();
  const rows = state.vendors.filter(v => `${v.vendorId} ${v.vendorName}`.toLowerCase().includes(q));
  document.getElementById('vendorsTable').innerHTML = tableHtml([
    'Vendor ID', 'Vendor Name', 'Phone', 'Email', 'Service Type', 'Availability', 'Notes', 'Actions'
  ], rows.map(v => [
    v.vendorId, v.vendorName, v.phone, v.email, v.serviceType, statusBadge(v.availability), v.notes || '', actionButtons('vendor', v.vendorId)
  ]));
}

function renderMaintenanceTable() {
  const filter = document.getElementById('maintenanceStatusFilter').value;
  const rows = state.maintenance.filter(m => filter === 'ALL' || m.status === filter);
  document.getElementById('maintenanceTable').innerHTML = tableHtml([
    'Request ID', 'Tenant', 'Property', 'Unit', 'Vendor', 'Issue', 'Status', 'Cost', 'Requested', 'Completed', 'Actions'
  ], rows.map(m => [
    m.maintenanceId, m.tenantName, m.property, m.unit, m.vendorName, m.issue, statusBadge(m.status),
    fmt.format(Number(m.cost || 0)), m.requestedDate, m.completedDate || '-', actionButtons('maintenance', m.maintenanceId)
  ]));
}

function renderReports() {
  const month = new Date().toISOString().slice(0, 7);
  const monthly = state.payments.filter(p => p.monthTag === month);
  const defaulters = state.payments.filter(p => Number(p.balance) > 0);
  const totalMaintCost = state.maintenance.reduce((acc, m) => acc + Number(m.cost || 0), 0);

  el.reportGrid.innerHTML = `
    <article class="card report-card">
      <h4>Monthly Rent Report (${month})</h4>
      <ul class="report-list">
        <li>Total Due: ${fmt.format(monthly.reduce((a, p) => a + Number(p.rentDue || 0), 0))}</li>
        <li>Total Collected: ${fmt.format(monthly.reduce((a, p) => a + Number(p.amountPaid || 0), 0))}</li>
        <li>Outstanding: ${fmt.format(monthly.reduce((a, p) => a + Number(p.balance || 0), 0))}</li>
      </ul>
    </article>
    <article class="card report-card">
      <h4>Defaulters List</h4>
      <ul class="report-list">
        ${(defaulters.slice(0, 8).map(d => `<li>${d.tenantName} (${fmt.format(Number(d.balance || 0))})</li>`).join('')) || '<li>No defaulters</li>'}
      </ul>
    </article>
    <article class="card report-card">
      <h4>Maintenance Cost Summary</h4>
      <ul class="report-list">
        <li>Total Tickets: ${state.maintenance.length}</li>
        <li>Completed: ${state.maintenance.filter(m => m.status === 'Completed').length}</li>
        <li>Total Cost: ${fmt.format(totalMaintCost)}</li>
      </ul>
    </article>
  `;
}

function seedDropdowns() {
  const tenantOpts = ['<option value="">Select tenant</option>'].concat(state.tenants.map(t => `<option value="${t.tenantId}">${t.tenantId} - ${t.fullName}</option>`));
  document.getElementById('paymentTenantSelect').innerHTML = tenantOpts.join('');
  document.getElementById('maintenanceTenantSelect').innerHTML = tenantOpts.join('');

  const vendorOpts = ['<option value="">Select vendor</option>'].concat(state.vendors.map(v => `<option value="${v.vendorId}">${v.vendorId} - ${v.vendorName}</option>`));
  document.getElementById('maintenanceVendorSelect').innerHTML = vendorOpts.join('');
}

function hydratePaymentTenant() {
  const tenant = state.tenants.find(t => t.tenantId === document.getElementById('paymentTenantSelect').value);
  document.getElementById('paymentProperty').value = tenant?.property || '';
  document.getElementById('paymentUnit').value = tenant?.unit || '';
  document.getElementById('paymentRentDue').value = tenant?.rent || 0;
  computeLateFee();
}

function hydrateMaintenanceTenant() {
  const tenant = state.tenants.find(t => t.tenantId === document.getElementById('maintenanceTenantSelect').value);
  document.getElementById('maintenanceProperty').value = tenant?.property || '';
  document.getElementById('maintenanceUnit').value = tenant?.unit || '';
}

function computeLateFee() {
  const form = document.getElementById('paymentForm');
  const dueDate = new Date(form.dueDate.value || Date.now());
  const now = new Date();
  const rentDue = Number(form.rentDue.value || 0);
  const amountPaid = Number(form.amountPaid.value || 0);
  const lateFee = now > dueDate && amountPaid < rentDue ? Number((rentDue * 0.05).toFixed(2)) : 0;
  document.getElementById('paymentLateFee').value = lateFee;
}

function tableHtml(headers, rows) {
  return `
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  `;
}

function actionButtons(type, id) {
  return `<div class="action-btns"><button class="btn btn-secondary" onclick="editRecord('${type}','${id}')">Edit</button><button class="btn btn-secondary" onclick="deleteRecord('${type}','${id}')">Delete</button></div>`;
}

function statusBadge(status = '') {
  return `<span class="status-pill status-${status.replace(/\s/g, '\\ ')}">${status}</span>`;
}

window.editRecord = function (type, id) {
  const map = {
    tenant: { list: state.tenants, key: 'tenantId', modal: 'tenantModal', form: 'tenantForm' },
    payment: { list: state.payments, key: 'paymentId', modal: 'paymentModal', form: 'paymentForm' },
    vendor: { list: state.vendors, key: 'vendorId', modal: 'vendorModal', form: 'vendorForm' },
    maintenance: { list: state.maintenance, key: 'maintenanceId', modal: 'maintenanceModal', form: 'maintenanceForm' }
  }[type];
  const item = map.list.find(x => x[map.key] === id);
  const form = document.getElementById(map.form);
  Object.entries(item).forEach(([k, v]) => {
    if (form.elements[k]) form.elements[k].value = v || '';
  });
  if (type === 'payment') hydratePaymentTenant();
  if (type === 'maintenance') hydrateMaintenanceTenant();
  openModal(map.modal);
};

window.deleteRecord = async function (type, id) {
  if (!confirm('Delete this record?')) return;
  const actionMap = {
    tenant: 'deleteTenant',
    payment: 'deletePayment',
    vendor: 'deleteVendor',
    maintenance: 'deleteMaintenance'
  };
  await api(actionMap[type], { id });
  await refreshAll();
};

function openModal(id) {
  document.getElementById(id).classList.add('show');
  el.backdrop.classList.add('show');
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
  el.backdrop.classList.remove('show');
  document.querySelectorAll('form').forEach(f => f.reset());
}

function formDataToObject(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  Object.keys(data).forEach(k => {
    if (typeof data[k] === 'string') data[k] = data[k].trim();
  });
  return data;
}

async function api(action, payload = {}) {
  if (!CONFIG.API_URL) {
    throw new Error('API URL missing. Set window.RENTALPRO_API_URL before loading script.js.');
  }
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload })
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'API request failed');
  return json.data;
}

function exportCSV() {
  const rows = [['Payment ID', 'Tenant', 'Month', 'Rent Due', 'Paid', 'Balance', 'Status']].concat(
    state.payments.map(p => [p.paymentId, p.tenantName, p.monthTag, p.rentDue, p.amountPaid, p.balance, p.paymentStatus])
  );
  const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rentalpro-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('RentalPro Summary Report', 14, 18);
  doc.setFontSize(11);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
  doc.text(`Total Tenants: ${state.tenants.length}`, 14, 36);
  doc.text(`Total Payments: ${state.payments.length}`, 14, 44);
  doc.text(`Outstanding Balance: ${fmt.format(state.payments.reduce((a, p) => a + Number(p.balance || 0), 0))}`, 14, 52);
  doc.text(`Open Maintenance: ${state.maintenance.filter(m => m.status !== 'Completed').length}`, 14, 60);
  doc.save(`rentalpro-summary-${new Date().toISOString().slice(0, 10)}.pdf`);
}
