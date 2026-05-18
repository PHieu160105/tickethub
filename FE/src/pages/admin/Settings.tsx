import { useEffect, useState } from 'react'
import { Moon, Palette, Save, Settings, Sun } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useTheme } from '@/context/ThemeContext'
import { extractApiErrorMessage, siteSettingsApi } from '@/lib/api'
import { DEFAULT_SITE_SETTINGS } from '@/lib/siteSettings'
import type { SiteSettings } from '@/types'

export default function AdminSettings() {
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
        <p className="mt-1 text-gray-400">Quản lý thông tin chung và giao diện nền tảng</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-brand-red" />
              Thông tin chung
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-brand-red" />
              Giao diện
            </CardTitle>
            <CardDescription>Tùy chỉnh màu sắc giao diện hệ thống.</CardDescription>
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
                      Chế độ tối
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
                      Chế độ sáng
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
