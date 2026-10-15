import { useState, useEffect, useCallback, useRef } from 'react'
import { api, timeAgo, MODES } from '../api'
import Icon from './Icon'
import HistoryChart from './HistoryChart'
import DeviceDetails from './DeviceDetails'

const STATUS_POLL_MS = 10000
const HUMIDITY_MIN = 30
const HUMIDITY_MAX = 80
const HUMIDITY_STEP = 5

function Dashboard({ devices, device, onSelectDevice, onLogout, onError }) {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const humidityTimer = useRef(null)

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await api(`/devices/${device.dsn}/status`))
    } catch (err) {
      onError(err.message)
    }
  }, [device.dsn, onError])

  useEffect(() => {
    const timeout = setTimeout(loadStatus, 0)
    const interval = setInterval(loadStatus, STATUS_POLL_MS)
    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [loadStatus])

  useEffect(() => () => clearTimeout(humidityTimer.current), [])

  // Apply the change locally right away, send it, then re-read the real state
  const runAction = async (optimistic, path, body) => {
    if (busy) return
    setBusy(true)
    const previous = status
    setStatus(prev => ({ ...prev, ...optimistic }))
    try {
      await api(`/devices/${device.dsn}/${path}`, { method: 'POST', body })
      setTimeout(loadStatus, 1500)
    } catch (err) {
      setStatus(previous)
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const togglePower = () => runAction({ isOn: !status.isOn }, status.isOn ? 'off' : 'on')
  const changeMode = (mode) => mode !== status.mode && runAction({ mode }, 'mode', { mode })

  // Debounced so dragging the slider or tapping +/- quickly sends a single request
  const changeHumidity = (value) => {
    const humidity = Math.min(HUMIDITY_MAX, Math.max(HUMIDITY_MIN, value))
    setStatus(prev => ({ ...prev, targetHumidity: humidity }))
    clearTimeout(humidityTimer.current)
    humidityTimer.current = setTimeout(async () => {
      try {
        await api(`/devices/${device.dsn}/humidity`, { method: 'POST', body: { humidity } })
      } catch (err) {
        onError(err.message)
        loadStatus()
      }
    }, 700)
  }

  const online = device.connectionStatus === 'Online'
  const target = status?.targetHumidity ?? 50

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="topbar-device">
          {devices.length > 1 ? (
            <select
              className="device-select"
              value={device.dsn}
              onChange={(e) => onSelectDevice(e.target.value)}
            >
              {devices.map(d => (
                <option key={d.dsn} value={d.dsn}>{d.productName || d.model}</option>
              ))}
            </select>
          ) : (
            <h1>{device.productName || 'Dehumidifier'}</h1>
          )}
          <span className={`presence ${online ? 'online' : 'offline'}`}>
            <span className="presence-dot" />
            {online ? 'Online' : device.connectionStatus || 'Offline'}
            {status?.lastUpdated && <> · {timeAgo(status.lastUpdated)}</>}
          </span>
        </div>
        <div className="topbar-actions">
          <button className="icon-btn" onClick={() => setDetailsOpen(true)} title="Device details" aria-label="Device details">
            <Icon name="info" />
          </button>
          <button className="icon-btn" onClick={onLogout} title="Sign out" aria-label="Sign out">
            <Icon name="logout" />
          </button>
        </div>
      </header>

      {!status ? (
        <div className="card skeleton" aria-busy="true">Loading device status...</div>
      ) : (
        <>
          {status.tankFull && (
            <div className="alert alert-warning">
              <Icon name="bucket" />
              <span>The water tank is full. Empty it to continue.</span>
            </div>
          )}
          {!status.tankFull && status.alarmState > 0 && (
            <div className="alert alert-warning">
              <Icon name="alert" />
              <span>Device alarm (code {status.alarmState}). Check the water tank.</span>
            </div>
          )}

          <section className="card hero">
            <div className="hero-readings">
              <div className="reading">
                <span className="reading-label"><Icon name="drop" size={14} /> Humidity</span>
                <span className="reading-value">{status.humidity ?? '--'}<small>%</small></span>
              </div>
              <div className="reading">
                <span className="reading-label"><Icon name="thermometer" size={14} /> Temperature</span>
                <span className="reading-value">{status.temperature ?? '--'}<small>°C</small></span>
              </div>
            </div>
            <div className="hero-power">
              <button
                className={`power-button ${status.isOn ? 'on' : ''}`}
                onClick={togglePower}
                disabled={busy}
                aria-pressed={status.isOn}
                aria-label={status.isOn ? 'Turn off' : 'Turn on'}
              >
                <Icon name="power" size={28} />
              </button>
              <span className="power-label">{status.isOn ? 'On' : 'Off'}</span>
            </div>
            <div className="chips">
              <span className="chip"><Icon name="fan" size={14} /> Fan {status.fanSpeed ?? '--'}</span>
              <span className={`chip ${status.filterAlarm ? 'chip-warning' : ''}`}>
                <Icon name="filter" size={14} /> Filter {status.filterAlarm ? 'change' : 'OK'}
              </span>
              {status.eco && <span className="chip"><Icon name="leaf" size={14} /> Eco</span>}
              {status.swing && <span className="chip"><Icon name="swing" size={14} /> Swing</span>}
            </div>
          </section>

          <section className="card controls">
            <div className="mode-buttons" role="radiogroup" aria-label="Operation mode">
              {MODES.map(m => (
                <button
                  key={m.id}
                  role="radio"
                  aria-checked={status.mode === m.id}
                  className={`mode-btn ${status.mode === m.id ? 'active' : ''}`}
                  onClick={() => changeMode(m.id)}
                  disabled={busy}
                >
                  <Icon name={m.icon} size={18} />
                  {m.name}
                </button>
              ))}
            </div>

            <div className="target">
              <span className="target-label">Target</span>
              <button
                className="step-btn"
                onClick={() => changeHumidity(target - HUMIDITY_STEP)}
                disabled={target <= HUMIDITY_MIN}
                aria-label="Decrease target humidity"
              >
                <Icon name="minus" size={16} />
              </button>
              <input
                type="range"
                className="humidity-slider"
                min={HUMIDITY_MIN}
                max={HUMIDITY_MAX}
                step={HUMIDITY_STEP}
                value={target}
                onChange={(e) => changeHumidity(Number(e.target.value))}
                aria-label="Target humidity"
              />
              <button
                className="step-btn"
                onClick={() => changeHumidity(target + HUMIDITY_STEP)}
                disabled={target >= HUMIDITY_MAX}
                aria-label="Increase target humidity"
              >
                <Icon name="plus" size={16} />
              </button>
              <span className="target-value">{target}%</span>
            </div>
          </section>

          <HistoryChart dsn={device.dsn} target={target} />
        </>
      )}

      {detailsOpen && <DeviceDetails device={device} onClose={() => setDetailsOpen(false)} />}
    </div>
  )
}

export default Dashboard
