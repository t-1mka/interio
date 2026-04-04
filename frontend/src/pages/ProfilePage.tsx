import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User, Image, Heart, FileText, Edit2, Trash2, Eye, EyeOff, Camera, Loader2 } from 'lucide-react'
import { useAppSelector } from '../hooks/redux'
import api from '../services/api'
import toast from 'react-hot-toast'

type Tab = 'applications' | 'designs' | 'favorites'

export default function ProfilePage() {
  const { user } = useAppSelector(s => s.auth)
  const [tab, setTab] = useState<Tab>('applications')
  const [applications, setApplications] = useState<any[]>([])
  const [designs, setDesigns] = useState<any[]>([])
  const [favorites, setFavorites] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [editName, setEditName] = useState(user?.name || '')
  const [editPhone, setEditPhone] = useState(user?.phone || '')
  const [saving, setSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadTab(tab)
  }, [tab])

  const loadTab = async (t: Tab) => {
    setLoading(true)
    try {
      if (t === 'applications') {
        const res = await api.get('/profile/applications')
        setApplications(res.data)
      } else if (t === 'designs') {
        const res = await api.get('/profile/designs')
        setDesigns(res.data)
      } else {
        const res = await api.get('/profile/favorites')
        setFavorites(res.data)
      }
    } catch { toast.error('Ошибка загрузки') }
    finally { setLoading(false) }
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      await api.patch('/profile/me', { name: editName, phone: editPhone })
      toast.success('Профиль обновлён')
    } catch { toast.error('Ошибка сохранения') }
    finally { setSaving(false) }
  }

  const uploadAvatar = async (file: File) => {
    setAvatarUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      await api.post('/profile/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Аватар обновлён, обновите страницу')
    } catch { toast.error('Ошибка загрузки аватара') }
    finally { setAvatarUploading(false) }
  }

  const toggleDesignVisibility = async (id: number, isPublished: boolean) => {
    try {
      await api.patch(`/profile/designs/${id}`, { is_published: !isPublished })
      setDesigns(prev => prev.map(d => d.id === id ? { ...d, is_published: !isPublished } : d))
      toast.success(isPublished ? 'Скрыто' : 'Опубликовано')
    } catch { toast.error('Ошибка') }
  }

  const deleteDesign = async (id: number) => {
    if (!confirm('Удалить дизайн?')) return
    try {
      await api.delete(`/profile/designs/${id}`)
      setDesigns(prev => prev.filter(d => d.id !== id))
      toast.success('Дизайн удалён')
    } catch { toast.error('Ошибка удаления') }
  }

  const TABS = [
    { id: 'applications' as Tab, label: 'Заявки', icon: FileText },
    { id: 'designs' as Tab, label: 'Дизайны', icon: Image },
    { id: 'favorites' as Tab, label: 'Избранное', icon: Heart },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl font-bold text-white mb-8">Личный кабинет</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Profile sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card text-center">
            {/* Avatar */}
            <div className="relative inline-block mb-4">
              <div className="w-20 h-20 rounded-full bg-primary/30 flex items-center justify-center text-2xl font-bold text-primary mx-auto overflow-hidden">
                {user?.avatar_url
                  ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  : user?.name?.[0]?.toUpperCase()
                }
              </div>
              <button
                onClick={() => avatarRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 bg-primary rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
              >
                {avatarUploading ? <Loader2 size={12} className="animate-spin text-white" /> : <Camera size={12} className="text-white" />}
              </button>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
            </div>
            <p className="font-display font-bold text-white text-lg">{user?.name}</p>
            <p className="text-white/50 text-sm">{user?.email}</p>
          </div>

          {/* Edit profile */}
          <div className="card space-y-3">
            <h3 className="font-medium text-white text-sm">Редактировать</h3>
            <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Имя" className="input text-sm py-2" />
            <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="Телефон" className="input text-sm py-2" />
            <button onClick={saveProfile} disabled={saving} className="btn-primary w-full py-2 text-sm">
              {saving ? '...' : 'Сохранить'}
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:col-span-3">
          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-primary text-white' : 'text-white/60 hover:text-white'}`}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 size={28} className="text-primary animate-spin" /></div>
          ) : (
            <>
              {/* Applications */}
              {tab === 'applications' && (
                <div className="space-y-3">
                  {applications.length === 0 && <EmptyState icon="📋" text="Заявок пока нет" linkTo="/quiz" linkText="Пройти квиз" />}
                  {applications.map(app => (
                    <motion.div key={app.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-xl shrink-0">🏠</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white">{app.room} · {app.style}</p>
                        <p className="text-sm text-white/50 truncate">{new Date(app.created_at).toLocaleDateString('ru')}</p>
                        {app.promo_code && <span className="badge bg-primary/20 text-primary text-xs mt-1">{app.promo_code}</span>}
                      </div>
                      <Link to={`/result/${app.share_link}`} className="btn-secondary text-sm py-2 px-3 shrink-0">
                        Открыть
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Designs */}
              {tab === 'designs' && (
                <div className="space-y-3">
                  {designs.length === 0 && <EmptyState icon="🎨" text="Дизайнов пока нет" linkTo="/gallery" linkText="В галерею" />}
                  {designs.map(d => (
                    <motion.div key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card flex items-center gap-4">
                      <img
                        src={d.main_image_url || 'https://picsum.photos/seed/thumb/80/80'}
                        alt=""
                        className="w-14 h-14 rounded-xl object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{d.title}</p>
                        <div className="flex items-center gap-3 text-xs text-white/50 mt-1">
                          <span className="flex items-center gap-1"><Heart size={11} fill="currentColor" className="text-primary" />{d.likes_count}</span>
                          <span className="flex items-center gap-1"><Eye size={11} />{d.views_count}</span>
                          <span className={d.is_published ? 'text-green-400' : 'text-white/30'}>{d.is_published ? 'Опубликован' : 'Скрыт'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => toggleDesignVisibility(d.id, d.is_published)} className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all">
                          {d.is_published ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                        <button onClick={() => deleteDesign(d.id)} className="p-2 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-400/10 transition-all">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Favorites */}
              {tab === 'favorites' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {favorites.length === 0 && <div className="col-span-2"><EmptyState icon="❤️" text="Избранных нет" linkTo="/gallery" linkText="В галерею" /></div>}
                  {favorites.map(d => (
                    <motion.div key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <Link to={`/design/${d.id}`} className="card-hover block overflow-hidden p-0">
                        <img src={d.main_image_url || 'https://picsum.photos/seed/fav/400/200'} alt={d.title} className="w-full h-36 object-cover" />
                        <div className="p-3">
                          <p className="font-medium text-white text-sm line-clamp-1">{d.title}</p>
                          <div className="flex items-center gap-1 mt-1 text-xs text-white/50">
                            <Heart size={11} fill="currentColor" className="text-primary" />
                            {d.likes_count}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ icon, text, linkTo, linkText }: { icon: string; text: string; linkTo: string; linkText: string }) {
  return (
    <div className="text-center py-16 text-white/50">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="mb-4">{text}</p>
      <Link to={linkTo} className="btn-primary">{linkText}</Link>
    </div>
  )
}
