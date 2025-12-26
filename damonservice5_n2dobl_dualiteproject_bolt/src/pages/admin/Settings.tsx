import { useEffect, useState } from 'react';
import { api, Settings } from '../../services/api';
import { Save, Loader2, Coins, Calculator } from 'lucide-react';

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await api.getSettings();
      if (res.ok) setSettings(res.data);
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    // Ensure is_active is true for the new record
    const payload = { ...settings, is_active: true };
    const res = await api.updateSettings(payload);
    if (res.ok) alert('تنظیمات با موفقیت ذخیره شد');
    else alert('خطا در ذخیره تنظیمات');
    setSaving(false);
  };

  const handleChange = (key: keyof Settings, val: string | number) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  };

  if (loading) return <div className="p-8 text-center">در حال بارگذاری...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">تنظیمات قیمت‌گذاری</h1>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Core Pricing Factors */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Calculator size={20} className="text-sky-600" />
            ضرایب اصلی فرمول
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SettingInput 
              label="ضریب تخفیف (Discount Multiplier)" 
              value={settings.discount_multiplier} 
              onChange={v => handleChange('discount_multiplier', Number(v))} 
            />
            <SettingInput 
              label="نرخ حمل به ازای متر (€)" 
              value={settings.freight_rate_per_meter_eur} 
              onChange={v => handleChange('freight_rate_per_meter_eur', Number(v))} 
            />
            <SettingInput 
              label="نرخ گارانتی (Warranty Rate)" 
              value={settings.warranty_rate} 
              onChange={v => handleChange('warranty_rate', Number(v))} 
            />
          </div>
        </div>

        {/* Customs & Factors */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Coins size={20} className="text-yellow-600" />
            گمرک و ضرایب فروش
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SettingInput 
              label="نرخ گمرک (صورت کسر - Numerator)" 
              value={settings.customs_numerator} 
              onChange={v => handleChange('customs_numerator', Number(v))} 
            />
            <SettingInput 
              label="نرخ گمرک (مخرج کسر - Denominator)" 
              value={settings.customs_denominator} 
              onChange={v => handleChange('customs_denominator', Number(v))} 
            />
            <div className="hidden lg:block"></div> {/* Spacer */}
            
            <SettingInput 
              label="ضریب کمیسیون (Commission Factor)" 
              value={settings.commission_factor} 
              onChange={v => handleChange('commission_factor', Number(v))} 
            />
            <SettingInput 
              label="ضریب دفتر (Office Factor)" 
              value={settings.office_factor} 
              onChange={v => handleChange('office_factor', Number(v))} 
            />
            <SettingInput 
              label="ضریب سود (Profit Factor)" 
              value={settings.profit_factor} 
              onChange={v => handleChange('profit_factor', Number(v))} 
            />
          </div>
        </div>

        {/* Currency & Rounding */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Coins size={20} className="text-green-600" />
            ارز و رندسازی
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             <SettingInput 
              label="نرخ ارز (IRR به ازای هر EUR)" 
              value={settings.exchange_rate_irr_per_eur} 
              onChange={v => handleChange('exchange_rate_irr_per_eur', Number(v))} 
              placeholder="مثال: 650000"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">حالت رندسازی (Rounding Mode)</label>
              <select 
                value={settings.rounding_mode || 'none'}
                onChange={e => handleChange('rounding_mode', e.target.value)}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                dir="ltr"
              >
                <option value="none">بدون رندسازی (None)</option>
                <option value="round">رند معمولی (Round)</option>
                <option value="ceil">رند به بالا (Ceil)</option>
                <option value="floor">رند به پایین (Floor)</option>
              </select>
            </div>
            <SettingInput 
              label="گام رندسازی (Rounding Step)" 
              value={settings.rounding_step} 
              onChange={v => handleChange('rounding_step', Number(v))} 
              placeholder="مثال: 1000"
            />
          </div>
        </div>

        <div className="pt-4">
          <button 
            type="submit" 
            disabled={saving}
            className="w-full py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 flex items-center justify-center gap-2 font-medium disabled:opacity-50 shadow-md transition-all"
          >
            {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
            ذخیره تنظیمات جدید
          </button>
        </div>
      </form>
    </div>
  );
}

function SettingInput({ label, value, onChange, placeholder }: { label: string, value: any, onChange: (val: string) => void, placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input 
        type="number" 
        step="0.0001"
        value={value !== undefined ? value : ''}
        onChange={e => onChange(e.target.value)}
        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-sky-500 outline-none font-mono text-left"
        dir="ltr"
        placeholder={placeholder}
      />
    </div>
  );
}
