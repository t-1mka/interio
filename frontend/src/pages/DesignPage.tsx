import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, Bookmark, Send, Eye, ArrowLeft, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAppSelector } from '../hooks/redux'

export default function DesignPage() {
  const { id } = useParams()
  const [design, setDesign] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { user } = useAppSelector(s => s.auth)

  useEffect(() => {
    api.get(`/gallery/${id}`)
      .then(res => setDesign(res.data))
      .catch(() => toast.error('Дизайн не найден'))
      .finally(() => setLoading(false))
  }, [id])

  const handleLike = async () => {
    if (!user) { toast.error('Войдите для лайка'); return }
    const res = await api.post(`/gallery/${id}/like`)
    setDesign((d: any) => ({ ...d, likes_count: res.data.likes_count, is_liked: res.data.liked }))
  }

  const handleFav = async () => {
    if (!user) { toast.error('Войдите для сохранения'); return }
    const res = await api.post(`/gallery/${id}/favorite`)
    setDesign((d: any) => ({ ...d, is_favorited: res.data.favorited }))
    toast.success(res.data.favorited ? 'Добавлено в избранное' : 'Убрано из избранного')
  }

  const handleComment = async () => {
    if (!user) { toast.error('Войдите для комментария'); return }
    if (!comment.trim()) return
    setSubmitting(true)
    try {
      const res = await api.post(`/gallery/${id}/comments`, { text: comment })
      setDesign((d: any) => ({ ...d, comments: [...(d.comments || []), res.data] }))
      setComment('')
      toast.success('Комментарий добавлен')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Ошибка')
    } finally { setSubmitting(false) }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 size={32} className="text-primary animate-spin" /></div>
  if (!design) return <div className="flex flex-col items-center justify-center min-h-screen gap-4"><p className="text-white/60">Дизайн не найден</p><Link to="/gallery" className="btn-primary">В галерею</Link></div>

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <Link to="/gallery" className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors">
        <ArrowLeft size={16} /> Назад в галерею
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Main image */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl overflow-hidden">
            <img src={design.main_image_url || 'https://picsum.photos/seed/design/800/600'} alt={design.title} className="w-full object-cover" style={{ maxHeight: '500px' }} />
          </motion.div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button onClick={handleLike} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${design.is_liked ? 'border-primary bg-primary/20 text-primary' : 'border-white/10 text-white/60 hover:border-primary/50 hover:text-primary'}`}>
              <Heart size={18} fill={design.is_liked ? 'currentColor' : 'none'} className="animate-heart" />
              {design.likes_count}
            </button>
            <button onClick={handleFav} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${design.is_favorited ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400' : 'border-white/10 text-white/60 hover:border-yellow-500/50 hover:text-yellow-400'}`}>
              <Bookmark size={18} fill={design.is_favorited ? 'currentColor' : 'none'} />
              Сохранить
            </button>
            <span className="flex items-center gap-1 text-sm text-white/40 ml-auto"><Eye size={14} />{design.views_count} просмотров</span>
          </div>

          {/* Comments */}
          <div className="card">
            <h3 className="font-display text-lg font-bold text-white mb-4">Комментарии ({design.comments?.length || 0})</h3>
            <div className="space-y-4 mb-4">
              {(design.comments || []).map((c: any) => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {c.user?.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white">{c.user?.name}</span>
                    <p className="text-sm text-white/70 mt-0.5">{c.text}</p>
                  </div>
                </div>
              ))}
              {(design.comments?.length || 0) === 0 && <p className="text-white/40 text-sm">Будьте первым, кто прокомментирует!</p>}
            </div>
            {user && (
              <div className="flex gap-3">
                <input value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleComment()} placeholder="Напишите комментарий..." className="input flex-1" />
                <button onClick={handleComment} disabled={submitting || !comment.trim()} className="p-3 bg-primary rounded-xl text-white disabled:opacity-50 hover:bg-red-500 transition-colors">
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-display text-xl font-bold text-white mb-2">{design.title}</h2>
            {design.description && <p className="text-white/60 text-sm leading-relaxed mb-4">{design.description}</p>}
            <div className="flex items-center gap-3 py-3 border-y border-white/10 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/30 flex items-center justify-center font-bold text-primary">
                {design.author?.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-white text-sm">{design.author?.name}</p>
                <p className="text-white/40 text-xs">Дизайнер</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {design.style && <div className="flex justify-between"><span className="text-white/50">Стиль</span><span className="text-white">{design.style}</span></div>}
              {design.room && <div className="flex justify-between"><span className="text-white/50">Комната</span><span className="text-white">{design.room}</span></div>}
              {design.budget_min && <div className="flex justify-between"><span className="text-white/50">Бюджет</span><span className="text-white">{design.budget_min}–{design.budget_max} тыс.</span></div>}
              {(design.colors || []).length > 0 && (
                <div className="flex justify-between"><span className="text-white/50">Цвета</span><span className="text-white text-right">{design.colors.join(', ')}</span></div>
              )}
            </div>
          </div>

          <Link to="/quiz" className="btn-primary flex items-center justify-center gap-2 w-full">
            Создать похожий
          </Link>
        </div>
      </div>
    </div>
  )
}
