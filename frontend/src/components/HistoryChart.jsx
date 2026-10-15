import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api'

// room_temp is reported in tenths of a degree
const SERIES = {
  current_humidity: { label: 'Humidity', unit: '%', scale: 1 },
  room_temp: { label: 'Temperature', unit: '°C', scale: 0.1 }
}

const HISTORY_POLL_MS = 5 * 60 * 1000
const PAD = { top: 10, right: 8, bottom: 20, left: 34 }

const formatTime = (ms, withDay) =>
  new Date(ms).toLocaleString([], withDay
    ? { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { hour: '2-digit', minute: '2-digit' })

// Round tick spacing that gives 3-6 gridlines for the given range
const niceStep = (range) => [0.5, 1, 2, 5, 10, 20].find(s => range / s <= 5) || 50

// Keeps the plot sized to its container so the chart fills the free space
function useSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width: Math.floor(width), height: Math.floor(height) })
    })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])
  return size
}

function HistoryChart({ dsn, target }) {
  const [property, setProperty] = useState('current_humidity')
  // { property, points, fetchedAt } of the last load
  const [history, setHistory] = useState(null)
  const [hoverIndex, setHoverIndex] = useState(null)
  const plotRef = useRef(null)
  const { width, height } = useSize(plotRef)

  const loadHistory = useCallback(async () => {
    const { scale } = SERIES[property]
    try {
      const raw = await api(`/devices/${dsn}/history/${property}?limit=100`)
      const points = raw.map(p => ({
        value: Math.round(p.value * scale * 10) / 10,
        time: new Date(p.time).getTime()
      }))
      setHistory({ property, points, fetchedAt: Date.now() })
    } catch (err) {
      console.error('Error loading history:', err)
      setHistory({ property, points: [], fetchedAt: Date.now() })
    }
  }, [dsn, property])

  useEffect(() => {
    const timeout = setTimeout(loadHistory, 0)
    const interval = setInterval(loadHistory, HISTORY_POLL_MS)
    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [loadHistory])

  const selectProperty = (key) => {
    setHoverIndex(null)
    setProperty(key)
  }

  const { unit } = SERIES[property]
  const loading = history?.property !== property
  const points = loading ? [] : history.points
  const showTarget = property === 'current_humidity' && target != null
  const canDraw = points.length >= 2 && width > 0 && height > 0

  let plot = null
  let summary = null
  if (canDraw) {
    const values = points.map(p => p.value)
    const tMin = points[0].time
    const tMax = Math.max(points[points.length - 1].time, history.fetchedAt)
    const domain = showTarget ? [...values, target] : values
    const step = niceStep(Math.max(...domain) - Math.min(...domain))
    const vMin = Math.floor(Math.min(...domain) / step) * step
    const vMax = Math.max(Math.ceil(Math.max(...domain) / step) * step, vMin + step)
    const innerW = width - PAD.left - PAD.right
    const innerH = height - PAD.top - PAD.bottom
    const x = (t) => PAD.left + ((t - tMin) / (tMax - tMin || 1)) * innerW
    // A little headroom so the line never sits exactly on the plot edges
    const yLow = vMin - step * 0.1
    const yHigh = vMax + step * 0.1
    const y = (v) => PAD.top + (1 - (v - yLow) / (yHigh - yLow)) * innerH

    // Datapoints are only stored on change, so each value holds until the next one
    let path = `M${x(points[0].time)},${y(values[0])}`
    for (let i = 1; i < points.length; i++) {
      path += ` H${x(points[i].time)} V${y(values[i])}`
    }
    path += ` H${x(tMax)}`
    const area = `${path} V${PAD.top + innerH} H${x(tMin)} Z`

    const ticks = []
    for (let t = vMin; t <= vMax + step / 2; t += step) ticks.push(Math.round(t * 10) / 10)
    const multiDay = new Date(tMin).toDateString() !== new Date(tMax).toDateString()
    const tMid = (tMin + tMax) / 2

    const handleMove = (e) => {
      const rect = plotRef.current.getBoundingClientRect()
      const px = e.clientX - rect.left
      let nearest = 0
      for (let i = 1; i < points.length; i++) {
        if (Math.abs(x(points[i].time) - px) < Math.abs(x(points[nearest].time) - px)) nearest = i
      }
      setHoverIndex(nearest)
    }

    const hovered = hoverIndex !== null ? points[hoverIndex] : null
    const hx = hovered ? x(hovered.time) : 0

    plot = (
      <>
        <svg
          width={width}
          height={height}
          className="history-svg"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIndex(null)}
          role="img"
          aria-label={`${SERIES[property].label} history`}
        >
          {ticks.map(t => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="chart-grid" />
              <text x={PAD.left - 6} y={y(t)} className="chart-axis" textAnchor="end" dominantBaseline="middle">
                {t}{unit}
              </text>
            </g>
          ))}
          <text x={PAD.left} y={height - 4} className="chart-axis">{formatTime(tMin, multiDay)}</text>
          <text x={x(tMid)} y={height - 4} className="chart-axis" textAnchor="middle">{formatTime(tMid, multiDay)}</text>
          <text x={width - PAD.right} y={height - 4} className="chart-axis" textAnchor="end">Now</text>

          <path d={area} className="chart-area" />
          <path d={path} className="chart-line" />

          {showTarget && (
            <g>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(target)} y2={y(target)} className="chart-target" />
              <text x={width - PAD.right - 2} y={y(target) - 4} className="chart-target-label" textAnchor="end">
                Target {target}%
              </text>
            </g>
          )}

          {hovered && (
            <>
              <line x1={hx} x2={hx} y1={PAD.top} y2={PAD.top + innerH} className="chart-crosshair" />
              <circle cx={hx} cy={y(hovered.value)} r="4" className="chart-dot" />
            </>
          )}
        </svg>
        {hovered && (
          <div
            className="chart-tooltip"
            style={{ left: Math.min(Math.max(hx, 50), width - 50), top: Math.max(y(hovered.value) - 44, 0) }}
          >
            <strong>{hovered.value}{unit}</strong>
            <span>{formatTime(hovered.time, true)}</span>
          </div>
        )}
      </>
    )

    summary = (
      <div className="chart-summary">
        <span>Min <strong>{Math.min(...values)}{unit}</strong></span>
        <span>Avg <strong>{(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)}{unit}</strong></span>
        <span>Max <strong>{Math.max(...values)}{unit}</strong></span>
      </div>
    )
  }

  return (
    <section className="card history">
      <div className="history-header">
        <h2>History</h2>
        <div className="segmented" role="tablist">
          {Object.entries(SERIES).map(([key, s]) => (
            <button
              key={key}
              role="tab"
              aria-selected={key === property}
              className={key === property ? 'active' : ''}
              onClick={() => selectProperty(key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="history-plot" ref={plotRef}>
        {plot}
        {!canDraw && (
          <p className="muted-center">
            {loading ? 'Loading history...' : points.length < 2 ? 'Not enough data recorded yet.' : ''}
          </p>
        )}
      </div>
      {summary}
    </section>
  )
}

export default HistoryChart
