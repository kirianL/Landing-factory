import { SITE_CONTENT } from '../content';
import { ArrowRightIcon, SparkIcon } from './Icons';

export function Hero() {
  const { hero, brand } = SITE_CONTENT;

  return (
    <section id="inicio" className="hero">
      <div className="hero__texture" aria-hidden="true" />
      <div className="container hero__grid">
        <div>
          <span className="eyebrow">
            <SparkIcon width={16} height={16} aria-hidden="true" />
            {hero.eyebrow}
          </span>
          <h1 className="hero__title">
            {hero.titleLead}
            <span>{hero.titleHighlight}</span>
          </h1>
          <p className="hero__desc">{brand.officialDescription}</p>

          <div className="hero__ctas">
            <a href="#contacto" className="btn btn--primary">
              {hero.primaryCta}
              <ArrowRightIcon aria-hidden="true" />
            </a>
            <a href="#nosotros" className="btn btn--outline">
              {hero.secondaryCta}
            </a>
          </div>

          <div className="hero__metrics">
            {hero.metrics.map((metric) => (
              <div key={metric.value} className="hero__metric">
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="hero__collage" role="group" aria-label="Fotografías de Wakanda Project">
          <div className="hero__photo hero__photo--a">
            <img
              src="/images/gallery/01.jpg"
              alt="Niña participante de Wakanda Project con vestuario tradicional"
              width={878}
              height={1152}
            />
          </div>
          <div className="hero__photo hero__photo--b">
            <img
              src="/images/gallery/07.jpg"
              alt="Jóvenes bailarines de Wakanda Project en coreografía sobre escenario"
              width={1200}
              height={1600}
            />
          </div>
          <div className="hero__photo hero__photo--c">
            <img
              src="/images/gallery/03.jpg"
              alt="Participante infantil sonriendo en desfile cultural"
              width={1200}
              height={1575}
            />
          </div>
          <div className="hero__badge-float">
            <strong>{hero.badgeTitle}</strong>
            <span>{hero.badgeText}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
