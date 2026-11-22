import { SITE_CONTENT } from '../content';

export function GallerySection() {
  const { gallery, brand } = SITE_CONTENT;

  return (
    <>
      <section className="quote-band" aria-label="Frase institucional">
        <div className="quote-band__texture" aria-hidden="true" />
        <div className="container quote-band__inner">
          <blockquote>{brand.quoteText}</blockquote>
          <cite>{brand.quoteAuthor}</cite>
        </div>
      </section>

      <section id="galeria" className="section">
        <div className="container">
          <span className="eyebrow">{gallery.eyebrow}</span>
          <h2 className="section-title">{gallery.title}</h2>
          <p className="section-lead">{gallery.lead}</p>

          <div className="gallery-mosaic">
            {gallery.items.map((item) => (
              <figure
                key={item.src}
                className={`gallery-item ${item.tall ? 'gallery-item--tall' : ''}`}
                style={{ margin: 0 }}
              >
                <img src={item.src} alt={item.alt} decoding="sync" />
              </figure>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
