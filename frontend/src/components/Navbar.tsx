"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <svg width="32" height="32" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="navShieldGrad" x1="60" y1="10" x2="60" y2="110" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="var(--green)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="navPulseGrad" x1="20" y1="60" x2="100" y2="60" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="var(--green)" stopOpacity="0.2" />
                <stop offset="30%" stopColor="var(--green)" stopOpacity="1" />
                <stop offset="70%" stopColor="var(--green)" stopOpacity="1" />
                <stop offset="100%" stopColor="var(--green)" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <path d="M60 10 L100 30 L100 60 C100 85 75 105 60 112 C45 105 20 85 20 60 L20 30 Z" fill="url(#navShieldGrad)" />
            <path d="M60 10 L100 30 L100 60 C100 85 75 105 60 112 C45 105 20 85 20 60 L20 30 Z" stroke="var(--green)" strokeWidth="2.5" strokeLinejoin="round" strokeOpacity="0.5" fill="none" />
            <polyline points="25,62 40,62 48,62 55,58 60,40 65,55 70,62 78,62 95,62" stroke="url(#navPulseGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <circle cx="60" cy="40" r="3.5" fill="var(--green)" opacity="0.8" />
          </svg>
        </Link>

        <div className="flex items-center gap-1">
          <NavLink href="/" active={pathname === "/"}>Home</NavLink>
          <NavLink href="/explore" active={pathname === "/explore"}>Explore</NavLink>
          <a
            href="https://github.com/aman035/depegShield"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 p-1.5 text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
            aria-label="GitHub"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          </a>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-md text-[13px] transition-colors ${
        active
          ? "text-[var(--text)] bg-[var(--bg-raised)]"
          : "text-[var(--text-secondary)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </Link>
  );
}
