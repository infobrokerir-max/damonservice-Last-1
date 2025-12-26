import { useEffect, useState } from 'react';
import { api, ProjectInquiry } from '../../services/api';
import { CheckCircle2, XCircle, Clock, Loader2, RefreshCw, ShoppingCart, Filter, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminInquiries() {
  const [inquiries, setInquiries] = useState<ProjectInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAllInquiries();
      if (res.ok) {
        setInquiries(res.data);
      } else {
        console.error("Failed to load inquiries:", res);
        setError('خطا در دریافت لیست استعلام‌ها. لطفا اتصال به سرور (Google Script) را بررسی کنید.');
      }
    } catch (e) {
      setError('خطای شبکه رخ داده است.');
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    if (!confirm(`آیا از ${action === 'approve' ? 'تایید' : 'رد'} این استعلام اطمینان دارید؟`)) return;
    
    setProcessingId(id);
    const res = action === 'approve' 
      ? await api.approveInquiry(id)
      : await api.rejectInquiry(id);
    
    setProcessingId(null);
    
    if (res.ok) {
      // Optimistic update
      setInquiries(prev => prev.map(i => 
        i.id === id ? { ...i, status: action === 'approve' ? 'approved' : 'rejected' } : i
      ));
      alert(`استعلام با موفقیت ${action === 'approve' ? 'تایید' : 'رد'} شد.`);
    } else {
      alert('خطا در انجام عملیات: ' + (res.message || 'مشکل در ارتباط با سرور'));
    }
  };

  const filteredInquiries = inquiries.filter(i => {
    if (filter === 'all') return true;
    const s = (i.status || 'pending').toLowerCase();
    if (filter === 'pending') return s !== 'approved' && s !== 'rejected';
    return s === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ShoppingCart className="text-sky-600" />
          مدیریت استعلام‌ها
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-white rounded-lg border border-gray-200 p-1">
            <FilterBtn label="همه" active={filter === 'all'} onClick={() => setFilter('all')} />
            <FilterBtn label="در انتظار" active={filter === 'pending'} onClick={() => setFilter('pending')} />
            <FilterBtn label="تایید شده" active={filter === 'approved'} onClick={() => setFilter('approved')} />
            <FilterBtn label="رد شده" active={filter === 'rejected'} onClick={() => setFilter('rejected')} />
          </div>
          <button 
            onClick={loadData}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
            title="بروزرسانی"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle size={24} />
          <div>
            <p className="font-bold">خطا در بارگذاری</p>
            <p className="text-sm">{error}</p>
            <p className="text-xs mt-1 text-red-500">نکته: اگر کد Backend را به‌روزرسانی کرده‌اید، حتما دکمه Deploy &gt; New Deployment را بزنید.</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-right text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="p-4 font-medium">پروژه / کارفرما</th>
              <th className="p-4 font-medium">درخواست کننده</th>
              <th className="p-4 font-medium">دستگاه</th>
              <th className="p-4 font-medium">تعداد</th>
              <th className="p-4 font-medium">قیمت کل (€)</th>
              <th className="p-4 font-medium">وضعیت</th>
              <th className="p-4 font-medium">تاریخ</th>
              <th className="p-4 font-medium text-center">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-gray-400">در حال بارگذاری...</td></tr>
            ) : filteredInquiries.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-gray-400">هیچ استعلامی با این وضعیت وجود ندارد.</td></tr>
            ) : filteredInquiries.map((inq) => {
               const status = (inq.status || 'pending').toLowerCase();
               const isPending = status !== 'approved' && status !== 'rejected';
               
               return (
                <tr key={inq.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4">
                    <Link to={`/projects/${inq.project_id}`} className="font-bold text-sky-600 hover:underline block">
                      {inq.project_name}
                    </Link>
                    <span className="text-xs text-gray-500">{inq.employer_name}</span>
                  </td>
                  <td className="p-4 text-gray-700">{inq.requested_by_name}</td>
                  <td className="p-4 font-medium text-gray-800">
                    {inq.model_name}
                    {inq.query_text_snapshot && (
                       <div className="text-xs text-gray-500 mt-1 max-w-[150px] truncate" title={inq.query_text_snapshot}>
                         {inq.query_text_snapshot}
                       </div>
                    )}
                  </td>
                  <td className="p-4">{inq.quantity}</td>
                  <td className="p-4 font-mono font-bold text-gray-800">
                    {((inq.sell_price_eur_snapshot || 0) * inq.quantity).toLocaleString()} €
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      status === 'approved' ? 'bg-green-100 text-green-700' :
                      status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                       {status === 'approved' ? <CheckCircle2 size={12}/> : 
                        status === 'rejected' ? <XCircle size={12}/> : <Clock size={12}/>}
                       {status === 'approved' ? 'تایید شده' : 
                        status === 'rejected' ? 'رد شده' : 'در انتظار'}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500 text-xs dir-ltr text-right">
                    {new Date(inq.created_at).toLocaleDateString('fa-IR')}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      {processingId === inq.id ? (
                        <Loader2 className="animate-spin text-gray-400" />
                      ) : (
                        <>
                          <button 
                            onClick={() => handleAction(inq.id, 'approve')}
                            className={`p-1 rounded hover:bg-green-50 text-green-600 ${status === 'approved' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="تایید"
                            disabled={status === 'approved'}
                          >
                            <CheckCircle2 size={20} />
                          </button>
                          <button 
                            onClick={() => handleAction(inq.id, 'reject')}
                            className={`p-1 rounded hover:bg-red-50 text-red-600 ${status === 'rejected' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="رد کردن"
                            disabled={status === 'rejected'}
                          >
                            <XCircle size={20} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
               );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterBtn({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
        active ? 'bg-sky-100 text-sky-700' : 'text-gray-600 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}
