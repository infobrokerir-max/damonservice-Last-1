/**
 * DAMON SERVICE - ROBUST BACKEND v7.4
 * Updated: projectsDetail_ now handles manual names for assigned_sales_manager_id
 */

const SPREADSHEET_ID = '1r18JUVxvbjZtVyx8x2l00p2Na0xWe0CejDHZYK-pgcg';

function doGet(e) { return respond_(handle_('GET', e)); }
function doPost(e) { return respond_(handle_('POST', e)); }

function handle_(method, e) {
  try {
    const req = parseRequest_(method, e);
    const path = req.path;

    if (!path) return err_('NO_PATH', 'Path required', 400);

    // --- Public ---
    if (path === '/health') return ok_({ status: 'online', sheet_id: SPREADSHEET_ID, time: new Date().toISOString() });
    if (path === '/auth/login') return authLogin_(req.body, req);
    if (path === '/auth/logout') return authLogout_(req.body);
    if (path === '/auth/admin_token') return authAdminToken_(req.params, req);

    // --- Protected ---
    const session = requireSession_(method, req.params, req.body);
    const user = session.user;

    // Admin Routes
    if (path.startsWith('/admin/')) {
       requireRole_(user, ['admin', 'sales_manager']);
       
       if (path === '/admin/users/list') return ok_(readAll_('users'));
       if (path === '/admin/users/create') return adminUserCreate_(user, req.body, req);
       if (path === '/admin/users/delete') return adminUserDelete_(user, req.body, req);
       
       if (path === '/admin/categories/list') return ok_(readAll_('categories'));
       if (path === '/admin/categories/create') return adminCategoryCreate_(user, req.body, req);
       if (path === '/admin/categories/update') return adminCategoryUpdate_(user, req.body, req);
       if (path === '/admin/categories/delete') return adminCategoryDelete_(user, req.body, req);
       
       if (path === '/admin/devices/list') return ok_(readAll_('devices'));
       if (path === '/admin/devices/create') return adminDeviceCreate_(user, req.body, req);
       if (path === '/admin/devices/update') return adminDeviceUpdate_(user, req.body, req);
       if (path === '/admin/devices/delete') return adminDeviceDelete_(user, req.body, req);
       
       if (path === '/admin/settings/get') return ok_(getActiveSettings_());
       if (path === '/admin/settings/update') return adminSettingsUpdate_(user, req.body, req);
       
       if (path === '/admin/audit/list') {
          const logs = readAll_('audit_logs');
          const users = readAll_('users');
          return ok_(logs.reverse().slice(0, 100).map(log => {
             const actor = users.find(u => String(u.id) === String(log.actor_user_id));
             return { ...log, actor_name: actor ? actor.full_name : 'Unknown' };
          }));
       }
    }

    // General (Authenticated)
    if (path === '/categories/list') return ok_(readAll_('categories').filter(c => isTrue_(c.is_active)));
    if (path === '/devices/search') return devicesSearch_(user, req.params);
    
    // UPDATED: Return username as well
    if (path === '/users/staff') {
      return ok_(readAll_('users')
        .filter(u => isTrue_(u.is_active))
        .map(u => ({ 
          id: u.id, 
          full_name: u.full_name, 
          username: u.username, 
          role: u.role 
        }))
      );
    }

    // Projects
    if (path === '/projects/list') return projectsList_(user, req.params);
    if (path === '/projects/detail') return projectsDetail_(user, req.params);
    if (path === '/projects/create') return projectsCreate_(user, req.body, req);
    if (path === '/projects/approve') return projectsApprove_(user, req.body, req);
    if (path === '/projects/reject') return projectsReject_(user, req.body, req);
    
    // Comments & Inquiries
    if (path === '/comments/add') return commentsAdd_(user, req.body, req);
    if (path === '/inquiries/quote') return inquiriesQuote_(user, req.body, req);

    return err_('NOT_FOUND', 'Unknown path: ' + path, 404);

  } catch (ex) {
    return err_('SERVER_ERROR', ex.toString(), 500);
  }
}

/* =======================
   CORE UTILITIES
======================= */
function parseRequest_(method, e) {
  const params = (e && e.parameter) ? e.parameter : {};
  let body = {};
  if (method === 'POST') {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '';
    if (raw) { try { body = JSON.parse(raw); } catch (_) {} }
  } else { body = params; }
  const path = (params.path || body.path || '').trim();
  const user_agent = (body.user_agent || params.user_agent || 'Unknown');
  return { path, params, body, user_agent };
}

function respond_(payload) { 
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); 
}
function ok_(data) { return { ok: true, data }; }
function err_(code, msg, status) { return { ok: false, error_code: code, message: msg, status: status || 400 }; }

function ss_() { return SpreadsheetApp.openById(SPREADSHEET_ID); }
function sh_(name) { 
  const s = ss_().getSheetByName(name); 
  if (!s) throw new Error('Sheet not found: ' + name); 
  return s; 
}

function normalize_(str) { return String(str || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase(); }

function sha256Hex_(input) {
  const signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  return signature.map(b => ("0" + ((b < 0 ? 256 + b : b).toString(16))).slice(-2)).join("");
}

function logAudit_(user, action, meta, req) {
  try {
    const id = Utilities.getUuid();
    appendCanon_('audit_logs', {
      id: id,
      actor_user_id: user.id,
      action_type: action,
      project_id: meta.project_id || '',
      project_inquiry_id: meta.project_inquiry_id || '',
      meta_json: JSON.stringify(meta),
      ip_address: '0.0.0.0',
      user_agent: req ? req.user_agent : '',
      created_at: new Date().toISOString()
    });
  } catch (e) {}
}

/* =======================
   DATABASE ENGINE
======================= */
function readAll_(sheetName) {
  const sheet = sh_(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(String);
  const cleanHeaders = headers.map(normalize_);
  return data.slice(1).map(row => {
    const obj = {};
    row.forEach((val, i) => {
      const key = cleanHeaders[i];
      if (key) obj[key] = val;
      obj[headers[i]] = val;
    });
    return obj;
  });
}

function appendCanon_(sheetName, obj) {
  const sheet = sh_(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h => {
    const normH = normalize_(h);
    if (obj[h] !== undefined) return obj[h];
    const key = Object.keys(obj).find(k => normalize_(k) === normH);
    return (key && obj[key] !== undefined) ? obj[key] : '';
  });
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { sheet.appendRow(row); } finally { lock.releaseLock(); }
}

function updateById_(sheetName, id, patch) {
  const sheet = sh_(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(String);
  const cleanHeaders = headers.map(normalize_);
  const idIdx = cleanHeaders.indexOf('id');
  if (idIdx < 0) throw new Error('No ID column in ' + sheetName);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    for (let r = 1; r < data.length; r++) {
      if (String(data[r][idIdx]) === String(id)) {
        Object.keys(patch).forEach(key => {
          const normKey = normalize_(key);
          const colIdx = cleanHeaders.indexOf(normKey);
          if (colIdx > -1) sheet.getRange(r + 1, colIdx + 1).setValue(patch[key]);
        });
        return true;
      }
    }
  } finally { lock.releaseLock(); }
  return false;
}

function deleteById_(sheetName, id) {
  const sheet = sh_(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(String);
  const cleanHeaders = headers.map(normalize_);
  const idIdx = cleanHeaders.indexOf('id');
  if (idIdx < 0) return false;

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    for (let r = 1; r < data.length; r++) {
      if (String(data[r][idIdx]) === String(id)) {
        sheet.deleteRow(r + 1);
        return true;
      }
    }
  } finally { lock.releaseLock(); }
  return false;
}

/* =======================
   AUTH & USER SYNC
======================= */
function authAdminToken_(params, req) {
  if (params.key !== 'DS_BOLT_2025__9f8c7b6a5d4e3c2b1a__XyZ') return err_('AUTH', 'Invalid Key', 403);
  const users = readAll_('users');
  let admin = users.find(u => u.username === 'admin');
  if (!admin) {
    const salt = Utilities.getUuid().substring(0, 16);
    const hash = sha256Hex_(salt + 'sasan123');
    admin = { id: Utilities.getUuid(), full_name: 'Admin', username: 'admin', password_salt: salt, password_hash_sha256: hash, role: 'admin', is_active: true, created_at: new Date().toISOString() };
    appendCanon_('users', admin);
  }
  const token = Utilities.getUuid();
  appendCanon_('sessions', { 
    token, 
    user_id: admin.id, 
    is_active: true, 
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    ip_address: '0.0.0.0',
    user_agent: req.user_agent,
    created_at: new Date().toISOString() 
  });
  return ok_({ token, user: admin });
}

function authLogin_(body, req) {
  const users = readAll_('users');
  const user = users.find(u => u.username === body.username && isTrue_(u.is_active));
  if (!user) return err_('AUTH', 'Invalid credentials', 401);
  const salt = user.password_salt || '';
  const storedHash = user.password_hash_sha256 || '';
  const inputHash = sha256Hex_(salt + body.password);
  if ((!storedHash || inputHash !== storedHash) && user.password !== body.password) return err_('AUTH', 'Invalid credentials', 401);
  
  const token = Utilities.getUuid();
  appendCanon_('sessions', { 
    token, 
    user_id: user.id, 
    is_active: true, 
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    ip_address: '0.0.0.0',
    user_agent: req.user_agent,
    created_at: new Date().toISOString() 
  });
  logAudit_(user, 'LOGIN', { success: true }, req);
  return ok_({ token, user });
}

function requireSession_(method, params, body) {
  const token = params.token || (body && body.token);
  if (!token) throw new Error('Token missing');
  const sessions = readAll_('sessions');
  const s = sessions.find(x => x.token === token && isTrue_(x.is_active));
  if (!s) throw new Error('Session invalid/expired');
  if (s.expires_at && new Date(s.expires_at) < new Date()) throw new Error('SESSION_EXPIRED');
  const users = readAll_('users');
  const u = users.find(x => String(x.id) === String(s.user_id));
  if (!u) throw new Error('User not found');
  return { token, user: u };
}

function authLogout_(body) {
  const sheet = sh_('sessions');
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(normalize_);
  const tIdx = headers.indexOf('token');
  const aIdx = headers.indexOf('is_active');
  if (tIdx > -1 && aIdx > -1) {
    for (let r=1; r<data.length; r++) {
      if (data[r][tIdx] === body.token) { sheet.getRange(r+1, aIdx+1).setValue(false); break; }
    }
  }
  return ok_({ logged_out: true });
}

function requireRole_(u, roles) { if (!roles.includes(u.role)) throw new Error('Permission denied'); }
function isTrue_(v) { return String(v).toLowerCase() === 'true' || v === true; }

/* =======================
   BUSINESS LOGIC
======================= */
function adminUserCreate_(actor, body, req) {
  if (!body.username || !body.password) return err_('VALIDATION', 'Username/Password required', 400);
  const salt = Utilities.getUuid().substring(0, 16);
  const hash = sha256Hex_(salt + body.password);
  const id = Utilities.getUuid();
  appendCanon_('users', { id, full_name: body.full_name, username: body.username, password_salt: salt, password_hash_sha256: hash, role: body.role || 'employee', is_active: true, created_at: new Date().toISOString() });
  logAudit_(actor, 'CREATE_USER', { target_user: body.username }, req);
  return ok_({ id });
}
function adminUserDelete_(actor, body, req) { 
  deleteById_('users', body.id); 
  logAudit_(actor, 'DELETE_USER', { target_id: body.id }, req);
  return ok_({ deleted: true }); 
}

function adminCategoryCreate_(actor, body, req) { 
  const id = Utilities.getUuid(); 
  appendCanon_('categories', { ...body, id, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }); 
  logAudit_(actor, 'CREATE_CATEGORY', { name: body.category_name }, req);
  return ok_({ id }); 
}
function adminCategoryUpdate_(actor, body, req) { 
  updateById_('categories', body.id, { ...body, updated_at: new Date().toISOString() }); 
  logAudit_(actor, 'UPDATE_CATEGORY', { id: body.id }, req);
  return ok_({ updated: true }); 
}
function adminCategoryDelete_(actor, body, req) { 
  deleteById_('categories', body.id); 
  logAudit_(actor, 'DELETE_CATEGORY', { id: body.id }, req);
  return ok_({ deleted: true }); 
}

function adminDeviceCreate_(actor, body, req) { 
  const id = Utilities.getUuid(); 
  appendCanon_('devices', { ...body, id, is_active: true, created_at: new Date().toISOString() }); 
  logAudit_(actor, 'CREATE_DEVICE', { model: body.model_name }, req);
  return ok_({ id }); 
}
function adminDeviceUpdate_(actor, body, req) { 
  updateById_('devices', body.id, body); 
  logAudit_(actor, 'UPDATE_DEVICE', { id: body.id }, req);
  return ok_({ updated: true }); 
}
function adminDeviceDelete_(actor, body, req) { 
  deleteById_('devices', body.id); 
  logAudit_(actor, 'DELETE_DEVICE', { id: body.id }, req);
  return ok_({ deleted: true }); 
}

function getActiveSettings_() {
  const all = readAll_('settings');
  return all.length ? all[all.length - 1] : {};
}
function adminSettingsUpdate_(actor, body, req) { 
  appendCanon_('settings', { ...body, created_at: new Date().toISOString() }); 
  logAudit_(actor, 'UPDATE_SETTINGS', {}, req);
  return ok_({ updated: true }); 
}

function projectsList_(user, params) {
  let rows = readAll_('projects');
  // Employees see only their own projects OR projects assigned to them (by name or ID)
  if (user.role === 'employee') {
    rows = rows.filter(p => 
      String(p.created_by_user_id) === String(user.id) || 
      String(p.assigned_sales_manager_id) === String(user.id) ||
      String(p.assigned_sales_manager_id).toLowerCase().includes(user.full_name.toLowerCase())
    );
  }
  return ok_(rows);
}
function projectsCreate_(user, body, req) {
  const id = Utilities.getUuid(); const now = new Date().toISOString();
  
  const project = {
    id: id,
    created_by_user_id: user.id,
    assigned_sales_manager_id: body.assigned_sales_manager_id || '',
    project_name: body.project_name,
    employer_name: body.employer_name,
    project_type: body.project_type,
    address_text: body.address_text || '',
    tehran_lat: body.tehran_lat || '',
    tehran_lng: body.tehran_lng || '',
    additional_info: body.additional_info || '',
    status: 'pending_approval',
    created_at: now,
    updated_at: now
  };
  
  appendCanon_('projects', project);
  
  // Initial Status History
  appendCanon_('project_status_history', { 
    id: Utilities.getUuid(), 
    project_id: id, 
    changed_by_user_id: user.id, 
    from_status: 'draft', 
    to_status: 'pending_approval', 
    note: 'Project Created', 
    created_at: now 
  });
  
  logAudit_(user, 'CREATE_PROJECT', { project_id: id, name: body.project_name }, req);
  return ok_({ id });
}

function projectsDetail_(user, params) {
  const pid = params.id;
  const p = readAll_('projects').find(x => String(x.id) === String(pid));
  if (!p) throw new Error('Project not found');
  
  // Permission Check
  if (user.role === 'employee' && 
      String(p.created_by_user_id) !== String(user.id) &&
      String(p.assigned_sales_manager_id) !== String(user.id) &&
      !String(p.assigned_sales_manager_id).toLowerCase().includes(user.full_name.toLowerCase())) {
     throw new Error('Access Denied');
  }

  const history = readAll_('project_status_history').filter(x => String(x.project_id) === String(pid));
  
  const comments = readAll_('project_comments').filter(x => String(x.project_id) === String(pid));
  const users = readAll_('users');
  const commentsMapped = comments.map(c => {
    const author = users.find(u => String(u.id) === String(c.author_user_id));
    return { ...c, author_name: author ? author.full_name : 'Unknown' };
  });

  const inquiries = readAll_('project_inquiries').filter(x => String(x.project_id) === String(pid));
  const prices = readAll_('inquiry_prices_snapshot');
  const devices = readAll_('devices');
  
  const inqMapped = inquiries.map(i => {
    const pr = prices.find(x => String(x.project_inquiry_id) === String(i.id)) || {};
    const dev = devices.find(d => String(d.id) === String(i.device_id)) || {};
    return { 
      ...i, 
      sell_price_eur_snapshot: pr.sell_price_eur_snapshot, 
      sell_price_irr_snapshot: pr.sell_price_irr_snapshot,
      model_name: dev.model_name 
    };
  });
  
  // Join Assigned Manager Name (or use raw value if not an ID)
  const manager = users.find(u => String(u.id) === String(p.assigned_sales_manager_id));
  const pWithNames = { 
    ...p, 
    assigned_sales_manager_name: manager ? manager.full_name : (p.assigned_sales_manager_id || 'نامشخص')
  };
  
  return ok_({ project: pWithNames, status_history: history, comments: commentsMapped, inquiries: inqMapped });
}

function projectsApprove_(user, body, req) { 
  const now = new Date().toISOString();
  updateById_('projects', body.project_id, { 
    status: 'approved', 
    approval_decision_by: user.id,
    approval_decision_at: now,
    approval_note: body.note, 
    updated_at: now 
  }); 
  
  appendCanon_('project_status_history', { 
    id: Utilities.getUuid(), 
    project_id: body.project_id, 
    changed_by_user_id: user.id, 
    from_status: 'pending_approval', 
    to_status: 'approved', 
    note: body.note, 
    created_at: now 
  });
  
  logAudit_(user, 'APPROVE_PROJECT', { project_id: body.project_id }, req);
  return ok_({ status: 'approved' }); 
}

function projectsReject_(user, body, req) { 
  const now = new Date().toISOString();
  updateById_('projects', body.project_id, { 
    status: 'rejected', 
    approval_decision_by: user.id,
    approval_decision_at: now,
    approval_note: body.note, 
    updated_at: now 
  }); 
  
  appendCanon_('project_status_history', { 
    id: Utilities.getUuid(), 
    project_id: body.project_id, 
    changed_by_user_id: user.id, 
    from_status: 'pending_approval', 
    to_status: 'rejected', 
    note: body.note, 
    created_at: now 
  });

  logAudit_(user, 'REJECT_PROJECT', { project_id: body.project_id }, req);
  return ok_({ status: 'rejected' }); 
}

function commentsAdd_(user, body, req) { 
  appendCanon_('project_comments', { 
    id: Utilities.getUuid(), 
    project_id: body.project_id, 
    author_user_id: user.id, 
    author_role_snapshot: user.role,
    body: body.body, 
    parent_comment_id: body.parent_comment_id || '',
    created_at: new Date().toISOString() 
  }); 
  logAudit_(user, 'ADD_COMMENT', { project_id: body.project_id }, req);
  return ok_({ added: true }); 
}

function inquiriesQuote_(user, body, req) {
  const dev = readAll_('devices').find(d => String(d.id) === String(body.device_id));
  const s = getActiveSettings_();
  const quantity = Number(body.quantity || 1);
  
  // --- PRICING FORMULA v4 (Final) ---
  const P = Number(dev.factory_pricelist_eur || 0);
  const L = Number(dev.length_meter || 0);
  const W = Number(dev.weight_unit || 0);

  const D   = s.discount_multiplier !== undefined ? Number(s.discount_multiplier) : 0.38;
  const F   = s.freight_rate_per_meter_eur !== undefined ? Number(s.freight_rate_per_meter_eur) : 1000;
  const CN  = s.customs_numerator !== undefined ? Number(s.customs_numerator) : 350000;
  const CD  = s.customs_denominator !== undefined ? Number(s.customs_denominator) : 150000;
  const WR  = s.warranty_rate !== undefined ? Number(s.warranty_rate) : 0.05;
  const COM = s.commission_factor !== undefined ? Number(s.commission_factor) : 0.95;
  const OFF = s.office_factor !== undefined ? Number(s.office_factor) : 0.95;
  const PF  = s.profit_factor !== undefined ? Number(s.profit_factor) : 0.65;

  const companyPrice = P * D;
  const shipment = L * F;
  const custom = W * (CN / (CD || 1));
  const warranty = companyPrice * WR;
  const subtotal = companyPrice + shipment + custom + warranty;
  const afterCommission = subtotal / (COM || 1);
  const afterOffice = afterCommission / (OFF || 1);
  let sellPrice = afterOffice / (PF || 1);
  
  // Rounding
  const step = Number(s.rounding_step || 0);
  if (step > 0) {
    const mode = String(s.rounding_mode || 'none');
    if (mode === 'round') sellPrice = Math.round(sellPrice / step) * step;
    if (mode === 'ceil') sellPrice = Math.ceil(sellPrice / step) * step;
    if (mode === 'floor') sellPrice = Math.floor(sellPrice / step) * step;
  }
  
  // IRR Calculation
  const exchangeRate = Number(s.exchange_rate_irr_per_eur || 0);
  const sellPriceIRR = sellPrice * exchangeRate;

  const iid = Utilities.getUuid();
  appendCanon_('project_inquiries', { 
    id: iid, 
    project_id: body.project_id, 
    requested_by_user_id: user.id, 
    device_id: body.device_id, 
    category_id: dev.category_id, 
    quantity: quantity,
    query_text_snapshot: '', 
    settings_id_snapshot: s.id || '',
    created_at: new Date().toISOString() 
  });
  
  appendCanon_('inquiry_prices_snapshot', { 
    id: Utilities.getUuid(), 
    project_inquiry_id: iid, 
    sell_price_eur_snapshot: sellPrice, 
    sell_price_irr_snapshot: sellPriceIRR,
    created_at: new Date().toISOString() 
  });
  
  logAudit_(user, 'ADD_INQUIRY', { project_id: body.project_id, device: dev.model_name, price_eur: sellPrice }, req);
  return ok_({ inquiry_id: iid, sell_price_eur: sellPrice, sell_price_irr: sellPriceIRR });
}

function devicesSearch_(user, params) {
  const q = (params.query || '').toLowerCase();
  const cid = params.category_id;
  let devs = readAll_('devices').filter(d => isTrue_(d.is_active));
  if (cid) devs = devs.filter(d => String(d.category_id) === String(cid));
  if (q) devs = devs.filter(d => String(d.model_name).toLowerCase().includes(q));
  return ok_(devs.map(d => ({ device_id: d.id, model_name: d.model_name, category_id: d.category_id })));
}
