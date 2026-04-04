import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Heart, Image, Loader2 } from 'lucide-react'
import api from '../services/api'

const BADGES = ['🥇', '🥈', '🥉', '⭐', '⭐']

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/gallery/leaderboard')
      .then(res => setLeaders(res.data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <div className="text-5xl mb-4">🏆</div>
        <h1 className="font-display text-4xl font-bold text-white mb-2">Рейтинг дизайнеров</h1>
        <p className="text-white/60">Топ-20 по сумме лайков</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={32} className="text-primary animate-spin" /></div>
      ) : leaders.length === 0 ? (
        <div className="text-center py-20 text-white/50">Пока нет публикаций</div>
      ) : (
        <div className="space-y-3">
          {leaders.map((entry, i) => (
            <motion.div
              key={entry.user.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`card flex items-center gap-4 ${i === 0 ? 'border-yellow-500/50 bg-yellow-500/5' : i === 1 ? 'border-gray-400/30' : i === 2 ? 'border-amber-700/30' : ''}`}
            >
              <div className={`text-2xl w-10 text-center font-display font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-white/40'}`}>
                {i < 5 ? BADGES[i] : `#${entry.rank}`}
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/30 flex items-center justify-center font-bold text-primary shrink-0">
                {entry.user.avatar_url
                  ? <img src={entry.user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  : entry.user.name?.[0]?.toUpperCase()
                }
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">{entry.user.name}</p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-primary"><Heart size={14} fill="currentColor" />{entry.total_likes}</span>
                <span className="flex items-center gap-1 text-white/50"><Image size={14} />{entry.designs_count}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
