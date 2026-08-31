import React, { useState, useEffect, useRef } from 'react';
import { getStoredUser, logout } from '../api';
import './AppChrome.css';

// Shared site header used on every page.
// Shows the logo/brand on the left, optional nav links in the middle,
// and a circular avatar button on the right that opens a dropdown nav menu.
export function AppHeader({
  admin = false,
  nav = null,
  activeHref = null,
  hideLogin = false,
}) {
  const user = getStoredUser();
  const showAdmin = Boolean(user?.is_staff) || admin;
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const currentPath = window.location.pathname;
  const displayName = user?.first_name
    ? `${user.first_name}${user.last_name ? ` ${user.last_name}` : ''}`
    : user?.username || (admin ? 'Admin' : 'User');
  const initial = (displayName || 'U').charAt(0).toUpperCase();
  const avatarColor = profileColor(user?.id || (showAdmin ? 0 : displayName));

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const go = (href) => {
    setOpen(false);
    window.location.href = href;
  };

  return (
    <header className='public-home-header public-home-header-dark app-header-admin'>
      {/* Brand / logo — left side */}
      <button
        className='public-brand'
        onClick={() => go('/')}
        aria-label='Content Consult home'
      >
        <img src='/content-consult-logo.png' alt='Content Consult' />
        <span>
          <strong>CONTENT CONSULT</strong>
          <small>CONTENT WORKSPACE</small>
        </span>
      </button>

      {/* Optional page nav links (home page only) */}
      {nav && (
        <nav className='public-nav' aria-label='Main navigation'>
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={
                (activeHref ? item.href === activeHref : item.active)
                  ? 'active'
                  : ''
              }
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}

      {/* Right-side actions */}
      <div className='public-header-actions'>
        {/* Not signed in — show Login button */}
        {!user && !hideLogin && (
          <button className='public-login-btn' onClick={() => go('/login')}>
            Login <span>→</span>
          </button>
        )}

        {/* Signed in — circular avatar that opens a dropdown */}
        {user && (
          <div className='app-header-account-wrapper' ref={wrapperRef}>
            {/* Dropdown nav panel */}
            {open && (
              <div className='app-header-dropdown-menu' role='menu'>
                {/* User info */}
                <div className='app-header-dropdown-head'>
                  <span
                    className='app-dropdown-avatar'
                    style={{ background: avatarColor }}
                  >
                    {initial}
                  </span>
                  <div className='app-dropdown-user-info'>
                    <strong>{showAdmin ? 'Admin' : displayName}</strong>
                    <small>{user?.email || 'Signed in'}</small>
                  </div>
                </div>

                <div className='app-dropdown-divider' />

                <button
                  className={`app-dropdown-item${
                    currentPath === '/workspace' ? ' app-dropdown-active' : ''
                  }`}
                  onClick={() => go('/workspace')}
                >
                  Workspace
                </button>

                <button
                  className={`app-dropdown-item${
                    currentPath === '/drafts' ? ' app-dropdown-active' : ''
                  }`}
                  onClick={() => go('/drafts')}
                >
                  Drafts
                </button>

                {showAdmin && (
                  <button
                    className={`app-dropdown-item${
                      currentPath.startsWith('/admin')
                        ? ' app-dropdown-active'
                        : ''
                    }`}
                    onClick={() => go('/admin')}
                  >
                    Admin panel
                  </button>
                )}

                <div className='app-dropdown-divider' />

                <button
                  className='app-dropdown-item app-dropdown-logout'
                  onClick={() => logout()}
                >
                  Log out
                </button>
              </div>
            )}

            {/* Avatar circle trigger */}
            <button
              className={`app-avatar-trigger${open ? ' is-open' : ''}`}
              onClick={() => setOpen((v) => !v)}
              aria-haspopup='menu'
              aria-expanded={open}
              title={`${displayName} — open menu`}
              style={{ background: avatarColor }}
            >
              {initial}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export function AppFooter() {
  const goBack = () => {
    const path = window.location.pathname;
    if (path === '/admin/users' || /^\/admin\/users\/\d+$/.test(path)) {
      window.location.href = '/admin/users';
      return;
    }
    if (path.startsWith('/admin')) {
      window.location.href = '/admin';
      return;
    }
    if (path === '/drafts') {
      window.location.href = '/workspace';
      return;
    }
    if (window.history.length > 1) window.history.back();
    else window.location.href = '/workspace';
  };

  return (
    <footer className='app-footer'>
      <div className='app-footer-inner'>
        <div className='app-footer-brand'>
          <strong>CONTENT CONSULT</strong>
          <span>Professional AI-assisted content workspace</span>
        </div>
        <nav className='app-footer-links' aria-label='Footer navigation'>
          <button type='button' className='app-footer-back' onClick={goBack}>
            ← Go back
          </button>
          <a href='/workspace'>Workspace</a>
          <a href='/drafts'>Drafts</a>
          <a href='https://www.leadseo.com/' target='_blank' rel='noreferrer'>
            LeadSEO
          </a>
          <a href='https://niftysoft.com/' target='_blank' rel='noreferrer'>
            Niftysoft
          </a>
        </nav>
        <div className='app-footer-meta'>
          <span>© Copyright 2026 Lead SEO Marketing Private Limited</span>
          <span>Built for clear, consistent content</span>
        </div>
      </div>
    </footer>
  );
}

export function PublicFooter() {
  return (
    <footer className='public-site-footer cc-reveal'>
      <div className='public-footer-grid'>
        <div className='public-footer-brand'>
          <strong>CONTENT CONSULT</strong>
          <span>
            AI-assisted content workspace for a faster, clearer workflow.
          </span>
          <small>© Copyright 2026 Lead SEO Marketing Private Limited</small>
        </div>
        <div className='public-footer-column'>
          <span>PRODUCT</span>
          <a href='/#content'>Content types</a>
          <a href='/#content'>AI Content Generation</a>
          <a href='/#workspace'>Workspace</a>
          <a href='/login'>Get started</a>
        </div>
        <div className='public-footer-column'>
          <span>COMPANY</span>
          <a href='https://www.leadseo.com/' target='_blank' rel='noreferrer'>
            LeadSEO
          </a>
        </div>
        <div className='public-footer-column'>
          <span>LEGAL</span>
          <a href='/#'>Privacy Policy</a>
          <a href='/#'>Terms of Service</a>
          <a href='https://niftysoft.com/' target='_blank' rel='noreferrer'>
            Niftysoft
          </a>
        </div>
      </div>
    </footer>
  );
}

function profileColor(seed) {
  const palette = [
    '#0b7bd5',
    '#7c3aed',
    '#0f9f7f',
    '#e06b1f',
    '#d33f7f',
    '#3156c9',
    '#0e8fa3',
    '#8a5a00',
    '#4c6fff',
    '#9b3dc6',
    '#167c4a',
    '#c0392b',
  ];
  let hash = 0;
  for (const char of String(seed ?? 'user'))
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}
