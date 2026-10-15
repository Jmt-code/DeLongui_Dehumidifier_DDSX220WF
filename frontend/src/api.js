export const API_URL = 'http://localhost:3001/api'

// fetch wrapper: parses JSON and throws with the backend error message
export async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`)
    error.status = response.status
    throw error
  }
  return data
}

// Relative "x min ago" text for ISO timestamps
export const timeAgo = (iso) => {
  if (!iso) return '--'
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (Number.isNaN(seconds)) return '--'
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} days ago`
}

export const MODES = [
  { id: 1, name: 'Dehumidify', icon: 'drop' },
  { id: 2, name: 'Dry Clothes', icon: 'shirt' },
  { id: 3, name: 'Purifier', icon: 'wind' }
]
