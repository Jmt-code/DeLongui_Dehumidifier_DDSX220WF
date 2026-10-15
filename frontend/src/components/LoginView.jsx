import { useState } from 'react'
import Icon from './Icon'

function LoginView({ initial, loading, onLogin }) {
  const [email, setEmail] = useState(initial.email)
  const [password, setPassword] = useState(initial.password)
  const [remember, setRemember] = useState(initial.remember)

  const handleSubmit = (e) => {
    e.preventDefault()
    onLogin({ email, password, remember })
  }

  return (
    <div className="login">
      <div className="login-brand">
        <span className="login-logo"><Icon name="drop" size={32} /></span>
        <h1>De&apos;Longhi Control</h1>
        <p>Use your De&apos;Longhi Comfort app credentials</p>
      </div>

      <form className="card login-form" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Remember me
        </label>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Connecting...' : 'Connect'}
        </button>
      </form>
    </div>
  )
}

export default LoginView
