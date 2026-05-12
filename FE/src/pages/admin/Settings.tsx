import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  Settings,
  Bell,
  Mail,
  Globe,
  CreditCard,
  Shield,
  Save,
  Palette,
  Moon,
  Sun
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<'general' | 'notification' | 'payment' | 'appearance'>('general');
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-display font-bold admin-text-body">Cài đặt hệ thống</h2>
        <p className="text-gray-400 mt-1">Quản lý cấu hình và tùy chỉnh nền tảng</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <Card className="lg:col-span-1 h-fit">
          <CardContent className="pt-6 p-3 space-y-1">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'general'
                  ? 'bg-brand-red/10 text-brand-red border border-brand-red/20'
                  : 'text-gray-500 hover:bg-[var(--admin-bg-opt)] hover:admin-text-body'
              }`}
            >
              <Settings className="h-5 w-5" />
              Chung
            </button>
            <button
              onClick={() => setActiveTab('notification')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'notification'
                  ? 'bg-brand-red/10 text-brand-red border border-brand-red/20'
                  : 'text-gray-500 hover:bg-[var(--admin-bg-opt)] hover:admin-text-body'
              }`}
            >
              <Bell className="h-5 w-5" />
              Thông báo
            </button>
            <button
              onClick={() => setActiveTab('payment')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'payment'
                  ? 'bg-brand-red/10 text-brand-red border border-brand-red/20'
                  : 'text-gray-500 hover:bg-[var(--admin-bg-opt)] hover:admin-text-body'
              }`}
            >
              <CreditCard className="h-5 w-5" />
              Thanh toán
            </button>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'appearance'
                  ? 'bg-brand-red/10 text-brand-red border border-brand-red/20'
                  : 'text-gray-500 hover:bg-[var(--admin-bg-opt)] hover:admin-text-body'
              }`}
            >
              <Palette className="h-5 w-5" />
              Giao diện
            </button>
          </CardContent>
        </Card>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* General Settings */}
          {activeTab === 'general' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-brand-red" />
                  Cài đặt chung
                </CardTitle>
                <CardDescription>Cấu hình chung hệ thống</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium admin-text-body mb-2">Tên hệ thống</label>
                    <Input placeholder="TicketRush" defaultValue="TicketRush" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium admin-text-body mb-2">Email liện hệ</label>
                    <Input type="email" placeholder="contact@ticketrush.com" defaultValue="contact@ticketrush.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium admin-text-body mb-2">Số điện thoại</label>
                    <Input type="tel" placeholder="+84 123 456 789" defaultValue="+84 123 456 789" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium admin-text-body mb-2">Website</label>
                    <Input type="url" placeholder="https://ticketrush.com" defaultValue="https://ticketrush.com" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium admin-text-body mb-2">Địa chỉ</label>
                  <Input placeholder="Nhập địa chỉ" defaultValue="Hà Nội, Việt Nam" />
                </div>

                <div>
                  <label className="block text-sm font-medium admin-text-body mb-2">Mô tả</label>
                  <textarea
                    className="w-full rounded-lg border bg-space-700/50 border-gray-500 px-4 py-2.5 admin-text-body placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red"
                    rows={3}
                    defaultValue="Nền tảng đặt vé hàng đầu Việt Nam"
                  />
                </div>

                <div className="flex justify-end">
                  <Button variant="primary">
                    <Save className="h-4 w-4" />
                    Lưu thay đổi
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notification Settings */}
          {activeTab === 'notification' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-brand-red" />
                  Cấu hình thông báo
                </CardTitle>
                <CardDescription>Quản lý các loại thông báo trên hệ thống</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg bg-space-700/30 border border-gray-500">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-yellow" />
                      <div>
                        <p className="admin-text-body font-medium">Thông báo qua Email</p>
                        <p className="text-xs text-gray-500">Gửi email khi có đơn mới</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg bg-space-700/30 border border-gray-500">
                    <div className="flex items-center gap-3">
                      <Bell className="h-5 w-5 text-green-400" />
                      <div>
                        <p className="admin-text-body font-medium">Thông báo Push</p>
                        <p className="text-xs text-gray-400">Hiển thị thông báo trên trình duyệt</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg bg-space-700/30 border border-gray-500">
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-blue-400" />
                      <div>
                        <p className="admin-text-body font-medium">Thông báo SMS</p>
                        <p className="text-xs text-gray-400">Gửi SMS xác nhận</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="primary">
                    <Save className="h-4 w-4" />
                    Lưu thay đổi
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Settings */}
          {activeTab === 'payment' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-brand-red" />
                  Cấu hình thanh toán
                </CardTitle>
                <CardDescription>Quản lý các phương thức thanh toán</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg bg-space-700/30 border border-gray-500">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="admin-text-body font-medium">Thanh toán bằng Thẻ ghi nợ</p>
                        <p className="text-xs text-gray-400">Visa, Mastercard, JCB</p>
                      </div>
                    </div>
                    <Badge variant="success">Đã kích hoạt</Badge>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg bg-space-700/30 border border-gray-500">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <Globe className="h-5 w-5 text-green-400" />
                      </div>
                      <div>
                        <p className="admin-text-body font-medium">Chuyển khoảng ngân hàng</p>
                        <p className="text-xs text-gray-400">Vietcombank, Techcombank, BIDV</p>
                      </div>
                    </div>
                    <Badge variant="success">Đã kích hoạt</Badge>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg bg-space-700/30 border border-gray-500">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Shield className="h-5 w-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="admin-text-body font-medium">Vé điện tử­</p>
                        <p className="text-xs text-gray-400">MoMo, ZaloPay, VNPay</p>
                      </div>
                    </div>
                    <Badge variant="default">Ch kích hoạt</Badge>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-500">
                  <h4 className="text-sm font-medium admin-text-body mb-4">Cấu hình API thanh toán</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-2">API Key</label>
                      <Input type="password" placeholder="********" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-2">Secret Key</label>
                      <Input type="password" placeholder="********" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="primary">
                    <Save className="h-4 w-4" />
                    Lưu thay đổi
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Appearance Settings */}
          {activeTab === 'appearance' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-brand-red" />
                  Tùy chỉnh giao diện
                </CardTitle>
                <CardDescription>Tủy chỉnh màu sắc giao diện hệ thống</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider">
                    Chế độ
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => setTheme('dark')}
                      className={`relative p-6 rounded-xl border transition-all duration-200 ${
                        theme === 'dark'
                          ? 'bg-gradient-to-br from-red-500/20 to-red-500/5 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                          : 'bg-surface-variant border-gray-500 hover:border-primary'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <Moon className={`w-6 h-6 ${theme === 'dark' ? 'text-red-400' : 'text-slate-500'}`} />
                        <span className={`font-bold text-lg ${theme === 'dark' ? 'text-on-background' : 'text-on-surface-variant'}`}>
                          Dark Mode
                        </span>
                      </div>
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-on-surface-variant'}`}>
                        Chế độ ban đêm, bảo vệ mắt tốt
                      </p>
                      {theme === 'dark' && (
                        <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>

                    <button
                      onClick={() => setTheme('light')}
                      className={`relative p-6 rounded-xl border transition-all duration-200 ${
                        theme === 'light'
                          ? 'bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/30 shadow-[0_0_20px_rgba(251,191,36,0.15)]'
                          : 'bg-surface-variant border-gray-500 hover:border-secondary'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <Sun className={`w-6 h-6 ${theme === 'light' ? 'text-amber-400' : 'text-slate-500'}`} />
                        <span className={`font-bold text-lg ${theme === 'light' ? 'text-on-background' : 'text-on-surface-variant'}`}>
                          Light Mode
                        </span>
                      </div>
                      <p className={`text-sm ${theme === 'light' ? 'text-slate-300' : 'text-on-surface-variant'}`}>
                        Chế độ ban ngày, độ sáng mặc đinhj
                      </p>
                      {theme === 'light' && (
                        <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  </div>
                </div>

                <div className="rounded-lg bg-surface-variant border border-gray-500 p-4">
                  <p className="text-sm text-on-surface-variant">
                    Nền đang chọn: <span className="font-bold text-on-background">{theme === 'dark' ? 'Dark' : 'Light'}</span>
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button variant="primary">
                    <Save className="h-4 w-4" />
                    Lưu thay đổi
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

