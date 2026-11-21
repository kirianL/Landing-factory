import React from 'react';
import { ArrowRightIcon } from './Icons';
import './AboutSection.css';

export const AboutSection: React.FC = () => {
  return (
    <section id="about" className="about-section">
      <div className="container">
        <div className="editorial-grid">
          <div className="editorial-eyebrow-col">
            <span className="eyebrow eyebrow--light">About us</span>
          </div>

          <div className="editorial-main-col">
            <h2 className="about-section__heading">
              Protecting and preserving the assets of high-net-worth clients
            </h2>

            <p className="about-section__copy">
              We help wealthy clients safeguard, structure and pass on their assets. Founded in 1995, since 2007 we
              have worked exclusively with private clients, leading banks and financial institutions across Russia and
              key international jurisdictions. Confidential and reliable.
            </p>

            <a href="#contact" className="link-with-badge about-section__link">
              <span>Learn more about us</span>
              <span className="link-with-badge__box">
                <ArrowRightIcon size={12} />
              </span>
            </a>

            <div className="about-stats">
              <div className="about-stats__item">
                <div className="about-stats__value">
                  31 <span className="about-stats__unit">years</span>
                </div>
                <p className="about-stats__label">in legal and financial services</p>
              </div>
              <div className="about-stats__item">
                <div className="about-stats__value">2,700+</div>
                <p className="about-stats__label">HNWI &amp; UHNWI clients under advisory</p>
              </div>
              <div className="about-stats__item">
                <div className="about-stats__value">70+</div>
                <p className="about-stats__label">specialists &amp; global banking partners</p>
              </div>
            </div>

            <div className="about-section__banner">
              <img
                src="/images/about-office.jpg"
                alt="Executives in silhouette inside a modern architectural glass atrium"
                width={960}
                height={400}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
