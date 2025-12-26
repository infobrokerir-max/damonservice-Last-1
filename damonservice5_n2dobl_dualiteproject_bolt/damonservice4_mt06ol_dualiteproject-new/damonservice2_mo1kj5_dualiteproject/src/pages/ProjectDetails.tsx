import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ProjectDetailsResponse, Device, useStore } from '../services/api';
import { 
  MapPin, Calendar, Building, 
  MessageSquare, History, ShoppingCart, Plus, Send, Loader2, FileText
} from 'lucide-react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
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

export default function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useStore();
  const navigate = useNavigate();
  
  const [data, setData] = useState<ProjectDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'inquiries' | 'comments' | 'history'>('info');
  
  // Inquiry Modal
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [inquiryForm, setInquiryForm] = useState({ device_id: '', quantity: 1 });
  const [submittingInquiry, setSubmittingInquiry] = useState(false);

  // Comment Form
  const [commentBody, setCommentBody] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Approval
  const [approvalNote, setApprovalNote] = useState('');
  const [processingApproval, setProcessingApproval] = useState(false);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    const res = await api.getProjectDetails(id);
    if (res.ok) setData(res.data);
    else {
      alert('خطا در دریافت اطلاعات پروژه');
      navigate('/projects');
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [id]);

  const handleAddInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !inquiryForm.device_id) return;
    setSubmittingInquiry(true);
    const res = await api.addInquiry(id, inquiryForm.device_id, inquiryForm.quantity);
    setSubmittingInquiry(false);
    if (res.ok) {
      setShowInquiryModal(false);
      setInquiryForm({ device_id: '', quantity: 1 });
      loadData();
    } else {
      alert('خطا در ثبت استعلام');
    }
  };

  const handleAddComment = async () => {
    if (!id || !commentBody.trim()) return;
    setSubmittingComment(true);
    const res = await api.addComment(id, commentBody);
    setSubmittingComment(false);
    if (res.ok) {
      setCommentBody('');
      loadData();
    }
  };

  const handleApproval = async (status: 'approved' | 'rejected') => {
    if (!id || !confirm(`آیا از ${status === 'approved' ? 'تایید' : 'رد'} پروژه اطمینان دارید؟`)) return;
    setProcessingApproval(true);
    const res = status === 'approved' 
      ? await api.approveProject(id, approvalNote)
      : await api.rejectProject(id, approvalNote);
    
    setProcessingApproval(false);
    if (res.ok) loadData();
    else alert('خطا در تغییر وضعیت');
  };

  const openInquiryModal = async () => {
    const res = await api.getDevices();
    if (res.ok) setDevices(res.data);
    setShowInquiryModal(true);
  };

  if (loading || !data) return <div className="p-12 text-center text-gray-500">در حال بارگذاری...</div>;

  const { project, inquiries, comments, status_history } = data;
  const isAdminOrManager = currentUser?.role === 'admin' || currentUser?.role === 'sales_manager';

  return (
    <div className="space-y-6 pb-20">
      {/* HEADER */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-800">{project.project_name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                project.status === 'approved' ? 'bg-green-100 text-green-700' :
                project.status === 'rejected' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {project.status === 'approved' ? 'تایید شده' : 
                 project.status === 'rejected' ? 'رد شده' : 'در انتظار بررسی'}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1"><Building size={16} /> {project.employer_name}</span>
              <span className="flex items-center gap-1"><MapPin size={16} /> {project.address_text || 'بدون آدرس'}</span>
              <span className="flex items-center gap-1"><Calendar size={16} /> {new Date(project.created_at!).toLocaleDateString('fa-IR')}</span>
            </div>
          </div>
          
          {isAdminOrManager && project.status === 'pending_approval' && (
             <div className="flex flex-col gap-2 min-w-[250px]">
               <input 
                 type="text" 
                 placeholder="یادداشت تایید/رد (اختیاری)" 
                 value={approvalNote}
                 onChange={e => setApprovalNote(e.target.value)}
                 className="p-2 text-sm border rounded-lg w-full"
               />
               <div className="flex gap-2">
                 <button onClick={() => handleApproval('approved')} disabled={processingApproval} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm hover:bg-green-700">تایید</button>
                 <button onClick={() => handleApproval('rejected')} disabled={processingApproval} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm hover:bg-red-700">رد</button>
               </div>
             </div>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-gray-200 gap-6 px-2">
        <TabBtn id="info" label="مشخصات کلی" icon={<FileText size={18} />} active={activeTab} set={setActiveTab} />
        <TabBtn id="inquiries" label="لیست تجهیزات" icon={<ShoppingCart size={18} />} active={activeTab} set={setActiveTab} count={inquiries.length} />
        <TabBtn id="comments" label="نظرات و گفتگو" icon={<MessageSquare size={18} />} active={activeTab} set={setActiveTab} count={comments.length} />
        <TabBtn id="history" label="تاریخچه وضعیت" icon={<History size={18} />} active={activeTab} set={setActiveTab} />
      </div>

      {/* CONTENT */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 min-h-[400px]">
        
        {/* INFO TAB */}
        {activeTab === 'info' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">اطلاعات تکمیلی</h3>
                <div className="space-y-3 text-sm">
                  <Row label="نوع پروژه" value={project.project_type} />
                  <Row label="کارفرما" value={project.employer_name} />
                  <Row label="کارشناس اقدام کننده" value={project.assigned_sales_manager_name} />
                  <Row label="تاریخ ثبت" value={new Date(project.created_at!).toLocaleString('fa-IR')} />
                  <div className="pt-2">
                    <span className="text-gray-500 block mb-1">توضیحات:</span>
                    <p className="text-gray-800 bg-gray-50 p-3 rounded-lg leading-relaxed">
                      {project.additional_info || 'توضیحاتی ثبت نشده است.'}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">موقعیت مکانی</h3>
                {project.tehran_lat && project.tehran_lng ? (
                   <div className="h-64 rounded-lg overflow-hidden border border-gray-200 relative z-0">
                      <MapContainer 
                        center={[project.tehran_lat, project.tehran_lng]} 
                        zoom={13} 
                        scrollWheelZoom={false}
                        className="h-full w-full"
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <Marker position={[project.tehran_lat, project.tehran_lng]} />
                      </MapContainer>
                   </div>
                ) : (
                  <p className="text-gray-500 italic">موقعیت مکانی ثبت نشده است.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* INQUIRIES TAB */}
        {activeTab === 'inquiries' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-gray-800">تجهیزات و استعلام قیمت</h3>
              <button 
                onClick={openInquiryModal}
                className="bg-sky-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-sky-700 text-sm"
              >
                <Plus size={16} />
                افزودن دستگاه
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="p-3 rounded-r-lg">مدل دستگاه</th>
                    <th className="p-3">تعداد</th>
                    <th className="p-3">قیمت واحد (€)</th>
                    <th className="p-3">قیمت کل (€)</th>
                    <th className="p-3">قیمت کل (ریال)</th>
                    <th className="p-3 rounded-l-lg">تاریخ ثبت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inquiries.map(inq => (
                    <tr key={inq.id}>
                      <td className="p-3 font-medium">{inq.model_name}</td>
                      <td className="p-3">{inq.quantity}</td>
                      <td className="p-3 font-mono text-gray-600">
                        {inq.sell_price_eur_snapshot?.toLocaleString()} €
                      </td>
                      <td className="p-3 font-mono font-bold text-sky-700">
                        {((inq.sell_price_eur_snapshot || 0) * inq.quantity).toLocaleString()} €
                      </td>
                      <td className="p-3 font-mono text-gray-600">
                        {inq.sell_price_irr_snapshot 
                          ? ((inq.sell_price_irr_snapshot || 0) * inq.quantity).toLocaleString() 
                          : '-'}
                      </td>
                      <td className="p-3 text-gray-400 text-xs">
                        {new Date(inq.created_at).toLocaleDateString('fa-IR')}
                      </td>
                    </tr>
                  ))}
                  {inquiries.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-gray-400">هنوز دستگاهی اضافه نشده است.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* COMMENTS TAB */}
        {activeTab === 'comments' && (
          <div className="max-w-3xl mx-auto">
            <div className="space-y-6 mb-8">
              {comments.map(comment => (
                <div key={comment.id} className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 shrink-0">
                    {comment.author_name?.charAt(0)}
                  </div>
                  <div className="flex-1 bg-gray-50 p-4 rounded-xl rounded-tr-none">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-sm text-gray-800">{comment.author_name}</span>
                      <span className="text-xs text-gray-400">{new Date(comment.created_at).toLocaleString('fa-IR')}</span>
                    </div>
                    <p className="text-gray-700 text-sm leading-relaxed">{comment.body}</p>
                  </div>
                </div>
              ))}
              {comments.length === 0 && <p className="text-center text-gray-400 py-4">هنوز نظری ثبت نشده است.</p>}
            </div>

            <div className="flex gap-2 items-start border-t pt-4">
              <textarea 
                value={commentBody}
                onChange={e => setCommentBody(e.target.value)}
                placeholder="نظرات خود را اینجا بنویسید..."
                className="flex-1 p-3 border rounded-xl focus:ring-2 focus:ring-sky-500 outline-none resize-none h-24"
              />
              <button 
                onClick={handleAddComment}
                disabled={submittingComment || !commentBody.trim()}
                className="bg-sky-600 text-white p-3 rounded-xl hover:bg-sky-700 disabled:opacity-50"
              >
                {submittingComment ? <Loader2 className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="relative border-r-2 border-gray-200 mr-4 space-y-8 py-2">
            {status_history.map((hist, idx) => (
              <div key={hist.id} className="relative pr-6">
                <div className="absolute -right-[9px] top-1 w-4 h-4 rounded-full bg-sky-500 ring-4 ring-white"></div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50 p-3 rounded-lg">
                  <div>
                    <span className="font-bold text-sm text-gray-800">تغییر وضعیت به: {hist.to_status}</span>
                    {hist.note && <p className="text-xs text-gray-600 mt-1">یادداشت: {hist.note}</p>}
                  </div>
                  <span className="text-xs text-gray-400 font-mono">
                    {new Date(hist.created_at).toLocaleString('fa-IR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* INQUIRY MODAL */}
      {showInquiryModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="font-bold text-lg mb-4">افزودن دستگاه به پروژه</h3>
            <form onSubmit={handleAddInquiry} className="space-y-4">
              <div>
                <label className="block text-sm mb-1">انتخاب دستگاه</label>
                <select 
                  required
                  value={inquiryForm.device_id}
                  onChange={e => setInquiryForm({...inquiryForm, device_id: e.target.value})}
                  className="w-full p-2 border rounded-lg outline-none"
                >
                  <option value="">انتخاب کنید...</option>
                  {devices.map(d => (
                    <option key={d.id} value={d.id}>{d.model_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">تعداد</label>
                <input 
                  type="number" 
                  min="1"
                  value={inquiryForm.quantity}
                  onChange={e => setInquiryForm({...inquiryForm, quantity: Number(e.target.value)})}
                  className="w-full p-2 border rounded-lg outline-none"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowInquiryModal(false)} className="flex-1 py-2 text-gray-600 bg-gray-100 rounded-lg">انصراف</button>
                <button type="submit" disabled={submittingInquiry} className="flex-1 py-2 bg-sky-600 text-white rounded-lg">
                  {submittingInquiry ? 'در حال ثبت...' : 'افزودن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({ id, label, icon, active, set, count }: any) {
  return (
    <button 
      onClick={() => set(id)}
      className={`flex items-center gap-2 pb-3 px-2 border-b-2 transition-colors ${
        active === id 
          ? 'border-sky-600 text-sky-600 font-bold' 
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{count}</span>}
    </button>
  );
}

function Row({ label, value }: { label: string, value: any }) {
  return (
    <div className="flex justify-between border-b border-gray-100 py-2 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value || '-'}</span>
    </div>
  );
}
