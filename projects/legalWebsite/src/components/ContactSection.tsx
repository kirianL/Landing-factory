import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BrandLogo, ClockIcon, MailIcon, PhoneIcon, PinIcon, SocialIcon } from './Icons';
import './ContactSection.css';

const BEGOVAYA_COORDS: [number, number] = [55.7765, 37.5512];

export const ContactSection: React.FC = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'error' | 'submitted'>('idle');
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = L.map(mapRef.current, {
      center: BEGOVAYA_COORDS,
      zoom: 15,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const icon = L.divIcon({
      className: 'contact-map-pin',
      html: `<svg viewBox="0 0 28 40" width="28" height="40" aria-hidden="true">
        <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="#E8C9A9"/>
        <circle cx="14" cy="14" r="5" fill="#270000"/>
      </svg>`,
      iconSize: [28, 40],
      iconAnchor: [14, 40],
    });

    L.marker(BEGOVAYA_COORDS, {
      icon,
      title: '2 Begovaya Street, Moscow, 125284',
    }).addTo(map);

    return () => {
      map.remove();
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !consent) {
      setStatus('error');
      return;
    }
    setStatus('submitted');
    setName('');
    setPhone('');
    setComment('');
    setConsent(false);
  };

  return (
    <section id="contact" className="contact-section">
      <div className="container">
        <div className="contact-header">
          <h2 className="contact-header__title">contact us</h2>
          <div className="contact-header__social">
            <span className="contact-header__social-label">Follow us</span>
            <div className="contact-social-row">
              {(['Telegram', 'WhatsApp', 'YouTube', 'LinkedIn'] as const).map((net) => (
                <a
                  key={net}
                  href="#contact"
                  className="contact-social-box"
                  aria-label={`Mikhailov & Partners on ${net}`}
                >
                  <SocialIcon name={net} />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="contact-grid">
          {/* Left Column */}
          <div className="contact-col">
            <div className="contact-info-row">
              <div>
                <div className="contact-info-label">Write us</div>
                <a href="mailto:mp@mnp.ru" className="contact-info-value">
                  mp@mnp.ru
                </a>
              </div>
              <span className="contact-info-icon">
                <MailIcon />
              </span>
            </div>

            <div className="contact-info-row">
              <div>
                <div className="contact-info-label">Our address</div>
                <div className="contact-info-value">2 Begovaya Street, Moscow, 125284</div>
              </div>
              <span className="contact-info-icon">
                <PinIcon />
              </span>
            </div>

            <div className="contact-location-map" role="region" aria-label="Office location map at 2 Begovaya Street">
              <div ref={mapRef} className="contact-leaflet-map" />
              <span className="contact-location-caption">2 Begovaya Street, Moscow — Private Entrance</span>
            </div>
          </div>

          {/* Right Column */}
          <div className="contact-col">
            <div className="contact-info-row">
              <div>
                <div className="contact-info-label">Call us</div>
                <a href="tel:+74951279592" className="contact-info-value">
                  +7 (495) 127-95-92
                </a>
              </div>
              <span className="contact-info-icon">
                <PhoneIcon />
              </span>
            </div>

            <div className="contact-info-row">
              <div>
                <div className="contact-info-label">Working hours</div>
                <div className="contact-info-value">Mon–Fri: 9:00–20:00</div>
              </div>
              <span className="contact-info-icon">
                <ClockIcon />
              </span>
            </div>

            <form className="contact-form" onSubmit={handleSubmit} noValidate>
              <h3 className="contact-form__title">Leave a request</h3>

              <label className="contact-field">
                <span className="sr-only">Name</span>
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="*Name"
                  value={name}
                  aria-invalid={status === 'error' && !name.trim()}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (status === 'error') setStatus('idle');
                  }}
                  required
                />
              </label>

              <label className="contact-field">
                <span className="sr-only">Phone number</span>
                <input
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="*Phone number"
                  value={phone}
                  aria-invalid={status === 'error' && !phone.trim()}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (status === 'error') setStatus('idle');
                  }}
                  required
                />
              </label>

              <label className="contact-field">
                <span className="sr-only">Comment</span>
                <input
                  type="text"
                  placeholder="Comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </label>

              <label className="contact-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  By clicking Submit, I consent to the <u>processing of my personal data</u>.
                </span>
              </label>

              {status === 'error' && (
                <p className="contact-feedback contact-feedback--error" role="alert">
                  Please fill in your name, phone number, and accept the data processing consent.
                </p>
              )}
              {status === 'submitted' && (
                <p className="contact-feedback contact-feedback--success" role="status">
                  Request received. A senior partner will contact you shortly.
                </p>
              )}

              <button type="submit" className="btn-garnet contact-form__submit">
                Submit
              </button>
            </form>
          </div>
        </div>

        <footer className="footer-bottom">
          <BrandLogo />
          <div className="footer-bottom__meta">
            <span>&copy; {new Date().getFullYear()} Mikhailov &amp; Partners Private Services Group.</span>
            <span>Confidentiality &amp; Legal Notice</span>
          </div>
        </footer>
      </div>
    </section>
  );
};
