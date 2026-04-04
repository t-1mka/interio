import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, Zap, Shield, Star } from 'lucide-react'

const FEATURES = [
  { icon: '🏠', title: '6 шагов', desc: 'Простой квиз — от комнаты до пожеланий' },
  { icon: '🤖', title: 'ИИ-советник', desc: 'GigaChat даёт персональные рекомендации' },
  { icon: '🎨', title: 'Генерация дизайна', desc: 'Kandinsky создаёт уникальный проект' },
  { icon: '📄', title: 'PDF-отчёт', desc: 'Скачайте готовый проект с QR-кодом' },
  { icon: '🖼', title: 'Галерея', desc: 'Делитесь и вдохновляйтесь работами других' },
  { icon: '🎁', title: 'Промокод', desc: 'Получите скидку от партнёрских студий' },
]

const STYLES = [
  { name: 'Скандинавский', img: 'https://picsum.photos/seed/scandinavian-living/400/300', color: 'from-blue-900/60' },
  { name: 'Лофт', img: 'https://picsum.photos/seed/loft-interior-design/400/300', color: 'from-gray-900/60' },
  { name: 'Минимализм', img: 'https://picsum.photos/seed/minimalist-room/400/300', color: 'from-stone-900/60' },
  { name: 'Классический', img: 'https://picsum.photos/seed/classic-interior/400/300', color: 'from-amber-900/60' },
]

export default function HomePage() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-dark via-secondary/30 to-dark" />
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 bg-primary/20 border border-primary/30 rounded-full px-4 py-1.5 text-sm text-primary font-medium mb-6">
                <Sparkles size={14} />
                ИИ-дизайн интерьера
              </span>
              <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
                Создайте{' '}
                <span className="gradient-text">интерьер</span>{' '}
                мечты
              </h1>
              <p className="text-white/70 text-xl leading-relaxed mb-8 max-w-2xl">
                Пройдите умный квиз из 6 шагов — и получите персональный дизайн-проект,
                сгенерированный ИИ, с PDF-отчётом и промокодом.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/quiz"
                  className="btn-primary flex items-center justify-center gap-2 text-lg px-8 py-4"
                >
                  <Zap size={20} />
                  Начать квиз
                  <ArrowRight size={20} />
                </Link>
                <Link to="/gallery" className="btn-secondary flex items-center justify-center gap-2 text-lg px-8 py-4">
                  <Star size={20} />
                  Галерея работ
                </Link>
              </div>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="flex gap-8 mt-12"
            >
              {[['500+', 'проектов'], ['98%', 'довольных'], ['6', 'шагов']].map(([num, label]) => (
                <div key={label}>
                  <div className="font-display text-3xl font-bold text-primary">{num}</div>
                  <div className="text-white/50 text-sm">{label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Style Preview */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="font-display text-4xl font-bold text-white mb-4">Популярные стили</h2>
          <p className="text-white/60 text-lg">Выберите направление, которое вам близко</p>
        </motion.div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STYLES.map((style, i) => (
            <motion.div
              key={style.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Link to="/quiz" className="group block relative rounded-2xl overflow-hidden aspect-[4/3]">
                <img
                  src={style.img}
                  alt={style.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className={`absolute inset-0 bg-gradient-to-t ${style.color} to-transparent`} />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <span className="font-display font-bold text-white text-lg">{style.name}</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white/3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-display text-4xl font-bold text-white mb-4">Как это работает</h2>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="card-hover"
              >
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="font-display text-xl font-bold text-white mb-2">{f.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center card border-primary/30"
        >
          <div className="text-5xl mb-4">🏠</div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
            Готовы создать свой стиль?
          </h2>
          <p className="text-white/60 mb-8">
            Займёт всего 5 минут. Без регистрации. Результат сразу.
          </p>
          <Link to="/quiz" className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-4">
            <Sparkles size={20} />
            Начать бесплатно
          </Link>
        </motion.div>
      </section>
    </div>
  )
}
