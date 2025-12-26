import { useEffect, useState } from 'react';
import { api, ProjectInquiry } from '../../services/api';
import { CheckCircle2, XCircle, Clock, Loader2, RefreshCw, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminInquiries() {
  const [inquiries, setInquiries] = useState<ProjectInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const res = await api.getPendingInquiries();
    if (res.ok) setInquiries(res.data);
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
      // Remove from list
      setInquiries(prev => prev.filter(i => i.id !== id));
    } else {
      alert('خطا در انجام عملیات');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ShoppingCart className="text-sky-600" />
          مدیریت استعلام‌های در انتظار
        </h1>
        <button 
          onClick={loadData}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
          title="بروزرسانی"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-right text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="p-4 font-medium">پروژه / کارفرما</th>
              <th className="p-4 font-medium">درخواست کننده</th>
              <th className="p-4 font-medium">دستگاه</th>
              <th className="p-4 font-medium">تعداد</th>
              <th className="p-4 font-medium">قیمت کل (€)</th>
              <th className="p-4 font-medium">تاریخ</th>
              <th className="p-4 font-medium text-center">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400">در حال بارگذاری...</td></tr>
            ) : inquiries.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400">هیچ استعلام در انتظاری وجود ندارد.</td></tr>
            ) : inquiries.map((inq) => (
              <tr key={inq.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4">
                  <Link to={`/projects/${inq.project_id}`} className="font-bold text-sky-600 hover:underline block">
                    {inq.project_name}
                  </Link>
                  <span className="text-xs text-gray-500">{inq.employer_name}</span>
                </td>
                <td className="p-4 text-gray-700">{inq.requested_by_name}</td>
                <td className="p-4 font-medium text-gray-800">{inq.model_name}</td>
                <td className="p-4">{inq.quantity}</td>
                <td className="p-4 font-mono font-bold text-gray-800">
                  {((inq.sell_price_eur_snapshot || 0) * inq.quantity).toLocaleString()} €
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
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="تایید"
                        >
                          <CheckCircle2 size={20} />
                        </button>
                        <button 
                          onClick={() => handleAction(inq.id, 'reject')}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="رد کردن"
                        >
                          <XCircle size={20} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
