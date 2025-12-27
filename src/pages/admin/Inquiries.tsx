import { useEffect, useState } from 'react';
import { api, ProjectInquiry, InquiryStats } from '../../services/api';
import { CheckCircle2, XCircle, Clock, Loader2, RefreshCw, ShoppingCart, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export default function AdminInquiries() {
  const [inquiries, setInquiries] = useState<ProjectInquiry[]>([]);
  const [stats, setStats] = useState<InquiryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectInquiryId, setRejectInquiryId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadData = async () => {
    setLoading(true);
    const filter = statusFilter === 'all' ? undefined : statusFilter;
    const [inquiriesRes, statsRes] = await Promise.all([
      api.getAllInquiries(filter),
      api.getInquiryStats()
    ]);

    if (inquiriesRes.ok) setInquiries(inquiriesRes.data);
    if (statsRes.ok) setStats(statsRes.data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [statusFilter]);

  const handleApprove = async (id: string) => {
    if (!confirm('آیا از تایید این استعلام اطمینان دارید؟')) return;

    setProcessingId(id);
    const res = await api.approveInquiry(id);
    setProcessingId(null);

    if (res.ok) {
      loadData();
    } else {
      alert('خطا در تایید استعلام');
    }
  };

  const openRejectModal = (id: string) => {
    setRejectInquiryId(id);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleReject = async () => {
    if (!rejectInquiryId || !rejectReason.trim()) {
      alert('لطفا دلیل رد را وارد کنید');
      return;
    }

    setProcessingId(rejectInquiryId);
    const res = await api.rejectInquiry(rejectInquiryId, rejectReason);
    setProcessingId(null);
    setRejectModalOpen(false);

    if (res.ok) {
      loadData();
    } else {
      alert('خطا در رد استعلام');
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'approved') {
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap">
        <CheckCircle2 size={12} /> تایید شده
      </span>;
    }
    if (status === 'rejected') {
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 whitespace-nowrap">
        <XCircle size={12} /> رد شده
      </span>;
    }
    return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 whitespace-nowrap">
      <Clock size={12} /> در انتظار
    </span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ShoppingCart className="text-sky-600" />
          مدیریت استعلام‌ها
        </h1>
        <button
          onClick={loadData}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
          title="بروزرسانی"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="کل" value={stats.total} color="gray" />
          <StatCard label="در انتظار" value={stats.pending} color="yellow" />
          <StatCard label="تایید شده" value={stats.approved} color="green" />
          <StatCard label="رد شده" value={stats.rejected} color="red" />
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2">
        <FilterButton active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} label="همه" />
        <FilterButton active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')} label="در انتظار" />
        <FilterButton active={statusFilter === 'approved'} onClick={() => setStatusFilter('approved')} label="تایید شده" />
        <FilterButton active={statusFilter === 'rejected'} onClick={() => setStatusFilter('rejected')} label="رد شده" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm min-w-max">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="p-4 font-medium whitespace-nowrap">پروژه / کارفرما</th>
                <th className="p-4 font-medium whitespace-nowrap">درخواست کننده</th>
                <th className="p-4 font-medium whitespace-nowrap">دستگاه</th>
                <th className="p-4 font-medium whitespace-nowrap">تعداد</th>
                <th className="p-4 font-medium whitespace-nowrap">قیمت کل (€)</th>
                <th className="p-4 font-medium whitespace-nowrap">وضعیت</th>
                <th className="p-4 font-medium text-center whitespace-nowrap">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">در حال بارگذاری...</td></tr>
              ) : inquiries.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">استعلامی یافت نشد.</td></tr>
              ) : inquiries.map((inq) => (
                <tr key={inq.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 min-w-0 max-w-xs">
                    <Link to={`/projects/${inq.project_id}`} className="font-bold text-sky-600 hover:underline block overflow-wrap-anywhere break-words">
                      {inq.project_name}
                    </Link>
                    <span className="text-xs text-gray-500 block overflow-wrap-anywhere break-words">{inq.employer_name}</span>
                  </td>
                  <td className="p-4 text-gray-700 whitespace-nowrap">{inq.requested_by_name}</td>
                  <td className="p-4 font-medium text-gray-800 min-w-0 max-w-xs">
                    <div className="overflow-wrap-anywhere break-words">{inq.model_name}</div>
                  </td>
                  <td className="p-4 whitespace-nowrap">{inq.quantity}</td>
                  <td className="p-4 font-mono font-bold text-gray-800 whitespace-nowrap">
                    {inq.sell_price_eur_snapshot ? `€${(inq.sell_price_eur_snapshot * inq.quantity).toLocaleString()}` : '---'}
                  </td>
                  <td className="p-4">{getStatusBadge(inq.status)}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      {processingId === inq.id ? (
                        <Loader2 className="animate-spin text-gray-400" />
                      ) : inq.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => handleApprove(inq.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="تایید"
                          >
                            <CheckCircle2 size={20} />
                          </button>
                          <button
                            onClick={() => openRejectModal(inq.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="رد کردن"
                          >
                            <XCircle size={20} />
                          </button>
                        </>
                      ) : (
                        <span className="text-gray-400 text-xs">---</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {rejectModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-red-600">
              <AlertCircle />
              رد استعلام
            </h3>
            <p className="text-sm text-gray-600 mb-4">لطفا دلیل رد این استعلام را وارد کنید:</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none resize-none h-32"
              placeholder="مثال: قیمت بالا، عدم موجودی، مشخصات نامناسب..."
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="flex-1 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                انصراف
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim()}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                تایید رد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
  };

  return (
    <div className={`p-4 rounded-lg ${colorMap[color]}`}>
      <div className="text-sm font-medium mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
        active
          ? 'bg-sky-600 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );
}
