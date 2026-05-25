/**
 * Unit tests for Welcome.jsx
 * Feature: welcome-page-upgrade
 * Tasks: 2.3, 7.7, 7.8, 7.9, 7.10
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Welcome from '../pages/Welcome';

function renderWelcome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Welcome page — unit tests', () => {

  // Task 2.3 — entrance animation classes on hero elements
  it('2.3 hero h1 has animate-fade-in-up class', () => {
    renderWelcome();
    const h1 = document.querySelector('h1');
    expect(h1).not.toBeNull();
    expect(h1.classList.contains('animate-fade-in-up')).toBe(true);
  });

  it('2.3 hero subtitle paragraph has animate-fade-in-up class', () => {
    renderWelcome();
    // The subtitle is the first <p> inside .hero-copy
    const heroCopy = document.querySelector('.hero-copy');
    expect(heroCopy).not.toBeNull();
    const p = heroCopy.querySelector('p');
    expect(p).not.toBeNull();
    expect(p.classList.contains('animate-fade-in-up')).toBe(true);
  });

  it('2.3 hero CTA container has animate-fade-in-up class', () => {
    renderWelcome();
    const ctaContainer = document.querySelector('.hero-ctas');
    expect(ctaContainer).not.toBeNull();
    expect(ctaContainer.classList.contains('animate-fade-in-up')).toBe(true);
  });

  // Task 7.7 — hero section structure
  it('7.7 renders a hero h1', () => {
    renderWelcome();
    expect(document.querySelector('h1')).not.toBeNull();
  });

  it('7.7 renders at least one CTA linking to /login', () => {
    renderWelcome();
    const loginLinks = Array.from(document.querySelectorAll('a[href="/login"]'));
    expect(loginLinks.length).toBeGreaterThanOrEqual(1);
  });

  // Task 7.8 — at least 4 feature cards
  it('7.8 renders at least 4 feature cards', () => {
    renderWelcome();
    const cards = document.querySelectorAll('.feature-card');
    expect(cards.length).toBeGreaterThanOrEqual(4);
  });

  // Task 7.9 — final CTA section
  it('7.9 renders the final CTA section', () => {
    renderWelcome();
    const finalCta = document.querySelector('.final-cta');
    expect(finalCta).not.toBeNull();
  });

  // Task 7.10 — mock dashboard element in hero
  it('7.10 renders the mock dashboard preview in the hero', () => {
    renderWelcome();
    const mock = document.querySelector('.mock');
    expect(mock).not.toBeNull();
  });

});
