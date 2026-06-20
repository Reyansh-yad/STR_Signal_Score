"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

export function Navbar() {
  const [activeSection, setActiveSection] = React.useState("overview")

  const pathname = usePathname()

  React.useEffect(() => {
    if (pathname !== "/") return
    const handleScroll = () => {
      const sections = ["overview", "eda", "scoring", "queue"]
      let current = "overview"
      for (const section of sections) {
        const el = document.getElementById(section)
        if (el && window.scrollY >= el.offsetTop - 150) {
          current = section
        }
      }
      setActiveSection(current)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [pathname])

  const scrollTo = (id: string) => {
    if (pathname !== "/") {
      window.location.href = `/#${id}`
      return
    }
    const el = document.getElementById(id)
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 80
      window.scrollTo({ top: y, behavior: "smooth" })
    }
  }

  const mainNavItems = [
    { id: "overview", label: "Overview" },
    { id: "eda", label: "EDA Analysis" },
    { id: "scoring", label: "Scoring Engine" },
  ]

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-panel-2 border border-border">
            <svg className="h-4 w-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-sans font-semibold tracking-tight text-foreground">
            STR <span className="text-low">Signal</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex md:items-center md:gap-1">
          {mainNavItems.map((item) => {
            const isActive = pathname === "/" && activeSection === item.id
            return (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className={cn(
                  "relative rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-panel-2 hover:text-foreground",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {item.label}
                {isActive && (
                  <motion.div
                    layoutId="navbar-active"
                    className="absolute bottom-0 left-0 h-[2px] w-full bg-accent"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </button>
            )
          })}
          
          <div className="w-px h-4 bg-border mx-2" />
          
          <Link
            href="/reports"
            className={cn(
              "relative rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-panel-2 hover:text-foreground",
              pathname === "/reports" ? "text-foreground" : "text-muted-foreground"
            )}
          >
            All Reports
            {pathname === "/reports" && (
              <motion.div
                layoutId="navbar-active"
                className="absolute bottom-0 left-0 h-[2px] w-full bg-accent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </Link>
          
          <Link
            href="/compare"
            className={cn(
              "relative rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-panel-2 hover:text-foreground",
              pathname === "/compare" ? "text-foreground" : "text-muted-foreground"
            )}
          >
            Upload & Compare
            {pathname === "/compare" && (
              <motion.div
                layoutId="navbar-active"
                className="absolute bottom-0 left-0 h-[2px] w-full bg-accent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </Link>
        </div>

        {/* Mobile menu button (visual only for now) */}
        <div className="flex items-center md:hidden">
          <button className="text-muted-foreground hover:text-foreground">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  )
}
