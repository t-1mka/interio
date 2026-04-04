import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Palette, Eye, EyeOff } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { register, clearError } from '../store/authSlice'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { loading, error } = useAppSelector(s => s.auth)
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [showPass, setShowPass] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    dispatch(clearError())
    if (form.password.length < 6) { toast.error('Пароль минимум 6 символов'); return }
    const res = await dispatch(register(form))
    if (register.fulfilled.match(res)) {
      toast.success('Аккаунт создан!')
      navigate('/profile')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Palette size={28} className="text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white">Регистрация</h1>
          <p className="text-white/60 mt-2">Создайте аккаунт СвойСтиль</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-white/70 mb-1.5 block">Имя *</label>
              <input value={form.name} onChange={set('name')} placeholder="Ваше имя" required minLength={2} className="input" />
            </div>
            <div>
              <label className="text-sm text-white/70 mb-1.5 block">Email *</label>
              <input type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required className="input" />
            </div>
            <div>
              <label className="text-sm text-white/70 mb-1.5 block">Телефон</label>
              <input value={form.phone} onChange={set('phone')} placeholder="+7 (___) ___-__-__" className="input" />
            </div>
            <div>
              <label className="text-sm text-white/70 mb-1.5 block">Пароль *</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  placeholder="Минимум 6 символов"
                  required
                  minLength={6}
                  className="input pr-12"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <div className="text-red-400 text-sm bg-red-400/10 rounded-xl px-4 py-3">{error}</div>}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Создаём аккаунт...
                </span>
              ) : 'Зарегистрироваться'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-white/50">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="text-primary hover:underline">Войти</Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
