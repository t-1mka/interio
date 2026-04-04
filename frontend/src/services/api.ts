import axios from 'axios'

// VITE_API_URL задаётся через docker-compose.yml environment
// При сборке Vite подставляет значение из env
const API_BASE = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: API_BASE ? `${API_BASE}/api` : '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Silently handle 401 — auth state managed by Redux
    }
    return Promise.reject(err)
  }
)

export default api
