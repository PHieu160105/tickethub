import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { FormEvent } from 'react'

import { useAuth } from '../hooks/useAuth'
import { extractApiErrorMessage } from '../lib/api'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('customer@ticketrush.com')
  const [password, setPassword] = useState('Customer@123')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const redirectPath = (location.state as { from?: string } | null)?.from

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const loggedInUser = await login(email, password)
      if (loggedInUser.role === 'admin') {
        navigate('/admin/dashboard')
      } else {
        navigate(redirectPath ?? '/')
      }
    } catch (caughtError) {
      setError(extractApiErrorMessage(caughtError, 'Incorrect email or password.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Welcome Back</h1>
        <p>Sign in to continue booking and managing your tickets.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>

          <label>
            Password
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error && <p className="state-text state-text--error">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="auth-switch">
          Need an account? <Link to="/register">Create one</Link>
        </p>
      </section>
    </main>
  )
}
