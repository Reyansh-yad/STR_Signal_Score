"use client"

import { animate, useMotionValue, useTransform } from "framer-motion"
import { useEffect, useState } from "react"

export interface CountUpProps {
  value: number
  /** Number of decimal places to format. */
  decimals?: number
  duration?: number
  className?: string
  /** If true, render as a percentage (×100, % suffix). */
  asPercent?: boolean
}

/**
 * Counts from 0 → value with an ease-out curve, formats to `decimals`,
 * and re-runs whenever `value` changes.
 */
export function CountUp({
  value,
  decimals = 0,
  duration = 0.9,
  className,
  asPercent = false,
}: CountUpProps) {
  const mv = useMotionValue(0)
  const display = useTransform(mv, (latest) => {
    if (asPercent) {
      return `${(latest * 100).toFixed(decimals)}%`
    }
    return latest.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  })
  const [text, setText] = useState(() =>
    asPercent
      ? `0${decimals ? `.${"0".repeat(decimals)}` : ""}%`
      : (0).toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }),
  )

  useEffect(() => {
    const controls = animate(mv, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
    })
    const unsub = display.on("change", (v) => setText(v))
    return () => {
      controls.stop()
      unsub()
    }
  }, [value, duration, mv, display])

  return <span className={className}>{text}</span>
}