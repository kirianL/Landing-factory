import React, { useMemo, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import topologyData from 'world-atlas/countries-110m.json';
import { PARTNER_PINS } from '../data/content';
import type { PartnerPin } from '../data/content';
import './PartnersMapSection.css';

const WIDTH = 720;
const HEIGHT = 460;
const HIGHLIGHTED = new Set([
  'Russia',
  'China',
  'United Arab Emirates',
  'Cyprus',
  'Switzerland',
]);

interface CountryProperties {
  name: string;
}

export const PartnersMapSection: React.FC = () => {
  const [selectedPin, setSelectedPin] = useState<PartnerPin>(PARTNER_PINS[0]);

  const { countryPaths, pins } = useMemo(() => {
    const projection = geoMercator()
      .center([62, 36])
      .scale(245)
      .translate([WIDTH / 2, HEIGHT / 2]);
    const pathGen = geoPath(projection);

    const topo = topologyData as unknown as Topology<{
      countries: GeometryCollection<CountryProperties>;
    }>;
    const countries = feature(topo, topo.objects.countries).features;

    const countryPaths = countries
      .filter((c) => c.properties?.name !== 'Antarctica')
      .map((c, idx) => {
        const d = pathGen(c);
        const name = c.properties?.name ?? `country-${idx}`;
        return {
          key: `${name}-${idx}`,
          d: d ?? '',
          highlighted: HIGHLIGHTED.has(name),
        };
      })
      .filter((c) => c.d.length > 0);

    const pins = PARTNER_PINS.map((p) => {
      const projected = projection([p.lon, p.lat]);
      const [x, y] = projected ?? [0, 0];
      return { ...p, x, y };
    });

    return { countryPaths, pins };
  }, []);

  return (
    <section id="partners" className="partners-section">
      <div className="container partners-grid">
        <div className="partners-info">
          <span className="eyebrow eyebrow--dark">Global Network</span>
          <h2 className="partners-info__title">70+ partners worldwide</h2>
          <p className="partners-info__desc">
            Banks, financial institutions, law and audit firms, and real estate agencies across key wealth
            jurisdictions.
          </p>
          <a href="#contact" className="btn-garnet partners-info__cta">
            Become a partner
          </a>

          {/* Active jurisdiction card */}
          <div className="partners-card" aria-live="polite">
            <div className="partners-card__country">{selectedPin.country}</div>
            <ul className="partners-card__list">
              {selectedPin.partners.map((partner) => (
                <li key={partner}>{partner}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="partners-map-wrap">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="partners-map"
            role="group"
            aria-label="Interactive map of M&P global banking and legal partners"
          >
            <title>Interactive map of M&amp;P global banking and legal partners</title>
            <g className="map-countries">
              {countryPaths.map((c) => (
                <path
                  key={c.key}
                  d={c.d}
                  fill={c.highlighted ? 'var(--accent-garnet)' : 'var(--map-land)'}
                  fillOpacity={c.highlighted ? 0.94 : 0.88}
                  stroke="var(--bg-dark)"
                  strokeWidth={0.4}
                />
              ))}
            </g>

            {/* Interactive Country Pins */}
            {pins.map((pin) => {
              const isSelected = selectedPin.id === pin.id;
              return (
                <g
                  key={pin.id}
                  transform={`translate(${pin.x}, ${pin.y})`}
                  className="map-pin"
                  onMouseEnter={() => setSelectedPin(pin)}
                  onClick={() => setSelectedPin(pin)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedPin(pin);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Select ${pin.country} partners`}
                  aria-pressed={isSelected}
                >
                  <circle r={16} fill="transparent" />
                  <circle
                    r={isSelected ? 9 : 6}
                    fill={isSelected ? 'var(--text-on-dark)' : 'var(--bg-dark)'}
                    stroke="var(--text-on-dark)"
                    strokeWidth="2"
                  />
                  <rect
                    x={12}
                    y={-11}
                    width={pin.country.length * 7.2 + 16}
                    height={22}
                    rx={2}
                    fill={isSelected ? 'var(--text-on-dark)' : 'rgba(23, 0, 0, 0.9)'}
                  />
                  <text
                    x={20}
                    y={3.5}
                    fontSize="11"
                    fontWeight={isSelected ? 600 : 400}
                    fill={isSelected ? 'var(--bg-dark)' : 'var(--text-on-dark)'}
                  >
                    {pin.country}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </section>
  );
};
