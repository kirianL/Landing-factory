import { useState, useEffect } from 'react';
import { SITE_CONTENT } from '../content';
import { CloseIcon, MenuIcon } from './Icons';

export function Navbar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <a href="#inicio" className="navbar__brand" aria-label={SITE_CONTENT.brand.name}>
          <img
            src="/images/logo/wakanda-logo-dark.png"
            alt={SITE_CONTENT.brand.name}
            className="navbar__logo"
            width={46}
            height={46}
          />
        </a>

        <nav aria-label="Navegación principal">
          <ul className="navbar__links">
            {SITE_CONTENT.nav.links.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="navbar__link">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="navbar__actions">
          <a href={SITE_CONTENT.nav.ctaHref} className="btn btn--primary">
            {SITE_CONTENT.nav.ctaLabel}
          </a>
          <button
            type="button"
            className="navbar__toggle"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setOpen((prev) => !prev)}
          >
            {open ? <CloseIcon aria-hidden="true" /> : <MenuIcon aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div id="mobile-menu" className={`mobile-menu ${open ? 'is-open' : ''}`}>
        <ul className="mobile-menu__list">
          {SITE_CONTENT.nav.links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="mobile-menu__link"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <a
          href={SITE_CONTENT.nav.ctaHref}
          className="btn btn--primary"
          style={{ width: '100%' }}
          onClick={() => setOpen(false)}
        >
          {SITE_CONTENT.nav.ctaLabel}
        </a>
      </div>
    </header>
  );
}
