import { useEffect, useState } from 'react';
import { api, Project, User, useStore } from '../services/api';
import { Plus, Search, MapPin, Building2, UserCircle, Calendar, Loader2, X, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet Icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Component to handle map clicks
function LocationMarker({ position, setPosition }: { position: { lat: number, lng: number }, setPosition: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng.lat, e.latlng.lng);
    },
  });

  return <Marker position={position} />;
}

export default function ProjectList() {
  const { currentUser } = useStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [staffList, setStaffList] = useState<User[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<Project>>({
    project_name: '',
    employer_name: '',
    assigned_sales_manager_id: '',
    project_type: 'مسکونی',
    address_text: '',
    additional_info: '',
    tehran_lat: 35.6892,
    tehran_lng: 51.3890
  });
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    // Load projects
    const pRes = await api.getProjects();
    if (pRes.ok) setProjects(pRes.data);
    setLoading(false);
    
    // Load staff separately to ensure it doesn't block UI if it fails
    loadStaff();
  };

  const loadStaff = async () => {
    setLoadingStaff(true);
    const uRes = await api.getStaffList();
    if (uRes.ok && Array.isArray(uRes.data)) {
      setStaffList(uRes.data);
    } else {
      console.error("Failed to load staff list:", uRes);
    }
    setLoadingStaff(false);
  };

  useEffect(() => { loadData(); }, []);

  // Set default expert to current user when modal opens
  useEffect(() => {
    if (showModal) {
       if (staffList.length === 0) loadStaff(); // Retry loading staff if empty
       
       if (currentUser && !formData.assigned_sales_manager_id) {
         setFormData(prev => ({ ...prev, assigned_sales_manager_id: currentUser.id }));
       }
    }
  }, [showModal, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.project_name || !formData.employer_name) return alert('نام پروژه و کارفرما الزامی است');
    if (!formData.assigned_sales_manager_id) return alert('لطفا کارشناس اقدام کننده را انتخاب کنید');
    
    setSubmitting(true);
    const res = await api.createProject(formData);
    setSubmitting(false);
    
    if (res.ok) {
      setShowModal(false);
      setFormData({ 
        project_name: '', 
        employer_name: '', 
        assigned_sales_manager_id: currentUser?.id || '',
        project_type: 'مسکونی', 
        address_text: '', 
        additional_info: '',
        tehran_lat: 35.6892, 
        tehran_lng: 51.3890 
      });
      loadData();
    } else {
      alert(res.message || 'خطا در ایجاد پروژه');
    }
  };

  const filtered = projects.filter(p => 
    p.project_name.toLowerCase().includes(search.toLowerCase()) || 
    p.employer_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800">مدیریت پروژه‌ها</h1>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-sky-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-sky-700 w-full md:w-auto justify-center"
        >
          <Plus size={18} />
          <span>ثبت پروژه جدید</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-3">
        <Search className="text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="جستجو در نام پروژه یا کارفرما..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 outline-none text-gray-700"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-400">در حال دریافت اطلاعات...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400">هیچ پروژه‌ای یافت نشد.</div>
        ) : filtered.map(project => (
          <Link to={`/projects/${project.id}`} key={project.id} className="block group">
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all hover:border-sky-300 h-full flex flex-col">
              <div className="flex justify-between items-start mb-3">
                <div className="bg-sky-50 text-sky-600 p-2 rounded-lg">
                  <Building2 size={24} />
                </div>
                <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                  project.status === 'approved' ? 'bg-green-100 text-green-700' :
                  project.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {project.status === 'approved' ? 'تایید شده' : 
                   project.status === 'rejected' ? 'رد شده' : 'در انتظار تایید'}
                </span>
              </div>
              
              <h3 className="font-bold text-gray-800 text-lg mb-1 group-hover:text-sky-600 transition-colors">
                {project.project_name}
              </h3>
              <p className="text-sm text-gray-500 mb-4">{project.employer_name}</p>
              
              <div className="mt-auto space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-gray-400" />
                  <span className="truncate">{project.address_text || 'بدون آدرس'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-gray-400" />
                  <span>{new Date(project.created_at!).toLocaleDateString('fa-IR')}</span>
                </div>
                {project.assigned_sales_manager_id && (
                  <div className="flex items-center gap-2">
                    <UserCircle size={16} className="text-gray-400" />
                    <span className="text-xs">
                      کارشناس: {staffList.find(m => String(m.id) === String(project.assigned_sales_manager_id))?.full_name || '...'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* CREATE MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 my-8 relative">
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-4 left-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
            
            <h2 className="text-xl font-bold mb-6 border-b pb-2">ثبت پروژه جدید</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* 1. Project Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">1. نام پروژه <span className="text-red-500">*</span></label>
                <input 
                  required
                  type="text" 
                  value={formData.project_name}
                  onChange={e => setFormData({...formData, project_name: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                  placeholder="مثال: برج مسکونی آسمان"
                />
              </div>

              {/* 2. Employer Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">2. نام کارفرما <span className="text-red-500">*</span></label>
                <input 
                  required
                  type="text" 
                  value={formData.employer_name}
                  onChange={e => setFormData({...formData, employer_name: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              {/* 3. Expert / Action Taker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
                  <span>3. کارشناس اقدام کننده <span className="text-red-500">*</span></span>
                  {loadingStaff && <span className="text-xs text-sky-600 flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> در حال دریافت لیست...</span>}
                </label>
                <div className="flex gap-2">
                  <select 
                    required
                    value={formData.assigned_sales_manager_id}
                    onChange={e => setFormData({...formData, assigned_sales_manager_id: e.target.value})}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-sky-500 outline-none bg-white"
                    disabled={loadingStaff}
                  >
                    <option value="">انتخاب کنید...</option>
                    {staffList.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.full_name} ({user.role === 'sales_manager' ? 'مدیر فروش' : user.role === 'admin' ? 'مدیر' : 'کارمند'})
                      </option>
                    ))}
                  </select>
                  <button 
                    type="button" 
                    onClick={loadStaff} 
                    className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-600"
                    title="بروزرسانی لیست"
                  >
                    <RefreshCw size={20} className={loadingStaff ? "animate-spin" : ""} />
                  </button>
                </div>
                {staffList.length === 0 && !loadingStaff && (
                  <p className="text-xs text-red-500 mt-1">
                    لیست کاربران خالی است. لطفا اتصال به سرور را بررسی کنید یا مطمئن شوید کاربران فعال هستند.
                  </p>
                )}
              </div>

              {/* 4. Project Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">4. نوع پروژه</label>
                <select 
                  value={formData.project_type}
                  onChange={e => setFormData({...formData, project_type: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  <option value="مسکونی">مسکونی</option>
                  <option value="تجاری">تجاری</option>
                  <option value="اداری">اداری</option>
                  <option value="صنعتی">صنعتی</option>
                  <option value="هتل">هتل</option>
                  <option value="سایر">سایر</option>
                </select>
              </div>

              {/* 5. Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">5. آدرس پروژه</label>
                <input 
                  type="text" 
                  value={formData.address_text}
                  onChange={e => setFormData({...formData, address_text: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                  placeholder="آدرس دقیق پروژه..."
                />
              </div>

              {/* 6. Map */}
              <div className="border rounded-xl overflow-hidden shadow-sm mt-2">
                <div className="bg-gray-50 px-3 py-2 border-b text-xs text-gray-500 flex justify-between items-center">
                   <span className="font-bold">6. انتخاب موقعیت روی نقشه</span>
                   <span>(برای انتخاب کلیک کنید)</span>
                </div>
                <div className="h-64 w-full relative z-0">
                  <MapContainer 
                    center={[formData.tehran_lat || 35.6892, formData.tehran_lng || 51.3890]} 
                    zoom={11} 
                    className="h-full w-full"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LocationMarker 
                      position={{ lat: formData.tehran_lat || 35.6892, lng: formData.tehran_lng || 51.3890 }} 
                      setPosition={(lat, lng) => setFormData(prev => ({ ...prev, tehran_lat: lat, tehran_lng: lng }))}
                    />
                  </MapContainer>
                </div>
              </div>

              {/* 7 & 8. Coordinates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">7. عرض جغرافیایی (Latitude)</label>
                  <input 
                    type="number" 
                    step="any"
                    value={formData.tehran_lat}
                    onChange={e => setFormData({...formData, tehran_lat: Number(e.target.value)})}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-sky-500 outline-none font-mono text-center bg-gray-50"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">8. طول جغرافیایی (Longitude)</label>
                  <input 
                    type="number" 
                    step="any"
                    value={formData.tehran_lng}
                    onChange={e => setFormData({...formData, tehran_lng: Number(e.target.value)})}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-sky-500 outline-none font-mono text-center bg-gray-50"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* 9. Additional Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">9. توضیحات تکمیلی</label>
                <textarea 
                  value={formData.additional_info}
                  onChange={e => setFormData({...formData, additional_info: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-sky-500 outline-none h-24 resize-none"
                  placeholder="هرگونه توضیحات اضافی..."
                />
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">انصراف</button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  ثبت پروژه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
