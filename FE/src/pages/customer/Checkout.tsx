import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { CreditCard, Wallet, Building2, QrCode, Timer, Rocket } from 'lucide-react'

export default function Checkout() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    termsAccepted: false
  })

  const [selectedPayment, setSelectedPayment] = useState('card')

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle checkout logic here
    console.log('Checkout data:', { ...formData, paymentMethod: selectedPayment })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white font-body">
      <Navbar />

      <main className="max-w-screen-2xl mx-auto px-6 py-12">
        {/* Progress Stepper */}
        <div className="flex items-center justify-center mb-16 space-x-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-xs font-headline font-bold">01</div>
            <span className="text-xs font-headline uppercase tracking-widest text-slate-500">Selection</span>
          </div>
          <div className="w-16 h-px bg-white/10"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary text-xs font-headline font-bold shadow-[0_0_15px_rgba(255,178,183,0.4)]">02</div>
            <span className="text-xs font-headline uppercase tracking-widest text-primary font-bold">Checkout</span>
          </div>
          <div className="w-16 h-px bg-white/10"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-slate-600 text-xs font-headline font-bold">03</div>
            <span className="text-xs font-headline uppercase tracking-widest text-slate-600">Confirmation</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left: Payment Details */}
          <div className="lg:col-span-7 space-y-10">
            <section>
              <h2 className="text-3xl font-headline font-bold tracking-tight mb-8">Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-headline uppercase tracking-[0.2em] text-slate-400 font-bold">Full Name</label>
                  <Input
                    className="w-full bg-slate-800 border-none rounded-xl py-4 px-5 text-white focus:ring-1 focus:ring-primary transition-all placeholder:text-slate-600"
                    placeholder="Johnathan Doe"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-headline uppercase tracking-[0.2em] text-slate-400 font-bold">Email Address</label>
                  <Input
                    type="email"
                    className="w-full bg-slate-800 border-none rounded-xl py-4 px-5 text-white focus:ring-1 focus:ring-primary transition-all placeholder:text-slate-600"
                    placeholder="john@nebula.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-[10px] font-headline uppercase tracking-[0.2em] text-slate-400 font-bold">Phone Number</label>
                  <Input
                    type="tel"
                    className="w-full bg-slate-800 border-none rounded-xl py-4 px-5 text-white focus:ring-1 focus:ring-primary transition-all placeholder:text-slate-600"
                    placeholder="+84 900 000 000"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-3xl font-headline font-bold tracking-tight mb-8">Payment Method</h2>
              <div className="grid grid-cols-3 gap-4 mb-8">
                <button
                  onClick={() => setSelectedPayment('card')}
                  className={`backdrop-blur-xl p-4 rounded-xl flex flex-col items-center gap-3 border transition-all ${
                    selectedPayment === 'card'
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-white/5 hover:bg-white/5'
                  }`}
                >
                  <CreditCard className={`text-3xl ${selectedPayment === 'card' ? 'text-primary' : 'text-slate-400'}`} />
                  <span className={`text-[10px] font-headline font-bold uppercase tracking-widest ${
                    selectedPayment === 'card' ? 'text-primary' : 'text-slate-400'
                  }`}>Card</span>
                </button>
                <button
                  onClick={() => setSelectedPayment('momo')}
                  className={`backdrop-blur-xl p-4 rounded-xl flex flex-col items-center gap-3 border transition-all ${
                    selectedPayment === 'momo'
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-white/5 hover:bg-white/5 grayscale hover:grayscale-0'
                  }`}
                >
                  <Wallet className={`text-3xl ${selectedPayment === 'momo' ? 'text-primary' : 'text-slate-400'}`} />
                  <span className={`text-[10px] font-headline font-bold uppercase tracking-widest ${
                    selectedPayment === 'momo' ? 'text-primary' : 'text-slate-400'
                  }`}>MoMo</span>
                </button>
                <button
                  onClick={() => setSelectedPayment('transfer')}
                  className={`backdrop-blur-xl p-4 rounded-xl flex flex-col items-center gap-3 border transition-all ${
                    selectedPayment === 'transfer'
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-white/5 hover:bg-white/5 grayscale hover:grayscale-0'
                  }`}
                >
                  <Building2 className={`text-3xl ${selectedPayment === 'transfer' ? 'text-primary' : 'text-slate-400'}`} />
                  <span className={`text-[10px] font-headline font-bold uppercase tracking-widest ${
                    selectedPayment === 'transfer' ? 'text-primary' : 'text-slate-400'
                  }`}>Transfer</span>
                </button>
              </div>

              {selectedPayment === 'card' && (
                <div className="backdrop-blur-xl bg-slate-900/80 p-8 rounded-2xl space-y-6 border border-white/10">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-headline uppercase tracking-[0.2em] text-slate-400 font-bold">Card Number</label>
                    <div className="relative">
                      <Input
                        className="w-full bg-slate-800/50 border-none rounded-xl py-4 px-5 text-white focus:ring-1 focus:ring-primary transition-all placeholder:text-slate-600 tracking-widest"
                        placeholder="0000 0000 0000 0000"
                        value={formData.cardNumber}
                        onChange={(e) => handleInputChange('cardNumber', e.target.value)}
                      />
                      <CreditCard className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 h-5 w-5" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-headline uppercase tracking-[0.2em] text-slate-400 font-bold">Expiry Date</label>
                      <Input
                        className="w-full bg-slate-800/50 border-none rounded-xl py-4 px-5 text-white focus:ring-1 focus:ring-primary transition-all placeholder:text-slate-600"
                        placeholder="MM/YY"
                        value={formData.expiryDate}
                        onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-headline uppercase tracking-[0.2em] text-slate-400 font-bold">CVV Code</label>
                      <Input
                        type="password"
                        className="w-full bg-slate-800/50 border-none rounded-xl py-4 px-5 text-white focus:ring-1 focus:ring-primary transition-all placeholder:text-slate-600"
                        placeholder="***"
                        value={formData.cvv}
                        onChange={(e) => handleInputChange('cvv', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>

            <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
              <input
                className="mt-1 rounded bg-slate-800 border-white/10 text-primary focus:ring-primary"
                id="terms"
                type="checkbox"
                checked={formData.termsAccepted}
                onChange={(e) => handleInputChange('termsAccepted', e.target.checked)}
              />
              <label className="text-sm text-slate-400 leading-relaxed" htmlFor="terms">
                I agree to the <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link> and <Link to="/refund" className="text-primary hover:underline">Refund Policy</Link>. I understand that tickets for this interstellar event are non-transferable 48 hours before launch.
              </label>
            </div>
          </div>

          {/* Right: Order Summary */}
          <aside className="lg:col-span-5 sticky top-28">
            <div className="backdrop-blur-xl bg-slate-900/80 p-8 rounded-3xl overflow-hidden relative border border-white/10">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/10 blur-[60px] rounded-full"></div>
              <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-secondary/10 blur-[60px] rounded-full"></div>
              <h3 className="text-xl font-headline font-bold uppercase tracking-widest mb-8 border-b border-white/5 pb-4">Order Summary</h3>

              {/* Ticket Micro-View */}
              <div className="flex gap-6 mb-8 items-center">
                <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0">
                  <img
                    alt="Event preview"
                    className="w-full h-full object-cover"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBvrllkXL8XtBTf2Wd2tomI2iiaGXTItQbaQCgwK1efF-cQQAFXAdrk2pZTbjZXNpa26F3MMRKyd-k2wsMNmrEcUMEoSO-J-4l9Ms2KQBSXt-npd9EzKoIX0BLxLREGCMqwB4ikJt2_mWbQGy2rbHdnpmIz_ZYDMhS46yJXjxxQqzjj9PjsDFQkri1yZKmJ6Oj_dUHSTv3IvnuawIKjO0hZMwJ6-iJKFfCrEjiE_SuDfmkcUswKOOWKpopCJj0KKk0_k11GUl921Vw"
                  />
                </div>
                <div>
                  <p className="text-secondary font-headline font-bold uppercase text-[10px] tracking-[0.2em] mb-1">Electronic Voyage</p>
                  <h4 className="text-lg font-headline font-bold leading-tight">Nebula Sound-Waves Festival 2024</h4>
                  <p className="text-slate-400 text-sm mt-1">Section A, Row 12 • GA Floor</p>
                </div>
              </div>

              <div className="space-y-4 mb-10">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Subtotal (2 Tickets)</span>
                  <span className="text-white">₫1,200,000</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Service Fee</span>
                  <span className="text-white">₫45,000</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Processing Tax</span>
                  <span className="text-white">₫5,000</span>
                </div>
                <div className="pt-4 border-t border-white/5 mt-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-[10px] font-headline font-black uppercase tracking-[0.3em] text-slate-500">Total Amount</span>
                      <p className="text-4xl font-headline font-black text-white mt-1">₫1,250,000</p>
                    </div>
                    <div className="bg-white p-2 rounded-lg">
                      <div className="w-16 h-16 bg-slate-100 flex items-center justify-center">
                        <QrCode className="text-slate-900 text-3xl" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                className="w-full py-6 rounded-2xl bg-gradient-to-r from-primary to-primary-container text-on-primary-container font-headline font-black uppercase tracking-widest text-lg shadow-[0_0_30px_rgba(252,83,109,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                disabled={!formData.termsAccepted}
              >
                Complete Purchase
                <Rocket className="h-6 w-6" />
              </Button>
              <p className="text-center text-[10px] text-slate-500 font-headline uppercase tracking-[0.2em] mt-6">
                Secure SSL Encrypted Checkout
              </p>
            </div>

            {/* Urgency Indicator */}
            <div className="mt-6 flex items-center gap-4 bg-secondary/5 border border-secondary/20 p-4 rounded-2xl">
              <Timer className="text-secondary h-5 w-5" />
              <p className="text-xs text-secondary font-medium">
                These tickets are held for <span className="font-bold underline">08:44</span>. Complete payment before the session expires.
              </p>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
