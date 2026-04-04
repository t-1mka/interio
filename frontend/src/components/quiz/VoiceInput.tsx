import { useState, useRef } from 'react'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'

interface VoiceInputProps {
  onResult: (text: string) => void
  className?: string
}

export default function VoiceInput({ onResult, className = '' }: VoiceInputProps) {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorder.current = recorder
      chunks.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data)
      }

      recorder.onstop = async () => {
        setProcessing(true)
        try {
          const blob = new Blob(chunks.current, { type: 'audio/webm' })
          const formData = new FormData()
          formData.append('audio', blob, 'voice.wav')

          const res = await api.post('/quiz/speech-recognize', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          const text = res.data.text
          if (text) {
            onResult(text)
            toast.success('Речь распознана!')
          } else {
            toast.error('Не удалось распознать речь')
          }
        } catch {
          toast.error('Ошибка распознавания речи')
        } finally {
          setProcessing(false)
          stream.getTracks().forEach(t => t.stop())
        }
      }

      recorder.start()
      setRecording(true)
    } catch {
      toast.error('Нет доступа к микрофону')
    }
  }

  const stopRecording = () => {
    mediaRecorder.current?.stop()
    setRecording(false)
  }

  return (
    <button
      type="button"
      onClick={recording ? stopRecording : startRecording}
      disabled={processing}
      className={`p-3 rounded-xl transition-all ${
        recording
          ? 'bg-primary text-white animate-pulse-soft'
          : 'bg-white/10 text-white/60 hover:text-white hover:bg-white/20'
      } ${className}`}
      title={recording ? 'Остановить запись' : 'Голосовой ввод'}
    >
      {processing ? (
        <Loader2 size={18} className="animate-spin" />
      ) : recording ? (
        <MicOff size={18} />
      ) : (
        <Mic size={18} />
      )}
    </button>
  )
}
