import { SITE_CONTENT } from '../content';

export function ProcessSection() {
  const { process } = SITE_CONTENT;

  return (
    <section id="metodologia" className="section section--dark">
      <div className="container">
        <div className="process__header">
          <div>
            <span className="eyebrow">{process.eyebrow}</span>
            <h2 className="section-title">{process.title}</h2>
          </div>
          <p className="section-lead">{process.lead}</p>
        </div>

        <div className="process-grid">
          {process.steps.map((step) => (
            <article key={step.number} className="process-card">
              <img
                src={step.image}
                alt={step.alt}
                className="process-card__img"
                decoding="sync"
              />
              <div className="process-card__overlay" aria-hidden="true" />
              <span className="process-card__num" aria-hidden="true">
                {step.number}
              </span>
              <div className="process-card__content">
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
