import { useEffect, useState } from 'react'
import { Bell, CreditCard, Globe, Mail, Moon, Palette, Save, Settings, Shield, Sun } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useTheme } from '@/context/ThemeContext'
import { extractApiErrorMessage, siteSettingsApi } from '@/lib/api'
import { DEFAULT_SITE_SETTINGS } from '@/lib/siteSettings'
import type { SiteSettings } from '@/types'

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<'general' | 'notification' | 'payment' | 'appearance'>('general')
  const [generalSettings, setGeneralSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS)
  const [isLoadingGeneral, setIsLoadingGeneral] = useState(true)
  const [isSavingGeneral, setIsSavingGeneral] = useState(false)
  const [generalError, setGeneralError] = useState('')
  const [generalMessage, setGeneralMessage] = useState('')
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    let isMounted = true

    const loadGeneralSettings = async () => {
      try {
        const data = await siteSettingsApi.admin()
        if (!isMounted) return
        setGeneralSettings(data)
        setGeneralError('')
      } catch (error) {
        if (!isMounted) return
        setGeneralSettings(DEFAULT_SITE_SETTINGS)
        setGeneralError(extractApiErrorMessage(error, 'Không thể tải cài đặt chung.'))
      } finally {
        if (isMounted) {
          setIsLoadingGeneral(false)
        }
      }
    }

    void loadGeneralSettings()
    return () => {
      isMounted = false
    }
  }, [])

  function updateGeneralField<K extends keyof SiteSettings>(field: K, value: SiteSettings[K]) {
    setGeneralSettings((current) => ({ ...current, [field]: value }))
  }

  async function handleSaveGeneralSettings() {
    setIsSavingGeneral(true)
    setGeneralError('')
    setGeneralMessage('')

    try {
      const saved = await siteSettingsApi.update(generalSettings)
      setGeneralSettings(saved)
      setGeneralMessage('Đã lưu cài đặt chung thành công.')
    } catch (error) {
      setGeneralError(extractApiErrorMessage(error, 'Không thể lưu cài đặt chung.'))
    } finally {
      setIsSavingGeneral(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold admin-text-body">Cài đặt hệ thống</h2>
        <p className="mt-1 text-gray-400">Quản lý cấu hình và tùy chỉnh nền tảng</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <Card className="h-fit lg:col-span-1">
          <CardContent className="space-y-1 p-3 pt-6">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all ${
                activeTab === 'general'
                  ? 'border border-brand-red/20 bg-brand-red/10 text-brand-red'
                  : 'text-gray-500 hover:bg-[var(--admin-bg-opt)] hover:admin-text-body'
              }`}
            >
              <span className="flex items-center gap-3">
                <Settings className="h-5 w-5" />
                Chung
              </span>
            </button>
            <button
              onClick={() => setActiveTab('notification')}
              className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all ${
                activeTab === 'notification'
                  ? 'border border-brand-red/20 bg-brand-red/10 text-brand-red'
                  : 'text-gray-500 hover:bg-[var(--admin-bg-opt)] hover:admin-text-body'
              }`}
            >
              <span className="flex items-center gap-3">
                <Bell className="h-5 w-5" />
                Thông báo
              </span>
            </button>
            <button
              onClick={() => setActiveTab('payment')}
              className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all ${
                activeTab === 'payment'
                  ? 'border border-brand-red/20 bg-brand-red/10 text-brand-red'
                  : 'text-gray-500 hover:bg-[var(--admin-bg-opt)] hover:admin-text-body'
              }`}
            >
              <span className="flex items-center gap-3">
                <CreditCard className="h-5 w-5" />
                Thanh toán
              </span>
            </button>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all ${
                activeTab === 'appearance'
                  ? 'border border-brand-red/20 bg-brand-red/10 text-brand-red'
                  : 'text-gray-500 hover:bg-[var(--admin-bg-opt)] hover:admin-text-body'
              }`}
            >
              <span className="flex items-center gap-3">
                <Palette className="h-5 w-5" />
                Giao diện
              </span>
            </button>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-3">
          {activeTab === 'general' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-brand-red" />
                  Cài đặt chung
                </CardTitle>
                <CardDescription>Cấu hình thông tin sẽ được hiển thị ở footer customer.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium admin-text-body">Tên hệ thống</label>
                    <Input
                      placeholder="TicketRush"
                      value={generalSettings.site_name}
                      onChange={(event) => updateGeneralField('site_name', event.target.value)}
                      disabled={isLoadingGeneral || isSavingGeneral}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium admin-text-body">Email liên hệ</label>
                    <Input
                      type="email"
                      placeholder="contact@ticketrush.com"
                      value={generalSettings.contact_email}
                      onChange={(event) => updateGeneralField('contact_email', event.target.value)}
                      disabled={isLoadingGeneral || isSavingGeneral}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium admin-text-body">Số điện thoại</label>
                    <Input
                      type="tel"
                      placeholder="+84 123 456 789"
                      value={generalSettings.contact_phone}
                      onChange={(event) => updateGeneralField('contact_phone', event.target.value)}
                      disabled={isLoadingGeneral || isSavingGeneral}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium admin-text-body">Website</label>
                    <Input
                      type="url"
                      placeholder="https://ticketrush.com"
                      value={generalSettings.website}
                      onChange={(event) => updateGeneralField('website', event.target.value)}
                      disabled={isLoadingGeneral || isSavingGeneral}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium admin-text-body">Địa chỉ</label>
                  <Input
                    placeholder="Nhập địa chỉ"
                    value={generalSettings.address}
                    onChange={(event) => updateGeneralField('address', event.target.value)}
                    disabled={isLoadingGeneral || isSavingGeneral}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium admin-text-body">Mô tả</label>
                  <textarea
                    className="admin-bg-listbox admin-text-body w-full rounded-lg border border-gray-500 px-4 py-2.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red disabled:cursor-not-allowed disabled:opacity-50"
                    rows={3}
                    value={generalSettings.description}
                    onChange={(event) => updateGeneralField('description', event.target.value)}
                    disabled={isLoadingGeneral || isSavingGeneral}
                  />
                </div>

                {generalError ? <p className="text-sm font-medium text-amber-400">{generalError}</p> : null}
                {generalMessage ? <p className="text-sm font-medium text-emerald-400">{generalMessage}</p> : null}

                <div className="flex justify-end">
                  <Button variant="primary" onClick={() => void handleSaveGeneralSettings()} disabled={isLoadingGeneral || isSavingGeneral}>
                    <Save className="h-4 w-4" />
                    {isSavingGeneral ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

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
                  <div className="flex flex-col gap-3 rounded-lg border border-gray-500 bg-space-700/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-yellow" />
                      <div>
                        <p className="font-medium admin-text-body">Thông báo qua email</p>
                        <p className="text-xs text-gray-500">Gửi email khi có đơn mới</p>
                      </div>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" defaultChecked className="peer sr-only" />
                      <div className="h-6 w-11 rounded-full bg-white/10 peer-checked:bg-green-500 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white" />
                    </label>
                  </div>

                  <div className="flex flex-col gap-3 rounded-lg border border-gray-500 bg-space-700/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <Bell className="h-5 w-5 text-green-400" />
                      <div>
                        <p className="font-medium admin-text-body">Thông báo đẩy</p>
                        <p className="text-xs text-gray-400">Hiển thị thông báo trên trình duyệt</p>
                      </div>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" defaultChecked className="peer sr-only" />
                      <div className="h-6 w-11 rounded-full bg-white/10 peer-checked:bg-green-500 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white" />
                    </label>
                  </div>

                  <div className="flex flex-col gap-3 rounded-lg border border-gray-500 bg-space-700/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-blue-400" />
                      <div>
                        <p className="font-medium admin-text-body">Thông báo SMS</p>
                        <p className="text-xs text-gray-400">Gửi SMS xác nhận</p>
                      </div>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" className="peer sr-only" />
                      <div className="h-6 w-11 rounded-full bg-white/10 peer-checked:bg-green-500 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white" />
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
                  <div className="flex flex-col gap-3 rounded-lg border border-gray-500 bg-space-700/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                        <CreditCard className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium admin-text-body">Thanh toán bằng thẻ</p>
                        <p className="text-xs text-gray-400">Visa, Mastercard, JCB</p>
                      </div>
                    </div>
                    <Badge variant="success">Đã kích hoạt</Badge>
                  </div>

                  <div className="flex flex-col gap-3 rounded-lg border border-gray-500 bg-space-700/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
                        <Globe className="h-5 w-5 text-green-400" />
                      </div>
                      <div>
                        <p className="font-medium admin-text-body">Chuyển khoản ngân hàng</p>
                        <p className="text-xs text-gray-400">Vietcombank, Techcombank, BIDV</p>
                      </div>
                    </div>
                    <Badge variant="success">Đã kích hoạt</Badge>
                  </div>

                  <div className="flex flex-col gap-3 rounded-lg border border-gray-500 bg-space-700/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                        <Shield className="h-5 w-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="font-medium admin-text-body">Ví điện tử</p>
                        <p className="text-xs text-gray-400">MoMo, ZaloPay, VNPay</p>
                      </div>
                    </div>
                    <Badge variant="default">Chưa kích hoạt</Badge>
                  </div>
                </div>

                <div className="border-t border-gray-500 pt-4">
                  <h4 className="mb-4 text-sm font-medium admin-text-body">Cấu hình API thanh toán</h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-500">API Key</label>
                      <Input type="password" placeholder="********" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-500">Secret Key</label>
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

          {activeTab === 'appearance' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-brand-red" />
                  Tùy chỉnh giao diện
                </CardTitle>
                <CardDescription>Tùy chỉnh màu sắc giao diện hệ thống</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <label className="block text-sm font-bold uppercase tracking-wider text-slate-500">Chế độ</label>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <button
                      onClick={() => setTheme('dark')}
                      className={`relative rounded-xl border p-6 transition-all duration-200 ${
                        theme === 'dark'
                          ? 'border-red-500/30 bg-gradient-to-br from-red-500/20 to-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                          : 'border-gray-500 bg-surface-variant hover:border-primary'
                      }`}
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <Moon className={`h-6 w-6 ${theme === 'dark' ? 'text-red-400' : 'text-slate-500'}`} />
                        <span className={`text-lg font-bold ${theme === 'dark' ? 'text-on-background' : 'text-on-surface-variant'}`}>
                          Dark Mode
                        </span>
                      </div>
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-on-surface-variant'}`}>
                        Chế độ ban đêm, bảo vệ mắt tốt
                      </p>
                      {theme === 'dark' && (
                        <div className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-red-500">
                          <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>

                    <button
                      onClick={() => setTheme('light')}
                      className={`relative rounded-xl border p-6 transition-all duration-200 ${
                        theme === 'light'
                          ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/20 to-amber-500/5 shadow-[0_0_20px_rgba(251,191,36,0.15)]'
                          : 'border-gray-500 bg-surface-variant hover:border-secondary'
                      }`}
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <Sun className={`h-6 w-6 ${theme === 'light' ? 'text-amber-400' : 'text-slate-500'}`} />
                        <span className={`text-lg font-bold ${theme === 'light' ? 'text-on-background' : 'text-on-surface-variant'}`}>
                          Light Mode
                        </span>
                      </div>
                      <p className={`text-sm ${theme === 'light' ? 'text-slate-300' : 'text-on-surface-variant'}`}>
                        Chế độ ban ngày, độ sáng mặc định
                      </p>
                      {theme === 'light' && (
                        <div className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500">
                          <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-500 bg-surface-variant p-4">
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
  )
}
