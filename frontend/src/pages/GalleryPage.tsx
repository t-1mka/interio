import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, Eye, Search, SlidersHorizontal, Trophy } from 'lucide-react'
import api from '../services/api'
import { useAppSelector } from '../hooks/redux'
import toast from 'react-hot-toast'

const STYLES = ['', 'Современный', 'Минимализм', 'Скандинавский', 'Классический', 'Лофт', 'Японский', 'Арт-деко']
const ROOMS = ['', 'Гостиная', 'Спальня', 'Кухня', 'Ванная', 'Детская', 'Кабинет']

export default function GalleryPage() {
  const [designs, setDesigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [style, setStyle] = useState('')
  const [room, setRoom] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const { user } = useAppSelector(s => s.auth)

  const load = useCallback(async (reset = false) => {
    setLoading(true)
    const p = reset ? 1 : page
    try {
      const res = await api.get('/gallery/', { params: { style: style || undefined, room: room || undefined, sort, search: search || undefined, page: p, limit: 12 } })
      const items = res.data
      if (reset) { setDesigns(items); setPage(1) }
      else { setDesigns(prev => [...prev, ...items]) }
      setHasMore(items.length === 12)
    } catch { toast.error('Ошибка загрузки') }
    finally { setLoading(false) }
  }, [style, room, sort, search, page])

  useEffect(() => { load(true) }, [style, room, sort, search])

  const handleLike = async (id: number, e: React.MouseEvent) => {
    e.preventDefault()
    if (!user) { toast.error('Войдите для лайка'); return }
    try {
      const res = await api.post(`/gallery/${id}/like`)
      setDesigns(prev => prev.map(d => d.id === id ? { ...d, likes_count: res.data.likes_count, is_liked: res.data.liked } : d))
    } catch { toast.error('Ошибка') }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-4xl font-bold text-white mb-1">Галерея дизайнов</h1>
          <p className="text-white/60">Вдохновляйтесь работами других</p>
        </div>
        <Link to="/leaderboard" className="flex items-center gap-2 text-sm text-primary hover:underline">
          <Trophy size={16} /> Рейтинг дизайнеров
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-8 space-y-4">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по названию..."
            className="input pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <select value={style} onChange={e => setStyle(e.target.value)} className="input flex-1 min-w-[140px]">
            {STYLES.map(s => <option key={s} value={s}>{s || 'Все стили'}</option>)}
          </select>
          <select value={room} onChange={e => setRoom(e.target.value)} className="input flex-1 min-w-[140px]">
            {ROOMS.map(r => <option key={r} value={r}>{r || 'Все комнаты'}</option>)}
          </select>
          <select value={sort} onChange={e => setSort(e.target.value)} className="input flex-1 min-w-[140px]">
            <option value="newest">Сначала новые</option>
            <option value="popular">По популярности</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {designs.length === 0 && !loading ? (
        <div className="text-center py-20 text-white/50">
          <p className="text-5xl mb-4">🖼</p>
          <p>Дизайнов пока нет. Будьте первым!</p>
          <Link to="/quiz" className="btn-primary mt-4 inline-block">Создать дизайн</Link>
        </div>
      ) : (
        <div className="masonry-grid">
          {designs.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="masonry-item"
            >
              <Link to={`/design/${d.id}`} className="card-hover block overflow-hidden p-0">
                <div className="relative overflow-hidden">
                  <img
                    src={d.main_image_url || 'https://picsum.photos/seed/design-placeholder/400/300'}
                    alt={d.title}
                    className="w-full object-cover transition-transform duration-500 hover:scale-105"
                    style={{ aspectRatio: i % 3 === 0 ? '4/3' : i % 3 === 1 ? '1/1' : '3/4' }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-dark/80 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
                </div>
                <div className="p-4">
                  <h3 className="font-display font-bold text-white text-sm mb-1 line-clamp-1">{d.title}</h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <img src={d.author?.avatar_url || ''} alt="" className="w-5 h-5 rounded-full bg-primary/30 object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                      <span>{d.author?.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/50">
                      <span className="flex items-center gap-1"><Eye size={12} />{d.views_count}</span>
                      <button
                        onClick={e => handleLike(d.id, e)}
                        className={`flex items-center gap-1 transition-colors ${d.is_liked ? 'text-primary' : 'hover:text-primary'}`}
                      >
                        <Heart size={12} fill={d.is_liked ? 'currentColor' : 'none'} />
                        {d.likes_count}
                      </button>
                    </div>
                  </div>
                  {(d.style || d.room) && (
                    <div className="flex gap-1 mt-2">
                      {d.style && <span className="badge bg-primary/20 text-primary">{d.style}</span>}
                      {d.room && <span className="badge bg-white/10 text-white/60">{d.room}</span>}
                    </div>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="text-center mt-8">
          <button onClick={() => { setPage(p => p + 1); load() }} className="btn-secondary">
            Загрузить ещё
          </button>
        </div>
      )}
      {loading && (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
