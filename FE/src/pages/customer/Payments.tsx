import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CustomerSidebar } from '@/components/layout/CustomerSidebar'
import { Navbar } from '@/components/layout/Navbar'
import { useAuth } from '@/context/AuthContext'
import { CreditCard, Menu, Plus, Shield, Trash2, X } from 'lucide-react'

interface PaymentMethod {
  id: number
  type: 'visa' | 'mastercard' | 'paypal' | 'bank'
  cardNumber?: string
  cardHolder?: string
  expiryDate?: string
  isDefault: boolean
}

const MOCK_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 1,
    type: 'visa',
    cardNumber: '**** **** **** 4242',
    cardHolder: 'ALEX VOYAGER',
    expiryDate: '12/26',
    isDefault: true,
  },
  {
    id: 2,
    type: 'mastercard',
    cardNumber: '**** **** **** 8888',
    cardHolder: 'ALEX VOYAGER',
    expiryDate: '08/25',
    isDefault: false,
  },
  {
    id: 3,
    type: 'paypal',
    isDefault: false,
  },
]

export default function Payments() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(MOCK_PAYMENT_METHODS)
  const [showAddModal, setShowAddModal] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

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
    if (tab === 'favourites') return navigate('/favourites') 
    if (tab === 'payments') return navigate('/payments')  
    if (tab === "settings") return navigate('/settings') 
    if (tab === 'help') return navigate('/help')  
    if (tab === 'logout') {
      logout()
      return navigate('/')
    }
  }

  const handleSetDefault = (id: number) => {
    setPaymentMethods(
      paymentMethods.map((method) => ({
        ...method,
        isDefault: method.id === id,
      }))
    )
  }

  const handleRemove = (id: number) => {
    const confirmed = window.confirm('Are you sure you want to remove this payment method?')
    if (confirmed) {
      setPaymentMethods(paymentMethods.filter((method) => method.id !== id))
    }
  }

  const getCardIcon = (type: string) => {
    switch (type) {
      case 'visa':
        return 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg'
      case 'mastercard':
        return 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg'
      case 'paypal':
        return 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg'
      default:
        return undefined
    }
  }

  return (
    <>
      <Navbar />
      <div className="pt-[80px] min-h-screen bg-background flex">
        <div className="hidden lg:block">
          <CustomerSidebar
            activeTab="payments"
            userName={user?.full_name ?? 'Customer'}
            membershipLevel="Stellar Member"
            onNavigate={onSidebarNavigate}
          />
        </div>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
            <CustomerSidebar
              activeTab="payments"
              userName={user?.full_name ?? 'Customer'}
              membershipLevel="Stellar Member"
              onNavigate={onSidebarNavigate}
              className="relative"
            />
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-12 max-w-5xl mx-auto">
          <button className="lg:hidden mb-4 p-2 rounded bg-surface-container" onClick={() => setDrawerOpen((v) => !v)}>
            {drawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <header className="mb-10">
            <h1 className="text-3xl sm:text-5xl font-black text-on-background font-headline tracking-tighter">
              Payment Methods
            </h1>
            <p className="text-on-surface-variant mt-2 max-w-lg">
              Manage your saved payment methods for quick and secure checkout.
            </p>
          </header>

          {/* Add New Payment Method Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full md:w-auto mb-8 flex items-center gap-3 px-6 py-4 bg-surface-container-high border border-white/10 rounded-xl hover:bg-surface-container-highest transition-all group"
          >
            <Plus className="w-5 h-5 text-primary group-hover:text-primary-container transition-colors" />
            <span className="font-bold text-on-surface-variant group-hover:text-on-surface transition-colors">
              Add New Payment Method
            </span>
          </button>

          {/* Payment Methods List */}
          <div className="space-y-4">
            {paymentMethods.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant">
                <CreditCard className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-bold">No payment methods saved.</p>
                <p className="text-sm mt-2">Add a payment method to make checkout faster!</p>
              </div>
            ) : (
              paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className={`glass-panel rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                    method.isDefault ? 'border-primary/30 shadow-[0_0_15px_rgba(252,83,109,0.1)]' : ''
                  }`}
                >
                  {/* Card Info */}
                  <div className="flex items-center gap-4">
                    {method.type === 'paypal' ? (
                      <div className="w-16 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <img
                          src={getCardIcon('paypal')}
                          alt="PayPal"
                          className="h-6 object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-12 bg-surface-container-high rounded-lg flex items-center justify-center">
                        <img
                          src={getCardIcon(method.type)}
                          alt={method.type}
                          className="h-6 object-contain"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      {method.type === 'paypal' ? (
                        <>
                          <p className="text-on-background font-bold">PayPal Account</p>
                          <p className="text-on-surface-variant text-sm">Linked PayPal account</p>
                        </>
                      ) : (
                        <>
                          <p className="text-on-background font-bold capitalize">{method.type}</p>
                          <p className="text-on-surface-variant text-sm">{method.cardNumber}</p>
                          <p className="text-on-surface-variant text-xs">
                            Card Holder: {method.cardHolder} • Expires: {method.expiryDate}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-3">
                    {method.isDefault && (
                      <span className="px-3 py-1 bg-primary/20 text-primary text-xs font-bold uppercase tracking-widest rounded-full flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        Default
                      </span>
                    )}

                    {!method.isDefault && (
                      <button
                        onClick={() => handleSetDefault(method.id)}
                        className="px-4 py-2 bg-surface-container-high text-on-surface-variant text-sm font-bold rounded-lg hover:bg-primary/20 hover:text-primary transition-colors"
                      >
                        Set as Default
                      </button>
                    )}

                    <button
                      onClick={() => handleRemove(method.id)}
                      className="p-2 text-on-surface-variant hover:text-error transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Security Notice */}
          <div className="mt-8 p-6 bg-surface-container/50 border border-white/5 rounded-xl">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-on-background font-bold text-sm mb-1">Secure Payment Processing</h4>
                <p className="text-on-surface-variant text-xs">
                  Your payment information is encrypted and securely stored. We never store your full
                  card number on our servers. All transactions are processed through PCI-DSS compliant
                  payment processors.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Add Payment Modal - Placeholder */}
      {showAddModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl p-8 max-w-md w-full relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-background"
            >
              ✕
            </button>
            <h3 className="text-2xl font-black text-on-background font-headline mb-6">
              Add Payment Method
            </h3>
            <p className="text-on-surface-variant text-sm mb-6">
              Payment method integration coming soon. This feature will allow you to securely add
              credit cards, debit cards, and digital wallets.
            </p>
            <button
              onClick={() => setShowAddModal(false)}
              className="w-full bg-primary-container text-on-primary-container py-3 rounded-xl font-bold uppercase tracking-widest hover:shadow-[0_0_15px_rgba(252,83,109,0.4)] transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
