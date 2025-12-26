import { create } from 'zustand';
import { BASE_API, LOGIN_GET_KEY } from '../config';

// --- Types ---
export interface User {
  id?: string;
  username: string;
  role: string;
  full_name?: string;
  is_active?: boolean;
}

export interface Category {
  id: string;
  category_name: string;
  description?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Device {
  id: string;
  category_id: string;
  model_name: string;
  factory_pricelist_eur?: number;
  length_meter?: number;
  weight_unit?: number;
  is_active?: boolean;
}

export interface Settings {
  id?: string;
  is_active?: boolean;
  discount_multiplier?: number;
  freight_rate_per_meter_eur?: number;
  customs_numerator?: number;
  customs_denominator?: number;
  warranty_rate?: number;
  commission_factor?: number;
  office_factor?: number;
  profit_factor?: number;
  rounding_mode?: string;
  rounding_step?: number;
  exchange_rate_irr_per_eur?: number;
  created_at?: string;
}

export interface Project {
  id: string;
  created_by_user_id: string;
  assigned_sales_manager_id?: string;
  assigned_sales_manager_name?: string; // Added field
  project_name: string;
  employer_name: string;
  project_type: string;
  address_text?: string;
  tehran_lat?: number;
  tehran_lng?: number;
  additional_info?: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'draft';
  approval_decision_by?: string;
  approval_decision_at?: string;
  approval_note?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectStatusHistory {
  id: string;
  project_id: string;
  changed_by_user_id: string;
  from_status: string;
  to_status: string;
  note?: string;
  created_at: string;
}

export interface ProjectComment {
  id: string;
  project_id: string;
  author_user_id: string;
  author_role_snapshot?: string;
  body: string;
  parent_comment_id?: string;
  created_at: string;
  // Joined fields for UI
  author_name?: string;
}

export interface ProjectInquiry {
  id: string;
  project_id: string;
  requested_by_user_id: string;
  device_id: string;
  category_id: string;
  quantity: number;
  query_text_snapshot?: string;
  settings_id_snapshot?: string;
  created_at: string;
  // Joined/Calculated fields for UI
  model_name?: string;
  sell_price_eur_snapshot?: number;
  sell_price_irr_snapshot?: number;
}

export interface InquiryPriceSnapshot {
  id: string;
  project_inquiry_id: string;
  sell_price_eur_snapshot: number;
  sell_price_irr_snapshot?: number;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_user_id: string;
  action_type: string;
  project_id?: string;
  project_inquiry_id?: string;
  meta_json?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  // Joined for UI
  actor_name?: string;
}

export interface ProjectDetailsResponse {
  project: Project;
  status_history: ProjectStatusHistory[];
  comments: ProjectComment[];
  inquiries: ProjectInquiry[];
}

interface StoreState {
  currentUser: User | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => void;
  fetchInitialData: () => Promise<void>;
}

// --- API Helpers ---
const qs = (params: Record<string, any>) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      p.append(key, String(value));
    }
  });
  return p.toString();
};

async function callApi(path: string, params: Record<string, any> = {}) {
  const url = `${BASE_API}?path=${encodeURIComponent(path)}&${qs(params)}`;
  try {
    const res = await fetch(url, { method: 'GET' });
    return await res.json();
  } catch (error) {
    console.error("API Call Error:", error);
    return { ok: false, message: "خطای شبکه یا عدم دسترسی به سرور" };
  }
}

async function getAdminToken() {
  const r = await callApi('/auth/admin_token', { key: LOGIN_GET_KEY });
  if (!r.ok) throw new Error(r.message || 'Login failed');
  localStorage.setItem('AUTH_TOKEN', r.data.token);
  return r.data;
}

async function callProtected(path: string, params: Record<string, any> = {}) {
  let token = localStorage.getItem('AUTH_TOKEN');
  if (!token) {
    try {
      const authData = await getAdminToken();
      token = authData.token;
    } catch (e) {
      return { ok: false, message: "عدم احراز هویت" };
    }
  }

  // Add client info for audit logs
  const clientInfo = {
    user_agent: navigator.userAgent,
    // ip_address is usually handled by server, but we can send what we know or let server handle
  };

  let r = await callApi(path, { ...params, token, ...clientInfo });

  // Retry once if session expired
  if (!r.ok && (r.error_code === 'SESSION_EXPIRED' || r.error_code === 'INVALID_SESSION' || (r.message || '').includes('Session'))) {
    try {
      const authData = await getAdminToken();
      token = authData.token;
      r = await callApi(path, { ...params, token, ...clientInfo });
    } catch (e) {
      return { ok: false, message: "نشست کاربری منقضی شده است" };
    }
  }
  return r;
}

// Safe localStorage access
const getUserFromStorage = (): User | null => {
  try {
    const stored = localStorage.getItem('USER');
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
};

// --- Exported API Methods ---

export const api = {
  checkHealth: () => callApi('/health'),
  
  // Users
  getUsers: () => callProtected('/admin/users/list'),
  getStaffList: () => callProtected('/users/staff'), // Public for authenticated users
  createUser: (data: Partial<User>) => callProtected('/admin/users/create', data),
  deleteUser: (id: string) => callProtected('/admin/users/delete', { id }),

  // Categories
  getCategories: () => callProtected('/categories/list'), // Public list for dropdowns (active only)
  getAdminCategories: () => callProtected('/admin/categories/list'), // Admin list (all)
  createCategory: (data: Partial<Category>) => callProtected('/admin/categories/create', data),
  updateCategory: (data: Partial<Category>) => callProtected('/admin/categories/update', data),
  deleteCategory: (id: string) => callProtected('/admin/categories/delete', { id }),

  // Devices
  getDevices: () => callProtected('/admin/devices/list'),
  searchDevices: (query: string, category_id?: string) => callProtected('/devices/search', { query, category_id }),
  createDevice: (data: Partial<Device>) => callProtected('/admin/devices/create', data),
  deleteDevice: (id: string) => callProtected('/admin/devices/delete', { id }),

  // Settings
  getSettings: () => callProtected('/admin/settings/get'),
  updateSettings: (data: Partial<Settings>) => callProtected('/admin/settings/update', data),

  // Projects
  getProjects: () => callProtected('/projects/list'),
  createProject: (data: Partial<Project>) => callProtected('/projects/create', data),
  getProjectDetails: (id: string) => callProtected('/projects/detail', { id }),
  approveProject: (project_id: string, note: string) => callProtected('/projects/approve', { project_id, note }),
  rejectProject: (project_id: string, note: string) => callProtected('/projects/reject', { project_id, note }),
  
  // Comments
  addComment: (project_id: string, body: string, parent_comment_id?: string) => callProtected('/comments/add', { project_id, body, parent_comment_id }),

  // Inquiries
  addInquiry: (project_id: string, device_id: string, quantity: number) => callProtected('/inquiries/quote', { project_id, device_id, quantity }),

  // Audit
  getAuditLogs: () => callProtected('/admin/audit/list'),
};

// --- Store ---
export const useStore = create<StoreState>((set) => ({
  currentUser: getUserFromStorage(),
  isLoading: false,

  login: async () => {
    set({ isLoading: true });
    try {
      const data = await getAdminToken();
      localStorage.setItem('USER', JSON.stringify(data.user));
      set({ currentUser: data.user });
    } catch (e) {
      console.error(e);
      alert('خطا در ورود به سیستم. لطفا اتصال اینترنت خود را بررسی کنید.');
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('AUTH_TOKEN');
    localStorage.removeItem('USER');
    set({ currentUser: null });
  },

  fetchInitialData: async () => {
    // Placeholder
  }
}));
