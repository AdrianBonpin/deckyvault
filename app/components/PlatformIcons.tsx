import { FaWindows, FaApple, FaLinux } from "react-icons/fa"

export function WindowsIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return <FaWindows className={className} aria-label="Windows" />
}

export function MacIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return <FaApple className={className} aria-label="macOS" />
}

export function LinuxIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return <FaLinux className={className} aria-label="Linux" />
}
