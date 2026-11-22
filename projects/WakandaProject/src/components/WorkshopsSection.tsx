import { SITE_CONTENT } from '../content';

export function WorkshopsSection() {
  const { workshops } = SITE_CONTENT;

  return (
    <section id="talleres" className="section">
      <div className="container">
        <span className="eyebrow">{workshops.eyebrow}</span>
        <h2 className="section-title">{workshops.title}</h2>
        <p className="section-lead">{workshops.lead}</p>

        <div className="workshops-grid">
          {workshops.items.map((item) => (
            <article key={item.title} className="workshop-card">
              <div className="workshop-card__media">
                <img src={item.image} alt={item.alt} decoding="sync" />
              </div>
              <div className="workshop-card__body">
                <span className="workshop-card__tag">{item.tag}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
