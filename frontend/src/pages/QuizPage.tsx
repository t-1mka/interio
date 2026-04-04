import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Shuffle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { nextStep, prevStep, updateAnswers, toggleColor, setTip, setTipLoading, setSubmitting, setResult, resetQuiz } from '../store/quizSlice'
import { QuizProgress, TipBox } from '../components/quiz/QuizProgress'
import VoiceInput from '../components/quiz/VoiceInput'
import PhotoUpload from '../components/quiz/PhotoUpload'
import api from '../services/api'

const ROOMS = ['Гостиная','Спальня','Кухня','Ванная','Детская','Кабинет','Прихожая']
const STYLES = ['Современный','Минимализм','Скандинавский','Классический','Лофт','Японский','Арт-деко']
const DEADLINES = ['1 месяц','3 месяца','6 месяцев','Без срока']
const COLORS = [
  { label:'⬜ Белый/Светлый', value:'Белый' },
  { label:'⬛ Тёмный/Графит', value:'Тёмный' },
  { label:'🟤 Деревянный', value:'Деревянный' },
  { label:'🔵 Синий/Голубой', value:'Синий' },
  { label:'🟢 Зелёный', value:'Зелёный' },
  { label:'🟡 Жёлтый/Золотой', value:'Жёлтый' },
  { label:'🩷 Розовый/Коралловый', value:'Розовый' },
  { label:'🎨 Разноцветный', value:'Разноцветный' },
]

function calcCost(a: any) {
  const mid=(a.budgetMin+a.budgetMax)/2
  const r:any={Гостиная:1.2,Спальня:1.0,Кухня:1.5,Ванная:1.3,Детская:1.1,Кабинет:0.9,Прихожая:0.8}
  const s:any={Современный:1.0,Минимализм:0.9,Скандинавский:1.0,Классический:1.6,Лофт:1.1,Японский:1.2,'Арт-деко':1.5}
  const d:any={'1 месяц':1.3,'3 месяца':1.0,'6 месяцев':0.9,'Без срока':0.8}
  return Math.round(mid*1000*(r[a.room]??1)*(s[a.style]??1)*(d[a.deadline]??1)/100)*100
}

function SimpleCaptcha({ onValid }: { onValid:(v:boolean)=>void }) {
  const [[a,b]] = useState([Math.floor(Math.random()*10)+1, Math.floor(Math.random()*10)+1])
  const [val, setVal] = useState('')
  const check=(v:string)=>{ setVal(v); onValid(parseInt(v)===a+b) }
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-white/60">Подтвердите: {a} + {b} =</span>
      <input value={val} onChange={e=>check(e.target.value)} className="input w-20 text-center py-2" placeholder="?" />
      {parseInt(val)===a+b && <span className="text-green-400">✓</span>}
    </div>
  )
}

const V={enter:{x:60,opacity:0},center:{x:0,opacity:1},exit:{x:-60,opacity:0}}
const BTN=(active:boolean)=>active?'border-primary bg-primary/20 text-primary':'border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:text-white'

export default function QuizPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { step, answers, tip, tipLoading, submitting } = useAppSelector(s => s.quiz)
  const [captchaOk, setCaptchaOk] = useState(false)

  const fetchTip = async (stepName:string, answer:string) => {
    if (!answer) return
    dispatch(setTipLoading(true))
    try { const res=await api.get('/quiz/tip',{params:{step:stepName,answer}}); dispatch(setTip(res.data.tip)) }
    catch { dispatch(setTip('')) } finally { dispatch(setTipLoading(false)) }
  }

  const handleNext = () => {
    if (step===0&&!answers.room) { toast.error('Выберите помещение'); return }
    if (step===1&&!answers.style) { toast.error('Выберите стиль'); return }
    if (step===2&&answers.budgetMin>=answers.budgetMax) { toast.error('Проверьте бюджет'); return }
    if (step===3&&!answers.deadline) { toast.error('Выберите срок'); return }
    if (step===4&&answers.colors.length===0) { toast.error('Выберите цвет'); return }
    const names=['room','style','budget','deadline','colors']
    const vals=[answers.room,answers.style,`${answers.budgetMin}–${answers.budgetMax}`,answers.deadline,answers.colors.join(', ')]
    dispatch(nextStep()); if(step<5) fetchTip(names[step],vals[step])
  }

  const handleSubmit = async () => {
    if (!answers.contactName.trim()) { toast.error('Введите имя'); return }
    if (!answers.contactPhone.trim()) { toast.error('Введите телефон'); return }
    if (!captchaOk) { toast.error('Решите капчу'); return }
    dispatch(setSubmitting(true))
    try {
      const res=await api.post('/quiz/submit',{
        room:answers.room,style:answers.style,budget_min:answers.budgetMin,budget_max:answers.budgetMax,
        deadline:answers.deadline,colors:answers.colors,wishes:answers.wishes,
        contact_name:answers.contactName,contact_phone:answers.contactPhone,contact_email:answers.contactEmail,
        estimated_cost:calcCost(answers)
      })
      dispatch(setResult(res.data)); dispatch(resetQuiz()); navigate(`/result/${res.data.share_link}`)
    } catch(e:any) { toast.error(e.response?.data?.detail||'Ошибка отправки') }
    finally { dispatch(setSubmitting(false)) }
  }

  const random=()=>{
    if(step===0) dispatch(updateAnswers({room:ROOMS[Math.floor(Math.random()*ROOMS.length)]}))
    if(step===1) dispatch(updateAnswers({style:STYLES[Math.floor(Math.random()*STYLES.length)]}))
    if(step===3) dispatch(updateAnswers({deadline:DEADLINES[Math.floor(Math.random()*DEADLINES.length)]}))
    if(step===4) dispatch(updateAnswers({colors:[...COLORS].sort(()=>0.5-Math.random()).slice(0,2).map(c=>c.value)}))
  }

  return (
    <div className="min-h-screen py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mb-2">Создайте свой стиль</h1>
          <p className="text-white/60">Ответьте на 6 вопросов — получите дизайн-проект</p>
        </div>
        <div className="card">
          <QuizProgress step={step} />
          <AnimatePresence mode="wait">
            <motion.div key={step} variants={V} initial="enter" animate="center" exit="exit" transition={{duration:0.3}}>
              {step===0&&<div>
                <h2 className="font-display text-2xl font-bold text-white mb-6">Какую комнату оформляем?</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {ROOMS.map(r=><button key={r} onClick={()=>dispatch(updateAnswers({room:r}))} className={`p-4 rounded-xl border text-sm font-medium transition-all ${BTN(answers.room===r)}`}>{r}</button>)}
                </div>
              </div>}
              {step===1&&<div>
                <h2 className="font-display text-2xl font-bold text-white mb-6">Выберите стиль интерьера</h2>
                <div className="grid grid-cols-2 gap-3">
                  {STYLES.map(s=><button key={s} onClick={()=>dispatch(updateAnswers({style:s}))} className={`p-4 rounded-xl border text-sm font-medium transition-all ${BTN(answers.style===s)}`}>{s}</button>)}
                </div>
              </div>}
              {step===2&&<div>
                <h2 className="font-display text-2xl font-bold text-white mb-2">Бюджет</h2>
                <p className="text-white/60 text-sm mb-6">В тысячах рублей</p>
                <div className="space-y-6">
                  <div><label className="text-sm text-white/70 mb-2 block">Минимум: <span className="text-primary font-bold">{answers.budgetMin} тыс.</span></label><input type="range" min={50} max={2000} step={50} value={answers.budgetMin} onChange={e=>dispatch(updateAnswers({budgetMin:+e.target.value}))} className="w-full"/></div>
                  <div><label className="text-sm text-white/70 mb-2 block">Максимум: <span className="text-primary font-bold">{answers.budgetMax} тыс.</span></label><input type="range" min={50} max={5000} step={50} value={answers.budgetMax} onChange={e=>dispatch(updateAnswers({budgetMax:+e.target.value}))} className="w-full"/></div>
                  <div className="card bg-primary/5 border-primary/20 text-center"><p className="text-white/60 text-sm">Оценочная стоимость</p><p className="font-display text-2xl font-bold text-primary mt-1">{calcCost(answers).toLocaleString('ru')} ₽</p></div>
                </div>
              </div>}
              {step===3&&<div>
                <h2 className="font-display text-2xl font-bold text-white mb-6">Сроки выполнения</h2>
                <div className="grid grid-cols-2 gap-3">
                  {DEADLINES.map(d=><button key={d} onClick={()=>dispatch(updateAnswers({deadline:d}))} className={`p-4 rounded-xl border text-sm font-medium transition-all ${BTN(answers.deadline===d)}`}>{d}</button>)}
                </div>
              </div>}
              {step===4&&<div>
                <h2 className="font-display text-2xl font-bold text-white mb-2">Цветовая гамма</h2>
                <p className="text-white/60 text-sm mb-6">Можно несколько</p>
                <div className="grid grid-cols-2 gap-3">
                  {COLORS.map(({label,value})=><button key={value} onClick={()=>dispatch(toggleColor(value))} className={`p-4 rounded-xl border text-sm font-medium text-left transition-all ${BTN(answers.colors.includes(value))}`}>{label}</button>)}
                </div>
              </div>}
              {step===5&&<div className="space-y-6">
                <div><h2 className="font-display text-2xl font-bold text-white mb-2">Пожелания и контакты</h2><p className="text-white/60 text-sm">Последний шаг</p></div>
                <div><label className="text-sm text-white/70 mb-2 block">Пожелания к дизайну</label>
                  <div className="relative"><textarea value={answers.wishes} onChange={e=>dispatch(updateAnswers({wishes:e.target.value}))} placeholder="Хочу светлое и просторное..." rows={3} className="input resize-none pr-12"/><div className="absolute right-3 bottom-3"><VoiceInput onResult={t=>dispatch(updateAnswers({wishes:t}))}/></div></div>
                </div>
                <PhotoUpload/>
                <div className="space-y-3">
                  <p className="text-sm font-medium text-white/70">Контактные данные</p>
                  <input value={answers.contactName} onChange={e=>dispatch(updateAnswers({contactName:e.target.value}))} placeholder="Ваше имя *" className="input"/>
                  <input value={answers.contactPhone} onChange={e=>dispatch(updateAnswers({contactPhone:e.target.value}))} placeholder="+7 (___) ___-__-__ *" className="input"/>
                  <input value={answers.contactEmail} onChange={e=>dispatch(updateAnswers({contactEmail:e.target.value}))} placeholder="Email (необязательно)" className="input"/>
                </div>
                <SimpleCaptcha onValid={setCaptchaOk}/>
              </div>}
            </motion.div>
          </AnimatePresence>
          <TipBox tip={tip} loading={tipLoading}/>
          <div className="flex items-center justify-between mt-8 gap-3">
            <div className="flex gap-2">
              {step>0&&<button onClick={()=>dispatch(prevStep())} className="btn-secondary flex items-center gap-2"><ChevronLeft size={18}/>Назад</button>}
              {step<5&&step!==2&&<button onClick={random} className="p-3 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all" title="Случайный ответ"><Shuffle size={16}/></button>}
            </div>
            {step<5
              ? <button onClick={handleNext} className="btn-primary flex items-center gap-2">Далее<ChevronRight size={18}/></button>
              : <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex items-center gap-2 min-w-[160px] justify-center">
                  {submitting?<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Создаём...</>:'🎨 Получить дизайн'}
                </button>
            }
          </div>
        </div>
      </div>
    </div>
  )
}
