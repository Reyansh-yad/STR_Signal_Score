"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"

export function FileUpload() {
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files))
    }
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setIsUploading(true)
    setError(null)

    const formData = new FormData()
    files.forEach((file) => {
      formData.append("files", file)
    })

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Upload failed")
      }

      // After successful upload, we receive a datasetId or simply 
      // navigate to the comparison dashboard.
      router.push(`/compare/results?id=${data.datasetId}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <div
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
          isDragging
            ? "border-accent bg-accent/10"
            : "border-border hover:border-accent/50 hover:bg-panel-2/50"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          multiple
          accept=".xml,.csv"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        
        <svg className="mx-auto h-12 w-12 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>

        <p className="mt-4 text-sm font-medium text-foreground">
          Drag and drop XML reports or a pre-scored CSV here
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          or click to select files from your computer
        </p>
      </div>

      {files.length > 0 && (
        <div className="mt-6 bg-panel-2 rounded-lg p-4">
          <h4 className="text-sm font-medium mb-3">Selected Files ({files.length})</h4>
          <ul className="text-xs text-muted-foreground space-y-2 max-h-40 overflow-y-auto">
            {files.map((f, i) => (
              <li key={i} className="flex justify-between items-center">
                <span className="truncate">{f.name}</span>
                <span>{(f.size / 1024).toFixed(1)} KB</span>
              </li>
            ))}
          </ul>
          
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-md text-xs">
              {error}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="bg-accent text-accent-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isUploading ? "Processing..." : "Upload & Analyze"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
