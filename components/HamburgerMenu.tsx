'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { signOutAction } from '@/app/login/actions';

interface NavItem {
  href: string;
  icon: string;
  title: string;
  hint: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface HamburgerMenuProps {
  navGroups: NavGroup[];
  displayName: string;
  initials: string;
  userRole: string;
}

export default function HamburgerMenu({ navGroups, displayName, initials, userRole }: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setIsOpen(false);
  };

  return (
    <>
      {/* Hamburger Toggle Button - Only visible on mobile */}
      {!isOpen && 
      <button
        type="button"
        className="hamburger-toggle"
        onClick={() => {setIsOpen(!isOpen)
          // console.log("Hamburger menu toggled:", !isOpen ? "opened" : "closed")
        }}
        aria-label="Toggle menu"
        aria-expanded={isOpen}
      >
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
      </button>}
      

      {/* Backdrop - Closes menu when clicked */}
      {isOpen && (
        <div
          className="hamburger-backdrop hamburger-backdrop-v12"
          onClick={handleBackdropClick}
        />
      )}

      {/* Mobile Drawer - Slides in from left */}
      <nav className={`hamburger-drawer hamburger-drawer-v12 ${isOpen ? 'is-open' : ''}`}>
        {/* Drawer Header */}
        <div className="hamburger-drawer-header hamburger-drawer-header-v12">
          <Link href="/dashboard" className="brand brand-v39" onClick={() => setIsOpen(false)}>
            <span className="brand-mark brand-mark-v39">♪</span>
            <span className="brand-text brand-text-v39">
              <strong>Cântări</strong>
              <span>Library & Planning</span>
            </span>
          </Link>
          <button
            type="button"
            className="hamburger-close hamburger-close-v12"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Navigation Groups */}
        <div className="hamburger-nav-list hamburger-nav-list-v12">
          <nav className="nav nav-v39" aria-label="Meniu principal">
            {navGroups.map((group) => (
              <div className="nav-group-v39" key={group.label}>
                <span className="nav-label nav-label-v39">{group.label}</span>
                <div className="nav-group-items-v39">
                  {group.items.map((item) => (
                    <Link
                      className="nav-link-v39"
                      href={item.href}
                      key={item.href}
                      onClick={() => setIsOpen(false)}
                    >
                      <span className="nav-icon-v39" aria-hidden="true">{item.icon}</span>
                      <span className="nav-link-copy-v39">
                        <span>{item.title}</span>
                        <small>{item.hint}</small>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Drawer Footer */}
        <div className="sidebar-footer sidebar-footer-v39 hamburger-drawer-footer hamburger-drawer-footer-v12">
          <div className="user-pill user-pill-v39 hamburger-user-pill hamburger-user-pill-v12">
            <span className="avatar avatar-v39 hamburger-avatar hamburger-avatar-v12">{initials}</span>
            <span className="user-copy-v39 hamburger-user-copy hamburger-user-copy-v12">
              <strong>{displayName}</strong>
              <span>{userRole || 'viewer'}</span>
            </span>
          </div>
          <form action={signOutAction}>
            <button className="btn secondary full-width hamburger-btn-logout hamburger-btn-logout-v12" type="submit">
              Ieșire
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}
