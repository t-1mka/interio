import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Home, Image, Trophy, User, LogOut, Palette } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
import { logout } from '../../store/authSlice'
import toast from 'react-hot-toast'

const navLinks = [
  { to: '/', label: 'Главная', icon: Home },
  { to: '/gallery', label: 'Галерея', icon: Image },
  { to: '/leaderboard', label: 'Рейтинг', icon: Trophy },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAppSelector(s => s.auth)

  const handleLogout = async () => {
    await dispatch(logout())
    toast.success('Выход выполнен')
    navigate('/')
    setOpen(false)
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Palette size={16} className="text-white" />
            </div>
            <span className="font-display font-bold text-xl text-white group-hover:text-primary transition-colors">
              СвойСтиль
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === to
                    ? 'bg-primary/20 text-primary'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </div>

          {/* Desktop auth */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/quiz" className="btn-primary text-sm py-2 px-4">
              Пройти квиз
            </Link>
            {user ? (
              <div className="flex items-center gap-2">
                <Link to="/profile" className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 bg-primary/30 rounded-full flex items-center justify-center text-xs font-bold text-primary">
                      {user.name[0].toUpperCase()}
                    </div>
                  )}
                  <span className="hidden lg:block">{user.name}</span>
                </Link>
                <button onClick={handleLogout} className="p-2 rounded-lg text-white/50 hover:text-primary hover:bg-white/10 transition-all">
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn-secondary text-sm py-2 px-4">
                Войти
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-dark/95 backdrop-blur-xl border-t border-white/10"
          >
            <div className="px-4 py-4 space-y-2">
              {navLinks.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    location.pathname === to
                      ? 'bg-primary/20 text-primary'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              ))}
              <Link to="/quiz" onClick={() => setOpen(false)} className="btn-primary w-full text-center block py-3">
                🎨 Пройти квиз
              </Link>
              {user ? (
                <>
                  <Link to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/10">
                    <User size={18} />
                    {user.name}
                  </Link>
                  <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-white/50 hover:text-primary hover:bg-white/10">
                    <LogOut size={18} />
                    Выйти
                  </button>
                </>
              ) : (
                <Link to="/login" onClick={() => setOpen(false)} className="btn-secondary w-full text-center block py-3">
                  Войти
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
