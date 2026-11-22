import { SITE_CONTENT } from '../content';

export function TestimonialsSection() {
  const { testimonials } = SITE_CONTENT;

  return (
    <section className="section section--alt">
      <div className="container">
        <span className="eyebrow">{testimonials.eyebrow}</span>
        <h2 className="section-title">{testimonials.title}</h2>
        <p className="section-lead">{testimonials.lead}</p>

        <div className="testimonials-grid">
          {testimonials.items.map((item) => (
            <article key={item.name} className="envelope-card">
              <div className="envelope-card__avatar">
                <img src={item.image} alt={`Participante de Wakanda Project (${item.role})`} decoding="sync" />
              </div>
              <h3 className="envelope-card__name">{item.name}</h3>
              <span className="envelope-card__role">{item.role}</span>
              <p className="envelope-card__quote">{item.quote}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
