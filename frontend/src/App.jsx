import { useState, useEffect, useCallback } from 'react'
import './App.css'

const API_URL = 'http://localhost:3001/api'

// Functions to save/load credentials from localStorage
const saveCredentials = (email, password, remember) => {
  if (remember) {
    localStorage.setItem('delonghi_email', email)
    localStorage.setItem('delonghi_password', btoa(password)) // Encode in base64
    localStorage.setItem('delonghi_remember', 'true')
  } else {
    localStorage.removeItem('delonghi_email')
    localStorage.removeItem('delonghi_password')
    localStorage.removeItem('delonghi_remember')
  }
}

const loadCredentials = () => {
  const remember = localStorage.getItem('delonghi_remember') === 'true'
  if (remember) {
    return {
      email: localStorage.getItem('delonghi_email') || '',
      password: atob(localStorage.getItem('delonghi_password') || ''),
      remember: true
    }
  }
  return { email: '', password: '', remember: false }
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [devices, setDevices] = useState([])
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [deviceStatus, setDeviceStatus] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Load saved credentials on start
  useEffect(() => {
    const saved = loadCredentials()
    setEmail(saved.email)
    setPassword(saved.password)
    setRememberMe(saved.remember)
  }, [])

  // Check authentication status on load
  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/status`)
      const data = await response.json()
      setIsAuthenticated(data.authenticated)
      if (data.authenticated) {
        await loadDevices()
      }
    } catch (err) {
      console.error('Error checking auth:', err)
    } finally {
      setLoading(false)
    }
  }

  // Auto-login if credentials are saved
  useEffect(() => {
    const autoLogin = async () => {
      const saved = loadCredentials()
      if (saved.remember && saved.email && saved.password && !isAuthenticated && !loading) {
        setLoginLoading(true)
        try {
          const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: saved.email, password: saved.password })
          })
          
          if (response.ok) {
            setIsAuthenticated(true)
            await loadDevices()
          }
        } catch (err) {
          console.error('Auto-login failed:', err)
        } finally {
          setLoginLoading(false)
        }
      }
    }
    
    if (!loading && !isAuthenticated) {
      autoLogin()
    }
  }, [loading, isAuthenticated])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (response.ok) {
        // Save credentials if "Remember me" is checked
        saveCredentials(email, password, rememberMe)
        setIsAuthenticated(true)
        await loadDevices()
      } else {
        setError(data.error || 'Authentication error')
      }
    } catch (err) {
      setError('Server connection error')
    } finally {
      setLoginLoading(false)
    }
  }

  const loadDevices = async () => {
    try {
      const response = await fetch(`${API_URL}/devices`)
      const data = await response.json()

      if (response.ok) {
        setDevices(data)
        if (data.length > 0) {
          setSelectedDevice(data[0])
          await loadDeviceStatus(data[0].dsn)
        }
      }
    } catch (err) {
      console.error('Error loading devices:', err)
    }
  }

  const loadDeviceStatus = useCallback(async (dsn) => {
    try {
      const response = await fetch(`${API_URL}/devices/${dsn}/status`)
      const data = await response.json()

      if (response.ok) {
        setDeviceStatus(data)
      }
    } catch (err) {
      console.error('Error loading status:', err)
    }
  }, [])

  // Update status every 10 seconds
  useEffect(() => {
    if (selectedDevice) {
      const interval = setInterval(() => {
        loadDeviceStatus(selectedDevice.dsn)
      }, 10000)
      return () => clearInterval(interval)
    }
  }, [selectedDevice, loadDeviceStatus])

  const togglePower = async () => {
    if (!selectedDevice || actionLoading) return

    setActionLoading(true)
    const action = deviceStatus?.isOn ? 'off' : 'on'

    try {
      const response = await fetch(`${API_URL}/devices/${selectedDevice.dsn}/${action}`, {
        method: 'POST'
      })

      if (response.ok) {
        // Wait a moment and update status
        setTimeout(() => {
          loadDeviceStatus(selectedDevice.dsn)
        }, 1000)
      }
    } catch (err) {
      setError('Error changing power state')
    } finally {
      setActionLoading(false)
    }
  }

  const changeMode = async (mode) => {
    if (!selectedDevice || actionLoading) return

    setActionLoading(true)

    try {
      const response = await fetch(`${API_URL}/devices/${selectedDevice.dsn}/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      })

      if (response.ok) {
        setTimeout(() => {
          loadDeviceStatus(selectedDevice.dsn)
        }, 1000)
      }
    } catch (err) {
      setError('Error changing mode')
    } finally {
      setActionLoading(false)
    }
  }

  const changeHumidity = async (humidity) => {
    if (!selectedDevice) return

    try {
      await fetch(`${API_URL}/devices/${selectedDevice.dsn}/humidity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ humidity: parseInt(humidity) })
      })
    } catch (err) {
      console.error('Error setting humidity:', err)
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setDevices([])
    setSelectedDevice(null)
    setDeviceStatus(null)
    // Don't clear email/password if remembering
    if (!rememberMe) {
      setEmail('')
      setPassword('')
    }
    // Clear saved credentials
    localStorage.removeItem('delonghi_email')
    localStorage.removeItem('delonghi_password')
    localStorage.removeItem('delonghi_remember')
    setRememberMe(false)
  }

  const getModeIcon = (mode) => {
    switch (mode) {
      case 1: return '💧'
      case 2: return '👕'
      case 3: return '🌬️'
      default: return '❓'
    }
  }

  const getModeName = (mode) => {
    switch (mode) {
      case 1: return 'Dehumidify'
      case 2: return 'Dry Clothes'
      case 3: return 'Purifier'
      default: return 'Unknown'
    }
  }

  if (loading) {
    return (
      <div className="app">
        <div className="loading">
          <div className="spinner"></div>
          <p className="loading-text">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🌡️ De&apos;Longhi Control</h1>
        <p>Tasciugo AriaDry DDSX220WFA</p>
      </header>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {!isAuthenticated ? (
        <div className="card login-card">
          <h2>🔐 Sign In</h2>
          <p style={{ color: '#666', marginBottom: '20px', fontSize: '0.9rem' }}>
            Use your De&apos;Longhi Comfort app credentials
          </p>
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="checkmark"></span>
                Remember me
              </label>
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loginLoading}
            >
              {loginLoading ? 'Connecting...' : 'Connect'}
            </button>
          </form>
        </div>
      ) : devices.length === 0 ? (
        <div className="card">
          <div className="no-devices">
            <div className="no-devices-icon">📱</div>
            <h3>No devices found</h3>
            <p>Make sure your dehumidifier is set up in the De&apos;Longhi Comfort app</p>
          </div>
        </div>
      ) : (
        <>
          {selectedDevice && (
            <div className="card device-card">
              <div className="device-info">
                <div className="device-name">{selectedDevice.productName || 'Dehumidifier'}</div>
                <div className="device-model">{selectedDevice.model || 'DDSX220WFA'}</div>
                <div className={`connection-status ${selectedDevice.connectionStatus === 'Online' ? 'online' : 'offline'}`}>
                  <span className="status-dot"></span>
                  {selectedDevice.connectionStatus || 'Unknown'}
                </div>
              </div>

              {deviceStatus?.tankFull && (
                <div className="alert alert-warning">
                  <span className="alert-icon">🪣</span>
                  <span>The water tank is full. Empty it to continue.</span>
                </div>
              )}

              <div className="power-section">
                <button
                  className={`power-button ${deviceStatus?.isOn ? 'on' : ''}`}
                  onClick={togglePower}
                  disabled={actionLoading}
                >
                  <span className="power-icon">⏻</span>
                </button>
                <div className="power-label">
                  {actionLoading ? 'Processing...' : deviceStatus?.isOn ? 'ON' : 'OFF'}
                </div>
              </div>

              {deviceStatus && (
                <>
                  <div className="stats-grid">
                    <div className="stat-item">
                      <div className="stat-icon">💧</div>
                      <div className="stat-value">{deviceStatus.humidity || '--'}%</div>
                      <div className="stat-label">Current Humidity</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-icon">🌡️</div>
                      <div className="stat-value">{deviceStatus.temperature || '--'}°C</div>
                      <div className="stat-label">Temperature</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-icon">🎯</div>
                      <div className="stat-value">{deviceStatus.targetHumidity || '--'}%</div>
                      <div className="stat-label">Target</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-icon">{getModeIcon(deviceStatus.mode)}</div>
                      <div className="stat-value" style={{ fontSize: '1rem' }}>{getModeName(deviceStatus.mode)}</div>
                      <div className="stat-label">Mode</div>
                    </div>
                  </div>

                  <div className="mode-section">
                    <h3>Operation Mode</h3>
                    <div className="mode-buttons">
                      <button
                        className={`mode-btn ${deviceStatus.mode === 1 ? 'active' : ''}`}
                        onClick={() => changeMode(1)}
                        disabled={actionLoading}
                      >
                        <span className="mode-icon">💧</span>
                        Dehumidify
                      </button>
                      <button
                        className={`mode-btn ${deviceStatus.mode === 2 ? 'active' : ''}`}
                        onClick={() => changeMode(2)}
                        disabled={actionLoading}
                      >
                        <span className="mode-icon">👕</span>
                        Dry Clothes
                      </button>
                      <button
                        className={`mode-btn ${deviceStatus.mode === 3 ? 'active' : ''}`}
                        onClick={() => changeMode(3)}
                        disabled={actionLoading}
                      >
                        <span className="mode-icon">🌬️</span>
                        Purifier
                      </button>
                    </div>
                  </div>

                  <div className="humidity-control">
                    <h3>Target Humidity</h3>
                    <div className="humidity-slider-container">
                      <span className="humidity-value">{deviceStatus.targetHumidity || 50}%</span>
                      <input
                        type="range"
                        className="humidity-slider"
                        min="30"
                        max="80"
                        step="5"
                        value={deviceStatus.targetHumidity || 50}
                        onChange={(e) => {
                          setDeviceStatus(prev => ({
                            ...prev,
                            targetHumidity: parseInt(e.target.value)
                          }))
                        }}
                        onMouseUp={(e) => changeHumidity(e.target.value)}
                        onTouchEnd={(e) => changeHumidity(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <button className="logout-btn" onClick={handleLogout}>
            Sign out
          </button>
        </>
      )}
    </div>
  )
}

export default App
