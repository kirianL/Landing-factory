import { useState, type FormEvent } from 'react';
import { SITE_CONTENT } from '../content';
import { ArrowRightIcon, CheckCircleIcon } from './Icons';

interface FormErrors {
  name?: string;
  email?: string;
  message?: string;
}

export function ContactSection() {
  const { contact } = SITE_CONTENT;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState(contact.form.topics[0]);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: FormErrors = {};

    if (!name.trim()) {
      nextErrors.name = 'Este campo es obligatorio.';
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Ingresa un correo electrónico válido.';
    }
    if (!message.trim()) {
      nextErrors.message = 'Cuéntanos brevemente tu consulta.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setSubmitted(true);
      setName('');
      setEmail('');
      setMessage('');
    }
  };

  return (
    <section id="contacto" className="section">
      <div className="container">
        <div className="contact-block">
          <div className="contact-block__texture" aria-hidden="true" />
          <div className="contact-grid">
            <div>
              <span className="eyebrow" style={{ color: 'var(--color-amber-light)' }}>
                {contact.eyebrow}
              </span>
              <h2 className="section-title" style={{ color: 'var(--color-white)' }}>
                {contact.title}
              </h2>
              <p className="section-lead" style={{ color: 'rgba(255, 255, 255, 0.84)' }}>
                {contact.lead}
              </p>

              <ul className="contact-info__items">
                {contact.details.map((detail) => (
                  <li key={detail} className="contact-info__item">
                    <CheckCircleIcon
                      style={{ color: 'var(--color-amber-light)', flexShrink: 0 }}
                      aria-hidden="true"
                    />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>

            <form className="contact-form" onSubmit={handleSubmit} noValidate>
              {submitted && (
                <div className="form-success" role="status">
                  <CheckCircleIcon aria-hidden="true" />
                  <span>{contact.form.successMessage}</span>
                </div>
              )}

              <div className="form-field">
                <label htmlFor="contact-name">{contact.form.nameLabel}</label>
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  aria-required="true"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  placeholder={contact.form.namePlaceholder}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? 'contact-name-error' : undefined}
                />
                {errors.name && (
                  <span id="contact-name-error" className="form-error" role="alert">
                    {errors.name}
                  </span>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="contact-email">{contact.form.emailLabel}</label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  aria-required="true"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  placeholder={contact.form.emailPlaceholder}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'contact-email-error' : undefined}
                />
                {errors.email && (
                  <span id="contact-email-error" className="form-error" role="alert">
                    {errors.email}
                  </span>
                )}
              </div>

              <div className="form-field form-field--full">
                <label htmlFor="contact-topic">{contact.form.topicLabel}</label>
                <select
                  id="contact-topic"
                  name="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                >
                  {contact.form.topics.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field form-field--full">
                <label htmlFor="contact-message">{contact.form.messageLabel}</label>
                <textarea
                  id="contact-message"
                  name="message"
                  rows={4}
                  required
                  aria-required="true"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    if (errors.message) setErrors((prev) => ({ ...prev, message: undefined }));
                  }}
                  placeholder={contact.form.messagePlaceholder}
                  aria-invalid={Boolean(errors.message)}
                  aria-describedby={errors.message ? 'contact-message-error' : undefined}
                />
                {errors.message && (
                  <span id="contact-message-error" className="form-error" role="alert">
                    {errors.message}
                  </span>
                )}
              </div>

              <div className="form-field form-field--full">
                <button type="submit" className="btn btn--amber">
                  {contact.form.submitLabel}
                  <ArrowRightIcon aria-hidden="true" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
