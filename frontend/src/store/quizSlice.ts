import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface QuizAnswers {
  room: string
  style: string
  budgetMin: number
  budgetMax: number
  deadline: string
  colors: string[]
  wishes: string
  contactName: string
  contactPhone: string
  contactEmail: string
  photos: string[]
}

interface QuizState {
  step: number
  answers: QuizAnswers
  tip: string
  tipLoading: boolean
  submitting: boolean
  result: any | null
}

const defaultAnswers: QuizAnswers = {
  room: '',
  style: '',
  budgetMin: 100,
  budgetMax: 500,
  deadline: '',
  colors: [],
  wishes: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  photos: [],
}

// Load draft from localStorage
const loadDraft = (): Partial<QuizAnswers> => {
  try {
    const saved = localStorage.getItem('quiz_draft')
    return saved ? JSON.parse(saved) : {}
  } catch { return {} }
}

const initialState: QuizState = {
  step: 0,
  answers: { ...defaultAnswers, ...loadDraft() },
  tip: '',
  tipLoading: false,
  submitting: false,
  result: null,
}

const quizSlice = createSlice({
  name: 'quiz',
  initialState,
  reducers: {
    setStep: (state, action: PayloadAction<number>) => {
      state.step = Math.max(0, Math.min(5, action.payload))
    },
    nextStep: (state) => { state.step = Math.min(5, state.step + 1) },
    prevStep: (state) => { state.step = Math.max(0, state.step - 1) },
    updateAnswers: (state, action: PayloadAction<Partial<QuizAnswers>>) => {
      state.answers = { ...state.answers, ...action.payload }
      // Auto-save to localStorage
      localStorage.setItem('quiz_draft', JSON.stringify(state.answers))
    },
    setTip: (state, action: PayloadAction<string>) => { state.tip = action.payload },
    setTipLoading: (state, action: PayloadAction<boolean>) => { state.tipLoading = action.payload },
    setSubmitting: (state, action: PayloadAction<boolean>) => { state.submitting = action.payload },
    setResult: (state, action: PayloadAction<any>) => { state.result = action.payload },
    resetQuiz: (state) => {
      state.step = 0
      state.answers = defaultAnswers
      state.tip = ''
      state.result = null
      localStorage.removeItem('quiz_draft')
    },
    toggleColor: (state, action: PayloadAction<string>) => {
      const color = action.payload
      const idx = state.answers.colors.indexOf(color)
      if (idx >= 0) {
        state.answers.colors = state.answers.colors.filter(c => c !== color)
      } else {
        state.answers.colors = [...state.answers.colors, color]
      }
      localStorage.setItem('quiz_draft', JSON.stringify(state.answers))
    },
  },
})

export const {
  setStep, nextStep, prevStep, updateAnswers, setTip, setTipLoading,
  setSubmitting, setResult, resetQuiz, toggleColor
} = quizSlice.actions
export default quizSlice.reducer
