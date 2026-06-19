"use client"

import { motion, useAnimationFrame } from "framer-motion"
import { useRef } from "react"
import { useTypingText } from "@/hooks/use-typing-text"

const VIEW_W = 1400
const VIEW_H = 360

function buildWavePath(
  width: number,
  amplitude: number,
  frequency: number,
  verticalOffset: number,
  phase: number,
  samples = 120,
) {
  const step = width / samples
  let d = `M0 ${verticalOffset}`
  for (let i = 0; i <= samples; i++) {
    const x = i * step
    const y =
      verticalOffset +
      Math.sin(i * frequency + phase) * amplitude +
      Math.sin(i * frequency * 0.5 + phase * 1.7) * amplitude * 0.3
    d += ` L${x.toFixed(2)} ${y.toFixed(2)}`
  }
  return d
}

export function Hero() {
  const typed = useTypingText()

  const pathARef = useRef<SVGPathElement | null>(null)
  const pathBRef = useRef<SVGPathElement | null>(null)
  const pathCRef = useRef<SVGPathElement | null>(null)

  useAnimationFrame((t) => {
    // seconds since first frame
    const tSec = t / 1000
    if (pathCRef.current) {
      pathCRef.current.setAttribute(
        "d",
        buildWavePath(VIEW_W, 38, 0.03, VIEW_H * 0.5, tSec * 0.6 + Math.PI),
      )
    }
    if (pathBRef.current) {
      pathBRef.current.setAttribute(
        "d",
        buildWavePath(VIEW_W, 18, 0.07, VIEW_H * 0.5, tSec * 0.8 + Math.PI / 3),
      )
    }
    if (pathARef.current) {
      pathARef.current.setAttribute(
        "d",
        buildWavePath(VIEW_W, 28, 0.045, VIEW_H * 0.5, tSec * 1.4),
      )
    }
  })

  return (
    <section className="relative isolate overflow-hidden border-b border-border">
      {/* Background: vignette + grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(80% 60% at 50% 35%, rgba(59,130,246,0.10) 0%, rgba(0,0,0,0) 60%), radial-gradient(60% 50% at 50% 100%, rgba(0,229,160,0.08) 0%, rgba(0,0,0,0) 65%), #000000",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(60% 50% at 50% 50%, black 0%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(60% 50% at 50% 50%, black 0%, transparent 75%)",
        }}
      />

      {/* Animated signal waves */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 -translate-y-1/2">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="h-[360px] w-full"
          aria-hidden
        >
          <defs>
            <linearGradient id="wave-a" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
              <stop offset="50%" stopColor="var(--accent)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="wave-b" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="var(--high)" stopOpacity="0" />
              <stop offset="50%" stopColor="var(--high)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="var(--high)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="wave-c" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="var(--low)" stopOpacity="0" />
              <stop offset="50%" stopColor="var(--low)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--low)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            ref={pathCRef}
            stroke="url(#wave-c)"
            strokeWidth={1.4}
            fill="none"
          />
          <path
            ref={pathBRef}
            stroke="url(#wave-b)"
            strokeWidth={1.6}
            fill="none"
          />
          <path
            ref={pathARef}
            stroke="url(#wave-a)"
            strokeWidth={2}
            fill="none"
          />
        </svg>
      </div>

      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 pb-24 pt-20 text-center md:pb-32 md:pt-28">
        {/* Status pill */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-panel-2/60 px-3.5 py-1.5 text-xs text-muted-foreground backdrop-blur"
        >
          <span>Financial Intelligence Unit</span>
          <span className="h-1 w-1 rounded-full bg-border-2" />
          <a className="font-medium text-foreground" href="#dashboard">
            AML Analytics
          </a>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="text-balance font-sans text-5xl font-bold leading-[1.05] tracking-[-0.035em] text-foreground md:text-7xl"
        >
          Your complete platform for the <span className="text-low">Signal.</span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-5 flex items-center gap-2"
        >
          <span className="relative flex h-2.5 w-2.5">
            <motion.span
              className="absolute inline-flex h-full w-full rounded-full bg-high opacity-75"
              animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-high" />
          </span>
          <span className="font-mono text-xs font-medium text-high">
            Available Now
          </span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 text-2xl font-medium text-foreground md:text-3xl"
        >
          Welcome to STR{" "}
          <span className="font-bold text-low">Signal</span> Intelligence
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground"
        >
          Automated completeness scoring and intelligence generation to empower
          financial analysts. We utilise{" "}
          <span className="font-semibold text-accent">{typed}</span>
          <span className="ml-0.5 inline-block w-[2px] -translate-y-[1px] bg-accent align-middle animate-pulse" />
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <a
            href="#dashboard"
            className="group inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-transform duration-200 hover:scale-[1.02]"
          >
            Analyze Data
            <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">
              →
            </span>
          </a>
          <a
            href="#dashboard"
            className="inline-flex items-center rounded-lg border border-border bg-panel-2/40 px-5 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-border-2 hover:bg-panel-2"
          >
            View Dashboard
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mt-16 grid w-full max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border text-[11px] md:grid-cols-4"
        >
          {[
            { k: "Reports Scored", v: "276" },
            { k: "Pipeline Stages", v: "3" },
            { k: "Features per Tx", v: "100k+" },
            { k: "Inference", v: "< 30s" },
          ].map((s) => (
            <div key={s.k} className="bg-background px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                {s.k}
              </div>
              <div className="mt-1 font-mono text-lg tabular-nums text-foreground">
                {s.v}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}