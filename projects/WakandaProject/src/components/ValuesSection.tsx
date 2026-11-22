import { SITE_CONTENT } from '../content';
import { RhythmIcon, ShieldHeartIcon, SparkIcon } from './Icons';

const VALUE_ICONS = {
  identidad: SparkIcon,
  disciplina: RhythmIcon,
  comunidad: ShieldHeartIcon,
} as const;

export function ValuesSection() {
  const { values } = SITE_CONTENT;

  return (
    <section className="section section--alt">
      <div className="container">
        <span className="eyebrow">{values.eyebrow}</span>
        <h2 className="section-title">{values.title}</h2>
        <p className="section-lead">{values.lead}</p>

        <div className="values-grid">
          {values.items.map((item) => {
            const Icon = VALUE_ICONS[item.id as keyof typeof VALUE_ICONS] ?? SparkIcon;
            return (
              <article key={item.id} className={`value-card value-card--${item.variant}`}>
                <div className="value-card__icon">
                  <Icon aria-hidden="true" />
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
