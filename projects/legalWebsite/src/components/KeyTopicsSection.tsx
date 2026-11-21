import React, { useState } from 'react';
import { KEY_TOPICS } from '../data/content';
import { ArrowLeftIcon, ArrowRightIcon } from './Icons';
import './KeyTopicsSection.css';

export const KeyTopicsSection: React.FC = () => {
  const [startIndex, setStartIndex] = useState(0);
  const visibleCount = 4;
  const maxStart = Math.max(0, KEY_TOPICS.length - visibleCount);

  const visibleTopics = KEY_TOPICS.slice(startIndex, startIndex + visibleCount);

  return (
    <section id="topics" className="topics-section">
      <div className="container">
        <div className="editorial-grid topics-section__header">
          <div className="editorial-eyebrow-col">
            <span className="eyebrow eyebrow--dark">Key topics</span>
          </div>

          <div className="editorial-main-col topics-section__heading-row">
            <h2 className="topics-section__heading">
              Expert materials on asset protection and management
            </h2>

            <div className="topics-section__controls" role="group" aria-label="Carousel controls">
              <button
                type="button"
                className="icon-square-btn"
                aria-label="Previous topics"
                disabled={startIndex === 0}
                onClick={() => setStartIndex((i) => Math.max(0, i - 1))}
              >
                <ArrowLeftIcon />
              </button>
              <button
                type="button"
                className="icon-square-btn"
                aria-label="Next topics"
                disabled={startIndex >= maxStart}
                onClick={() => setStartIndex((i) => Math.min(maxStart, i + 1))}
              >
                <ArrowRightIcon />
              </button>
            </div>
          </div>
        </div>

        <div className="topics-grid">
          {visibleTopics.map((topic) => (
            <article key={topic.id} className="topic-card">
              <div className="topic-card__media">
                <img src={topic.image} alt={topic.title} width={400} height={300} loading="lazy" />
              </div>
              <div className="topic-card__body">
                <h3 className="topic-card__title">{topic.title}</h3>
                <p className="topic-card__desc">{topic.description}</p>
                <a href="#contact" className="link-with-badge topic-card__link">
                  <span>Learn more</span>
                  <span className="link-with-badge__box">
                    <ArrowRightIcon size={12} />
                  </span>
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
