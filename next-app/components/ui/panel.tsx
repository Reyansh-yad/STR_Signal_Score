import * as React from "react"
import { cn } from "@/lib/utils"

export function Panel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-panel/80 backdrop-blur-sm",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset]",
        className,
      )}
      {...props}
    />
  )
}

export function SectionLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted",
        className,
      )}
      {...props}
    />
  )
}

type Tone = "neutral" | "high" | "med" | "low" | "accent"

const toneClass: Record<Tone, string> = {
  neutral: "text-foreground",
  high: "text-high",
  med: "text-med",
  low: "text-low",
  accent: "text-accent",
}

const toneDot: Record<Tone, string> = {
  neutral: "bg-muted",
  high: "bg-high",
  med: "bg-med",
  low: "bg-low",
  accent: "bg-accent",
}

export interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: React.ReactNode
  sublabel?: string
  tone?: Tone
  /** When true, displays the value in tabular monospace at a larger size. */
  big?: boolean
}

export function KpiCard({
  label,
  value,
  sublabel,
  tone = "neutral",
  big = true,
  className,
  ...props
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-panel/80 p-5",
        "transition-all duration-300 hover:-translate-y-0.5 hover:border-border-2 hover:bg-panel-2",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <span className={cn("h-1.5 w-1.5 rounded-full", toneDot[tone])} />
        <SectionLabel>{label}</SectionLabel>
      </div>
      <div
        className={cn(
          "mt-3 font-mono font-medium tabular-nums leading-none tracking-tight",
          big ? "text-3xl md:text-4xl" : "text-xl",
          toneClass[tone],
        )}
      >
        {value}
      </div>
      {sublabel ? (
        <div className="mt-2 text-xs text-muted">{sublabel}</div>
      ) : null}
      <div
        className={cn(
          "pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-30",
          tone === "high" && "bg-high",
          tone === "med" && "bg-med",
          tone === "low" && "bg-low",
          tone === "accent" && "bg-accent",
          tone === "neutral" && "bg-muted",
        )}
      />
    </div>
  )
}
