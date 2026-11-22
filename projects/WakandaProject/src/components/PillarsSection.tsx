import { SITE_CONTENT } from '../content';
import { CheckCircleIcon, RhythmIcon, ShieldHeartIcon, SparkIcon, UsersIcon } from './Icons';

const PILLAR_ICONS = [SparkIcon, RhythmIcon, UsersIcon, ShieldHeartIcon, CheckCircleIcon, SparkIcon];

export function PillarsSection() {
  const { pillars, brand } = SITE_CONTENT;

  return (
    <section id="nosotros" className="section">
      <div className="container pillars__grid">
        <div className="orbit" role="group" aria-label="Diagrama de pilares de Wakanda Project">
          <div className="orbit__ring" aria-hidden="true" />
          <div className="orbit__center">
            <RhythmIcon width={28} height={28} aria-hidden="true" />
            <span>{pillars.centerLabel}</span>
          </div>
          {pillars.nodes.map((node, index) => {
            const Icon = PILLAR_ICONS[index % PILLAR_ICONS.length];
            return (
              <div key={node.id} className={`orbit__node orbit__node--${index + 1}`}>
                <Icon width={20} height={20} aria-hidden="true" />
                <span>{node.label}</span>
              </div>
            );
          })}
        </div>

        <div>
          <span className="eyebrow">{pillars.eyebrow}</span>
          <h2 className="section-title">{pillars.title}</h2>
          <p className="section-lead">{brand.officialDescription}</p>

          <div className="mission-cards">
            <article className="mission-card">
              <h3>{brand.missionTitle}</h3>
              <p>{brand.missionText}</p>
            </article>
            <article className="mission-card">
              <h3>{brand.visionTitle}</h3>
              <p>{brand.visionText}</p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
