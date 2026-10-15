import { useState, useEffect, useCallback, useRef } from 'react'
import { api, timeAgo, MODES } from '../api'
import Icon from './Icon'

const PROPERTIES_POLL_MS = 30000

// Friendly names for the properties we already know about
const KNOWN_LABELS = {
  set_status: 'Power',
  current_humidity: 'Current humidity',
  humidity_setpoint: 'Target humidity',
  room_temp: 'Room temperature',
  heat_exchanger_temp: 'Heat exchanger temperature',
  device_mode: 'Mode',
  device_status: 'Device status',
  current_speed: 'Fan speed',
  alarm_state: 'Alarm state',
  filter_status: 'Filter status',
  filter_change_alarm: 'Filter change alarm',
  filter_life: 'Filter life',
  set_eco: 'Eco mode',
  swing: 'Swing',
  appliance_model: 'Appliance model',
  software_version: 'Software version',
  mcu_host_version: 'MCU version'
}

// Temperatures are reported in tenths of a degree
const TENTHS_OF_DEGREE = ['room_temp', 'heat_exchanger_temp']

// Enumerated values whose meaning we know
const VALUE_NAMES = {
  set_status: { 1: 'On', 2: 'Off' },
  device_mode: Object.fromEntries(MODES.map(m => [m.id, m.name]))
}

const formatValue = ({ value, name, baseType }) => {
  if (value === null || value === undefined || value === '') return '--'
  if (VALUE_NAMES[name]?.[value]) return VALUE_NAMES[name][value]
  if (TENTHS_OF_DEGREE.includes(name) && typeof value === 'number') return `${(value / 10).toFixed(1)}°C`
  if (baseType === 'boolean' || typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function PropertyList({ title, items }) {
  if (items.length === 0) return null
  return (
    <div className="prop-group">
      <h3>{title} <span className="muted">{items.length}</span></h3>
      <ul className="prop-list">
        {items.map(p => (
          <li key={p.name} className="prop-row" title={String(p.value ?? '')}>
            <div className="prop-name">
              <span>{KNOWN_LABELS[p.name] || p.displayName}</span>
              <code>{p.name}</code>
            </div>
            <div className="prop-value">
              <span>{formatValue(p)}</span>
              <small>{timeAgo(p.updatedAt)}</small>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DeviceDetails({ device, onClose }) {
  const [properties, setProperties] = useState(null)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState(null)
  const dialogRef = useRef(null)

  const loadProperties = useCallback(async () => {
    try {
      setProperties(await api(`/devices/${device.dsn}/properties`))
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [device.dsn])

  useEffect(() => {
    const timeout = setTimeout(loadProperties, 0)
    const interval = setInterval(loadProperties, PROPERTIES_POLL_MS)
    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [loadProperties])

  // Close with Escape and move focus into the dialog
  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const query = filter.trim().toLowerCase()
  const visible = (properties || [])
    .filter(p => !query ||
      p.name.toLowerCase().includes(query) ||
      String(KNOWN_LABELS[p.name] || p.displayName).toLowerCase().includes(query) ||
      String(p.value).toLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name))

  const deviceInfo = [
    ['Name', device.productName],
    ['Model', device.oemModel || device.model],
    ['DSN', device.dsn],
    ['Firmware', device.swVersion],
    ['Local IP', device.lanIp],
    ['MAC', device.mac],
    ['Connected since', device.connectedAt && new Date(device.connectedAt).toLocaleString()]
  ].filter(([, value]) => value)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="details-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet-header">
          <h2 id="details-title">Device details</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>

        <div className="sheet-body">
          <dl className="device-meta">
            {deviceInfo.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <label className="search">
            <Icon name="search" size={16} />
            <input
              type="search"
              placeholder="Filter properties..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>

          {error && <p className="muted-center">{error}</p>}
          {!properties && !error && <p className="muted-center">Loading properties...</p>}

          <PropertyList title="Reported by the device" items={visible.filter(p => p.direction !== 'input')} />
          <PropertyList title="Settings" items={visible.filter(p => p.direction === 'input')} />
          {properties && visible.length === 0 && <p className="muted-center">No properties match “{filter}”.</p>}
        </div>
      </div>
    </div>
  )
}

export default DeviceDetails
