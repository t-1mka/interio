import { Link } from 'react-router-dom'
import { Palette, Send } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-dark/80 border-t border-white/10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
                <Palette size={14} className="text-white" />
              </div>
              <span className="font-display font-bold text-lg">СвойСтиль</span>
            </div>
            <p className="text-white/50 text-sm leading-relaxed">
              Умный квиз для создания дизайна интерьера с&nbsp;ИИ-помощником.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3 text-white/70">Навигация</h4>
            <ul className="space-y-2 text-sm text-white/50">
              {[['/', 'Главная'], ['/quiz', 'Квиз'], ['/gallery', 'Галерея'], ['/leaderboard', 'Рейтинг']].map(([to, label]) => (
                <li key={to}><Link to={to} className="hover:text-primary transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3 text-white/70">Telegram</h4>
            <a
              href="https://t.me/svoystyle_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Send size={14} />
              @svoystyle_bot
            </a>
            <p className="text-white/30 text-xs mt-4">
              © {new Date().getFullYear()} СвойСтиль. Хакатон-проект.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
