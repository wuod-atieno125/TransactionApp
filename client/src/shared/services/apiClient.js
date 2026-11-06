const configuredBaseUrl = import.meta.env.DEV
  ? '/api'
  : import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    'https://transactionapp-cx6q.onrender.com/api'

const baseUrl = configuredBaseUrl.replace(/\/+$/, '')

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  if (options.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (response.status === 204) return null

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(
      data.message || data.error || `API request failed (${response.status})`,
    )
    error.status = response.status
    error.code = data.code
    throw error
  }

  return data
}

export async function apiBlob(path, options = {}) {
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'image/jpeg')

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (response.status === 204) return null

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(
      data.message || data.error || `API request failed (${response.status})`,
    )
  }

  return response.blob()
}