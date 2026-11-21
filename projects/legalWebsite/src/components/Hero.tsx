import React from 'react';
import { GeometricShapesBg } from './Icons';
import './Hero.css';

export const Hero: React.FC = () => {
  return (
    <section id="top" className="hero">
      <GeometricShapesBg />

      <div className="container hero__grid">
        <div className="hero__content">
          <h1 className="hero__title">
            We protect and <span className="hero__title-italic">preserve</span> what you&apos;ve built
          </h1>

          <div className="hero__lead-wrap">
            <p className="hero__lead">
              Legal and financial advisory for private clients and businesses — over 30 years in the market
            </p>
          </div>
        </div>

        <div className="hero__visual">
          <img
            src="/images/themis-hero.png"
            alt="Classical bronze statue of Lady Justice holding scales and sword"
            className="hero__statue"
            width={896}
            height={1200}
            fetchPriority="high"
          />
        </div>
      </div>
    </section>
  );
};
