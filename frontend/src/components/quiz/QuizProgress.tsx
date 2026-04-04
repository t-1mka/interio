import { motion } from 'framer-motion'
import { Lightbulb, Loader2 } from 'lucide-react'

const STEP_EMOJIS = ['🏠', '🎨', '💰', '⏱', '🖌', '💭']
const STEP_LABELS = ['Комната', 'Стиль', 'Бюджет', 'Сроки', 'Цвета', 'Пожелания']

export function QuizProgress({ step, total = 6 }: { step: number; total?: number }) {
  const pct = ((step + 1) / total) * 100

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{STEP_EMOJIS[step]}</span>
          <span className="font-display font-bold text-white">{STEP_LABELS[step]}</span>
        </div>
        <span className="text-sm text-white/50 font-mono">
          {step + 1} / {total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary to-red-400 rounded-full progress-bar"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      {/* Step dots */}
      <div className="flex gap-2 mt-3">
        {STEP_EMOJIS.map((emoji, i) => (
          <div
            key={i}
            className={`flex-1 h-1 rounded-full transition-all duration-300 ${
              i <= step ? 'bg-primary' : 'bg-white/10'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

export function TipBox({ tip, loading }: { tip: string; loading: boolean }) {
  if (!tip && !loading) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 p-4 bg-primary/10 border border-primary/30 rounded-xl flex gap-3"
    >
      <div className="shrink-0 mt-0.5">
        {loading ? (
          <Loader2 size={16} className="text-primary animate-spin" />
        ) : (
          <Lightbulb size={16} className="text-primary" />
        )}
      </div>
      <div>
        <p className="text-xs font-semibold text-primary mb-1">Совет дизайнера</p>
        {loading ? (
          <div className="space-y-1.5">
            <div className="h-3 bg-primary/20 rounded animate-pulse w-full" />
            <div className="h-3 bg-primary/20 rounded animate-pulse w-3/4" />
          </div>
        ) : (
          <p className="text-sm text-white/80 leading-relaxed">{tip}</p>
        )}
      </div>
    </motion.div>
  )
}
