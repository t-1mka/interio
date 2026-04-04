import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Download, Share2, QrCode, Tag, ArrowRight, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppSelector } from '../hooks/redux'
import api from '../services/api'

const MOODBOARD = [
  'https://picsum.photos/seed/mood1-interior/400/300',
  'https://picsum.photos/seed/mood2-decor/400/300',
  'https://picsum.photos/seed/mood3-furniture/400/300',
  'https://picsum.photos/seed/mood4-lighting/400/300',
]

export default function ResultPage() {
  const { shareLink } = useParams<{ shareLink: string }>()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showPublish, setShowPublish] = useState(false)
  const [publishTitle, setPublishTitle] = useState('')
  const [publishDesc, setPublishDesc] = useState('')
  const [publishing, setPublishing] = useState(false)
  const { user } = useAppSelector(s => s.auth)

  useEffect(() => {
    api.get(`/quiz/result/${shareLink}`)
      .then(res => { setData(res.data); setPublishTitle(`${res.data.style} ${res.data.room}`) })
      .catch(() => toast.error('Результат не найден'))
      .finally(() => setLoading(false))
  }, [shareLink])

  const handleShare = () => {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({ title: 'Мой дизайн-проект', url })
    } else {
      navigator.clipboard.writeText(url)
      toast.success('Ссылка скопирована!')
    }
  }

  const handlePublish = async () => {
    if (!publishTitle.trim()) { toast.error('Введите название'); return }
    setPublishing(true)
    try {
      await api.post('/gallery/publish', {
        application_id: data.id,
        title: publishTitle,
        description: publishDesc,
      })
      toast.success('Дизайн опубликован в галерею!')
      setShowPublish(false)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Ошибка публикации')
    } finally {
      setPublishing(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 size={32} className="text-primary animate-spin" />
    </div>
  )

  if (!data) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p className="text-white/60">Результат не найден</p>
      <Link to="/quiz" className="btn-primary">Пройти квиз</Link>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="font-display text-4xl font-bold text-white mb-2">Ваш дизайн-проект готов!</h1>
        <p className="text-white/60">Персональный проект для {data.contact_name}</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Generated design */}
          {data.design_image_url && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="card overflow-hidden p-0">
              <img src={data.design_image_url} alt="Сгенерированный дизайн" className="w-full aspect-video object-cover" />
              <div className="p-4">
                <h3 className="font-display text-lg font-bold text-white mb-1">Ваш дизайн</h3>
                <p className="text-white/60 text-sm">{data.ai_description}</p>
              </div>
            </motion.div>
          )}

          {/* Mood board */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="card">
            <h3 className="font-display text-lg font-bold text-white mb-4">Мудборд</h3>
            <div className="grid grid-cols-2 gap-3">
              {MOODBOARD.map((src, i) => (
                <img key={i} src={src} alt="" className="w-full aspect-[4/3] object-cover rounded-xl" />
              ))}
            </div>
          </motion.div>

          {/* Details */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="card">
            <h3 className="font-display text-lg font-bold text-white mb-4">Параметры проекта</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['🏠 Помещение', data.room],
                ['🎨 Стиль', data.style],
                ['💰 Бюджет', `${data.budget_min}–${data.budget_max} тыс. руб.`],
                ['⏱ Срок', data.deadline],
                ['🖌 Цвета', (data.colors || []).join(', ')],
                ['💡 Оценка', data.estimated_cost ? `${data.estimated_cost?.toLocaleString('ru')} ₽` : '—'],
              ].map(([label, val]) => (
                <div key={label}>
                  <span className="text-white/50">{label}</span>
                  <p className="text-white font-medium mt-0.5">{val}</p>
                </div>
              ))}
            </div>
            {data.wishes && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-white/50 text-sm">Пожелания</p>
                <p className="text-white text-sm mt-1">{data.wishes}</p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Promo code */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="card border-primary/30 bg-primary/5">
            <div className="flex items-center gap-2 mb-3">
              <Tag size={16} className="text-primary" />
              <span className="text-sm font-medium text-primary">Ваш промокод</span>
            </div>
            <div className="font-mono text-2xl font-bold text-white tracking-widest text-center py-2 bg-white/10 rounded-xl">
              {data.promo_code}
            </div>
            <p className="text-white/50 text-xs mt-2 text-center">Скидка 10% у партнёрских студий</p>
          </motion.div>

          {/* QR code */}
          {data.qr_code_url && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="card text-center">
              <div className="flex items-center gap-2 justify-center mb-3">
                <QrCode size={16} className="text-white/50" />
                <span className="text-sm text-white/50">QR-код проекта</span>
              </div>
              <img src={data.qr_code_url} alt="QR" className="w-32 h-32 mx-auto rounded-xl bg-white p-2" />
            </motion.div>
          )}

          {/* Actions */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }} className="card space-y-3">
            {data.pdf_url && (
              <a href={data.pdf_url} download className="btn-primary flex items-center justify-center gap-2 w-full">
                <Download size={18} /> Скачать PDF
              </a>
            )}
            <button onClick={handleShare} className="btn-secondary flex items-center justify-center gap-2 w-full">
              <Share2 size={18} /> Поделиться
            </button>
            {user && !showPublish && (
              <button onClick={() => setShowPublish(true)} className="btn-secondary flex items-center justify-center gap-2 w-full">
                <ArrowRight size={18} /> В галерею
              </button>
            )}
          </motion.div>

          {/* Publish form */}
          {showPublish && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card space-y-3">
              <h4 className="font-display font-bold text-white">Публикация в галерею</h4>
              <input value={publishTitle} onChange={e => setPublishTitle(e.target.value)} placeholder="Название дизайна" className="input" />
              <textarea value={publishDesc} onChange={e => setPublishDesc(e.target.value)} placeholder="Описание (необязательно)" rows={2} className="input resize-none" />
              <div className="flex gap-2">
                <button onClick={() => setShowPublish(false)} className="btn-secondary flex-1 py-2 text-sm">Отмена</button>
                <button onClick={handlePublish} disabled={publishing} className="btn-primary flex-1 py-2 text-sm">
                  {publishing ? '...' : 'Опубликовать'}
                </button>
              </div>
            </motion.div>
          )}

          <Link to="/quiz" className="block text-center text-sm text-white/50 hover:text-primary transition-colors">
            Создать новый проект →
          </Link>
        </div>
      </div>
    </div>
  )
}
