import { SITE_CONTENT } from '../content';
import { InstagramIcon, MailIcon } from './Icons';

export function Footer() {
  const { brand, nav, footer } = SITE_CONTENT;

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <img
              src="/images/logo/wakanda-logo-light.png"
              alt={brand.name}
              className="footer__logo"
              width={52}
              height={52}
            />
            <p style={{ margin: 0, maxWidth: '38ch', fontSize: '0.92rem' }}>
              {footer.description}
            </p>
            <div className="footer__socials">
              <a
                href="https://www.instagram.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="footer__social-btn"
                aria-label="Instagram de Wakanda Project"
              >
                <InstagramIcon aria-hidden="true" />
              </a>
              <a
                href="mailto:contacto@wakandaproject.org"
                className="footer__social-btn"
                aria-label="Correo de contacto de Wakanda Project"
              >
                <MailIcon aria-hidden="true" />
              </a>
            </div>
          </div>

          <div>
            <h3>Navegación</h3>
            <ul className="footer__links">
              {nav.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Propósito</h3>
            <ul className="footer__links">
              <li>
                <a href="#nosotros">{brand.missionTitle}</a>
              </li>
              <li>
                <a href="#nosotros">{brand.visionTitle}</a>
              </li>
              <li>
                <a href="#contacto">Inscripciones abiertas</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer__bottom">
          <span>{footer.copyright}</span>
          <span>{brand.tagline}</span>
        </div>
      </div>
    </footer>
  );
}
