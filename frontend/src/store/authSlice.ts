import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import api from '../services/api'

export interface User {
  id: number
  email: string
  name: string
  phone?: string
  avatar_url?: string
  telegram_username?: string
  is_admin: boolean
  created_at: string
}

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

const initialState: AuthState = {
  user: null,
  loading: false,
  error: null,
}

export const fetchMe = createAsyncThunk('auth/fetchMe', async () => {
  const res = await api.get('/auth/me')
  return res.data
})

export const login = createAsyncThunk(
  'auth/login',
  async (data: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/auth/login', data)
      return res.data
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.detail || 'Ошибка входа')
    }
  }
)

export const register = createAsyncThunk(
  'auth/register',
  async (data: { email: string; password: string; name: string; phone?: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/auth/register', data)
      return res.data
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.detail || 'Ошибка регистрации')
    }
  }
)

export const logout = createAsyncThunk('auth/logout', async () => {
  await api.post('/auth/logout')
})

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null },
    setUser: (state, action: PayloadAction<User | null>) => { state.user = action.payload },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMe.fulfilled, (state, action) => { state.user = action.payload })
      .addCase(fetchMe.rejected, (state) => { state.user = null })
      .addCase(login.pending, (state) => { state.loading = true; state.error = null })
      .addCase(login.fulfilled, (state, action) => { state.loading = false; state.user = action.payload })
      .addCase(login.rejected, (state, action) => { state.loading = false; state.error = action.payload as string })
      .addCase(register.pending, (state) => { state.loading = true; state.error = null })
      .addCase(register.fulfilled, (state, action) => { state.loading = false; state.user = action.payload })
      .addCase(register.rejected, (state, action) => { state.loading = false; state.error = action.payload as string })
      .addCase(logout.fulfilled, (state) => { state.user = null })
  },
})

export const { clearError, setUser } = authSlice.actions
export default authSlice.reducer
