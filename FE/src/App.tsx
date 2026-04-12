import './App.css'

function App() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card-glass p-8 text-center max-w-md">
        <h1 className="text-3xl font-display text-brand-yellow mb-4">
          🎫 TicketRush
        </h1>
        <p className="text-gray-300 mb-6">Tailwind v4 + Vite + React TS = ✅</p>
        <div className="flex gap-3 justify-center">
          <button className="btn-primary">Get Started</button>
          <button className="btn-secondary">Learn More</button>
        </div>
      </div>
    </div>
  )
}

export default App
