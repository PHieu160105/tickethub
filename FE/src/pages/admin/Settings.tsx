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
  Upload,
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
        <h2 className="text-2xl font-display font-bold text-white">Cài đặt Hệ thống</h2>
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
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
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
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
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
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
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
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
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
                <CardDescription>Cấu hình thông tin cơ bản của hệ thống</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Tên hệ thống</label>
                    <Input placeholder="TicketRush" defaultValue="TicketRush" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Email liên hệ</label>
                    <Input type="email" placeholder="contact@ticketrush.com" defaultValue="contact@ticketrush.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Số điện thoại</label>
                    <Input type="tel" placeholder="+84 123 456 789" defaultValue="+84 123 456 789" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Website</label>
                    <Input type="url" placeholder="https://ticketrush.com" defaultValue="https://ticketrush.com" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Địa chỉ</label>
                  <Input placeholder="Nhập địa chỉ công ty" defaultValue="Hà Nội, Việt Nam" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Mô tả</label>
                  <textarea
                    className="w-full rounded-lg border bg-space-700/50 border-white/20 px-4 py-2.5 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red"
                    rows={3}
                    defaultValue="Nền tảng đặt vé sự kiện hàng đầu Việt Nam"
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
                  Cài đặt thông báo
                </CardTitle>
                <CardDescription>Quản lý các loại thông báo trên hệ thống</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-space-700/30 border border-white/10">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-brand-yellow" />
                      <div>
                        <p className="text-white font-medium">Thông báo qua Email</p>
                        <p className="text-xs text-gray-400">Gửi email khi có đơn hàng mới</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-red rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-red"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-space-700/30 border border-white/10">
                    <div className="flex items-center gap-3">
                      <Bell className="h-5 w-5 text-green-400" />
                      <div>
                        <p className="text-white font-medium">Thông báo Push</p>
                        <p className="text-xs text-gray-400">Hiển thị thông báo trên trình duyệt</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-red rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-red"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-space-700/30 border border-white/10">
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-blue-400" />
                      <div>
                        <p className="text-white font-medium">Thông báo SMS</p>
                        <p className="text-xs text-gray-400">Gửi SMS xác nhận đơn hàng</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-red rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-red"></div>
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
                  <div className="flex items-center justify-between p-4 rounded-lg bg-space-700/30 border border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Thẻ tín dụng/Ghi nợ</p>
                        <p className="text-xs text-gray-400">Visa, Mastercard, JCB</p>
                      </div>
                    </div>
                    <Badge variant="success">Đã kích hoạt</Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-space-700/30 border border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <Globe className="h-5 w-5 text-green-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Chuyển khoản ngân hàng</p>
                        <p className="text-xs text-gray-400">Vietcombank, Techcombank, BIDV</p>
                      </div>
                    </div>
                    <Badge variant="success">Đã kích hoạt</Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-space-700/30 border border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Shield className="h-5 w-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Ví điện tử</p>
                        <p className="text-xs text-gray-400">MoMo, ZaloPay, VNPay</p>
                      </div>
                    </div>
                    <Badge variant="default">Chưa kích hoạt</Badge>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <h4 className="text-sm font-medium text-white mb-4">Cấu hình API thanh toán</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">API Key</label>
                      <Input type="password" placeholder="••••••••••••••••" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Secret Key</label>
                      <Input type="password" placeholder="••••••••••••••••" />
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
                <CardDescription>Tùy chỉnh màu sắc và theme của hệ thống</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-4">Màu chủ đạo</label>
                  <div className="flex gap-3">
                    {['#DC2626', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'].map((color) => (
                      <button
                        key={color}
                        className="h-10 w-10 rounded-lg border-2 border-white/20 hover:border-white transition-all"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-4">Logo hệ thống</label>
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-space-700/30 border border-white/10 border-dashed">
                    <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-brand-red to-brand-yellow flex items-center justify-center">
                      <span className="text-xl font-bold text-space-900">TR</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">TicketRush Logo</p>
                      <p className="text-xs text-gray-400">PNG, JPG tối đa 2MB</p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Upload className="h-4 w-4" />
                      Tải lên
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-4">Chế độ hiển thị</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setTheme('dark')}
                      className={`relative p-4 rounded-lg border transition-all ${
                        theme === 'dark'
                          ? 'bg-brand-red/10 border-brand-red/30 text-on-background'
                          : 'bg-white/5 border-white/10 text-on-surface-variant hover:text-on-background'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Moon className="h-5 w-5" />
                        <p className="font-medium">Dark Mode</p>
                      </div>
                      {theme === 'dark' && (
                        <p className="text-xs text-on-surface-variant">Đang sử dụng</p>
                      )}
                      {theme !== 'dark' && (
                        <p className="text-xs text-slate-500">Nhấn để bật</p>
                      )}
                    </button>
                    <button
                      onClick={() => setTheme('light')}
                      className={`relative p-4 rounded-lg border transition-all ${
                        theme === 'light'
                          ? 'bg-brand-red/10 border-brand-red/30 text-on-background'
                          : 'bg-white/5 border-white/10 text-on-surface-variant hover:text-on-background'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Sun className="h-5 w-5" />
                        <p className="font-medium">Light Mode</p>
                      </div>
                      {theme === 'light' && (
                        <p className="text-xs text-on-surface-variant">Đang sử dụng</p>
                      )}
                      {theme !== 'light' && (
                        <p className="text-xs text-slate-500">Nhấn để bật</p>
                      )}
                    </button>
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
        </div>
      </div>
    </div>
  );
}