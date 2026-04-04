import { useRef, useState } from 'react'
import { Upload, X, Image } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
import { updateAnswers } from '../../store/quizSlice'

export default function PhotoUpload() {
  const dispatch = useAppDispatch()
  const photos = useAppSelector(s => s.quiz.answers.photos)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || photos.length >= 5) {
      toast.error('Максимум 5 фото')
      return
    }
    setUploading(true)
    const newUrls: string[] = []

    for (const file of Array.from(files).slice(0, 5 - photos.length)) {
      if (!file.type.startsWith('image/')) continue
      // Client-side compression via canvas
      const compressed = await compressImage(file, 1200)
      const formData = new FormData()
      formData.append('file', compressed, file.name)
      try {
        const res = await api.post('/quiz/upload-photo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        newUrls.push(res.data.url)
      } catch {
        toast.error(`Ошибка загрузки ${file.name}`)
      }
    }

    dispatch(updateAnswers({ photos: [...photos, ...newUrls] }))
    setUploading(false)
  }

  const removePhoto = (url: string) => {
    dispatch(updateAnswers({ photos: photos.filter(p => p !== url) }))
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/60">Загрузите фото помещения (до 5 шт.)</p>

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
        className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-primary">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Загрузка...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-white/50">
            <Upload size={24} />
            <span className="text-sm">Нажмите или перетащите</span>
            <span className="text-xs text-white/30">JPG, PNG до 10MB</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      {/* Previews */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {photos.map(url => (
            <div key={url} className="relative group aspect-square rounded-xl overflow-hidden">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removePhoto(url)}
                className="absolute top-1 right-1 p-1 bg-dark/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} className="text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

async function compressImage(file: File, maxWidth: number): Promise<File> {
  return new Promise((resolve) => {
    const img = document.createElement('img')
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ratio = Math.min(1, maxWidth / img.width)
      canvas.width = img.width * ratio
      canvas.height = img.height * ratio
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url)
        resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file)
      }, 'image/jpeg', 0.85)
    }
    img.src = url
  })
}
