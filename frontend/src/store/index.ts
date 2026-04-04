import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice'
import quizReducer from './quizSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    quiz: quizReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
