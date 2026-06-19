import { Space_Grotesk, JetBrains_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SmoothCursor } from "@/components/ui/smooth-cursor"
import { Navbar } from "@/components/navbar"
import { cn } from "@/lib/utils";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        spaceGrotesk.variable,
        jetBrainsMono.variable,
        "font-sans dark",
      )}
    >
      <body className="cursor-none bg-background text-foreground">
        <ThemeProvider>
          <SmoothCursor />
          <Navbar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
