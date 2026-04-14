import { type FormEvent, useEffect, useState } from 'react'

import { useAuth } from '../hooks/useAuth'
import type { Gender } from '../types'

export function MyAccountPage() {
  const { user, updateProfile } = useAuth()

  const [fullName, setFullName] = useState('')
  const [gender, setGender] = useState<Gender>('other')
  const [age, setAge] = useState(18)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setFullName(user.full_name)
    setGender(user.gender)
    setAge(user.age)
  }, [user])

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      await updateProfile({ full_name: fullName.trim(), gender, age })
      setMessage('Profile updated successfully.')
    } catch {
      setMessage('Failed to update profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page app-container">
      <header className="section-head section-head--hero">
        <h1>My Account</h1>
        <p>Update your personal information used for ticketing and analytics.</p>
      </header>

      <section className="panel profile-panel">
        <form className="auth-form" onSubmit={handleSave}>
          <label>
            Full Name
            <input
              required
              minLength={2}
              maxLength={120}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </label>

          <div className="auth-grid">
            <label>
              Gender
              <select value={gender} onChange={(event) => setGender(event.target.value as Gender)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label>
              Age
              <input type="number" min={10} max={100} value={age} onChange={(event) => setAge(Number(event.target.value))} />
            </label>
          </div>

          <label>
            Email
            <input value={user?.email ?? ''} disabled />
          </label>

          {message && <p className="state-text">{message}</p>}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </section>
    </main>
  )
}
