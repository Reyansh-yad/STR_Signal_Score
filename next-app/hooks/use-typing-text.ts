"use client"

import { useEffect, useState } from "react"

const PHRASES = [
  "NLP Analysis",
  "Boilerplate Detection",
  "Completeness Scoring",
  "TF-IDF & k-NN",
  "Priority Queues",
]

/**
 * Cycles through `phrases` with a typing/deleting effect.
 * Returns the currently-displayed string.
 */
export function useTypingText(phrases: string[] = PHRASES) {
  const [text, setText] = useState("")

  useEffect(() => {
    if (phrases.length === 0) return
    let mounted = true
    let phraseIdx = 0
    let charIdx = 0
    let deleting = false

    const tick = () => {
      if (!mounted) return
      const cur = phrases[phraseIdx]
      if (!deleting) {
        charIdx++
        setText(cur.slice(0, charIdx))
        if (charIdx === cur.length) {
          deleting = true
          window.setTimeout(tick, 1500)
          return
        }
        window.setTimeout(tick, 80)
      } else {
        charIdx--
        setText(cur.slice(0, charIdx))
        if (charIdx === 0) {
          deleting = false
          phraseIdx = (phraseIdx + 1) % phrases.length
          window.setTimeout(tick, 500)
          return
        }
        window.setTimeout(tick, 30)
      }
    }

    const start = window.setTimeout(tick, 400)
    return () => {
      mounted = false
      window.clearTimeout(start)
    }
  }, [phrases])

  return text
}