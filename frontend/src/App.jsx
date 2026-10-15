import { useState, useEffect, useCallback } from 'react'
import { api } from './api'
import Icon from './components/Icon'
import LoginView from './components/LoginView'
import Dashboard from './components/Dashboard'

const ERROR_TIMEOUT_MS = 6000

// Credentials saved with "Remember me" (base64 is obfuscation, not encryption)
const saveCredentials = (email, password, remember) => {
  if (remember) {
    localStorage.setItem('delonghi_email', email)
    localStorage.setItem('delonghi_password', btoa(password))
    localStorage.setItem('delonghi_remember', 'true')
  } else {
    clearCredentials()
  }
}

const clearCredentials = () => {
  localStorage.removeItem('delonghi_email')
  localStorage.removeItem('delonghi_password')
  localStorage.removeItem('delonghi_remember')
}

const loadCredentials = () => {
  try {
    if (localStorage.getItem('delonghi_remember') === 'true') {
      return {
        email: localStorage.getItem('delonghi_email') || '',
        password: atob(localStorage.getItem('delonghi_password') || ''),
        remember: true
      }
    }
  } catch {
    clearCredentials()
  }
  return { email: '', password: '', remember: false }
}

function App() {
  // 'checking' -> 'login' | 'ready'
  const [phase, setPhase] = useState('checking')
  const [saved] = useState(loadCredentials)
  const [loginLoading, setLoginLoading] = useState(false)
  const [devices, setDevices] = useState([])
  const [selectedDsn, setSelectedDsn] = useState(null)
  const [error, setError] = useState(null)

  const showError = useCallback((message) => setError(message), [])

  useEffect(() => {
    if (!error) return
    const timeout = setTimeout(() => setError(null), ERROR_TIMEOUT_MS)
    return () => clearTimeout(timeout)
  }, [error])

  const loadDevices = async () => {
    const list = await api('/devices')
    setDevices(list)
    setSelectedDsn(list[0]?.dsn ?? null)
    setPhase('ready')
  }

  const login = async ({ email, password }) => {
    await api('/login', { method: 'POST', body: { email, password } })
    await loadDevices()
  }

  // On start: reuse the backend session, or log in with the saved credentials
  useEffect(() => {
    const init = async () => {
      try {
        const status = await api('/auth/status')
        if (status.authenticated) {
          await loadDevices()
          return
        }
        if (saved.remember && saved.email && saved.password) {
          setLoginLoading(true)
          await login(saved)
          return
        }
      } catch (err) {
        setError(err.status ? err.message : 'Cannot reach the server')
      } finally {
        setLoginLoading(false)
      }
      setPhase('login')
    }
    init()
    // Runs once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogin = async (credentials) => {
    setLoginLoading(true)
    setError(null)
    try {
      await login(credentials)
      saveCredentials(credentials.email, credentials.password, credentials.remember)
    } catch (err) {
      setError(err.status ? err.message : 'Cannot reach the server')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await api('/logout', { method: 'POST' })
    } catch (err) {
      console.error('Logout error:', err)
    }
    clearCredentials()
    setDevices([])
    setSelectedDsn(null)
    setPhase('login')
  }

  const selectedDevice = devices.find(d => d.dsn === selectedDsn)

  return (
    <div className="app">
      {error && (
        <div className="toast" role="alert">
          <Icon name="alert" size={18} />
          <span>{error}</span>
          <button className="toast-close" onClick={() => setError(null)} aria-label="Dismiss">
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {phase === 'checking' ? (
        <div className="splash">
          <div className="spinner" />
          <p>{loginLoading ? 'Signing in...' : 'Connecting...'}</p>
        </div>
      ) : phase === 'login' ? (
        <LoginView initial={saved} loading={loginLoading} onLogin={handleLogin} />
      ) : !selectedDevice ? (
        <div className="empty">
          <h2>No devices found</h2>
          <p>Make sure your dehumidifier is set up in the De&apos;Longhi Comfort app.</p>
          <button className="btn btn-secondary" onClick={handleLogout}>Sign out</button>
        </div>
      ) : (
        <Dashboard
          devices={devices}
          device={selectedDevice}
          onSelectDevice={setSelectedDsn}
          onLogout={handleLogout}
          onError={showError}
        />
      )}
    </div>
  )
}

export default App
