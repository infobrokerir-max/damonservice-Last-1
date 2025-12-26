import { useEffect, useState } from 'react';
import { api, AuditLog } from '../../services/api';
import { ShieldAlert, Search } from 'lucide-react';

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await api.getAuditLogs();
      if (res.ok) setLogs(res.data);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = logs.filter(l => 
    l.action_type.toLowerCase().includes(search.toLowerCase()) ||
    l.actor_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
        <ShieldAlert className="text-sky-600" />
        گزارش عملکرد سیستم (Audit Logs)
      </h1>

      <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-3">
        <Search className="text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="جستجو در نوع عملیات یا نام کاربر..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 outline-none text-gray-700"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-right text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="p-4 font-medium">کاربر</th>
              <th className="p-4 font-medium">نوع عملیات</th>
              <th className="p-4 font-medium">جزئیات (Meta)</th>
              <th className="p-4 font-medium">IP / Agent</th>
              <th className="p-4 font-medium">زمان</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">در حال بارگذاری...</td></tr>
            ) : filtered.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4 font-bold text-gray-800">{log.actor_name || log.actor_user_id}</td>
                <td className="p-4">
                  <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-mono">
                    {log.action_type}
                  </span>
                </td>
                <td className="p-4 text-gray-600 font-mono text-xs max-w-xs truncate" title={log.meta_json}>
                  {log.meta_json}
                </td>
                <td className="p-4 text-gray-500 text-xs">
                  <div className="truncate max-w-[150px]">{log.user_agent}</div>
                  <div className="text-[10px] text-gray-400">{log.ip_address}</div>
                </td>
                <td className="p-4 text-gray-500 dir-ltr text-right">
                  {new Date(log.created_at).toLocaleString('fa-IR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
