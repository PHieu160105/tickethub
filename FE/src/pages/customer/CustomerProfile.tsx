import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, X, Save } from 'lucide-react'

import { CustomerSidebar } from '@/components/layout/CustomerSidebar'
import { useAuth } from '@/context/AuthContext'
import { Calendar, Mail, User, VenusAndMars } from 'lucide-react'

function inferBirthYear(age: number) {
  return new Date().getFullYear() - age
}

function formatGenderLabel(gender: 'MALE' | 'FEMALE' | 'OTHER') {
  if (gender === 'MALE') return 'Nam'
  if (gender === 'FEMALE') return 'Nữ'
  return 'Khác'
}

export default function CustomerProfile() {
  const navigate = useNavigate()
  const { user, updateProfile, logout } = useAuth()

  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>(user?.gender ?? 'OTHER')
  const [age, setAge] = useState<number>(user?.age ?? 18)
  const [isSaving, setIsSaving] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [message, setMessage] = useState<string>('')
  const [error, setError] = useState<string>('')

  const estimatedBirthYear = useMemo(() => inferBirthYear(age), [age])

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  const onSidebarNavigate = (tab: string) => {
    setDrawerOpen(false)
    if (tab === 'tickets') return navigate('/tickets')
    if (tab === 'profile') return navigate('/profile')
    if (tab === 'settings') return navigate('/settings')
    if (tab === 'logout') {
      logout()
      return navigate('/')
    }
  }

  const handleSave = async () => {
    if (!fullName.trim()) {
      setError('Vui lòng nhập họ tên.')
      return
    }

    setIsSaving(true)
    setError('')
    setMessage('')

    try {
      await updateProfile({
        full_name: fullName.trim(),
        gender,
        age: Math.max(10, Math.min(100, age)),
      })
      setMessage('Cập nhật hồ sơ thành công.')
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Không thể cập nhật hồ sơ.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="app-theme-page pt-[35px] h-auto flex">
        <div className="hidden lg:block">
          <CustomerSidebar
            activeTab="profile"
            userName={user?.full_name ?? 'Khách hàng'}
            membershipLevel="Thành viên TicketHUb"
            onNavigate={onSidebarNavigate}
          />
        </div>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
            <CustomerSidebar
              activeTab="profile"
              userName={user?.full_name ?? 'Khách hàng'}
              membershipLevel="Thành viên TicketHub"
              onNavigate={onSidebarNavigate}
              className="relative"
            />
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-12 max-w-5xl mx-auto">
          <button className="lg:hidden mb-4 p-2 rounded bg-surface-container" onClick={() => setDrawerOpen((v) => !v)}>
            {drawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <header className="mb-6">
            <h1 className="text-3xl sm:text-5xl font-black text-on-background font-headline tracking-tighter">Hồ sơ khách hàng</h1>
            <p className="text-on-surface-variant mt-2 max-w-lg">Quản lý thông tin tài khoản của bạn.</p>
          </header>

          <div className="rounded-2xl border border-[var(--customer-bg-opp)] customer-bg-surface p-4 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Họ tên </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="w-full main-bg-page border border-gray-500 rounded-xl py-3 pl-12 pr-4 customer-text-body outline-none focus:border-[var(--customer-bg-opt)]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="email"
                    value={user?.email ?? ''}
                    readOnly
                    className="w-full main-bg-page border border-gray-500 rounded-xl py-3 pl-12 pr-4 customer-text-body outline-none focus:border-[var(--customer-bg-opt)]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Giới tính</label>
                <div className="relative">
                  <VenusAndMars className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <select
                    value={gender}
                    onChange={(event) => setGender(event.target.value as 'MALE' | 'FEMALE' | 'OTHER')}
                    className="admin-bg-listbox w-full main-bg-page border border-gray-500 rounded-xl py-3 pl-12 pr-4 customer-text-body outline-none focus:border-[var(--customer-bg-opt)] appearance-none"
                  >
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3">
                    <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tuổi</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={age}
                    onChange={(event) => setAge(Number(event.target.value) || 18)}
                    className="w-full main-bg-page border border-gray-500 rounded-xl py-3 pl-12 pr-4 customer-text-body outline-none focus:border-[var(--customer-bg-opt)]"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-[var(--customer-bg-help)] border border-gray-500 p-4 text-sm text-white">
              Thông tin hiện tại: {formatGenderLabel(gender)}, {age} tuổi - {estimatedBirthYear}
            </div>

            {error ? <p className="text-sm font-bold text-amber-300">{error}</p> : null}
            {message ? <p className="text-sm font-bold text-green-500">{message}</p> : null}

            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSave()}
              className="flex items-center gap-2 justify-end bg-primary hover:bg-primary hover:opacity-50 disabled:opacity-60 text-white font-bold py-3 px-8 rounded-xl transition-colors"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </main>
      </div>
  )
}
