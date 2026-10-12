import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('FINDOCTOR Product Packaging, Landing, Onboarding & Mobile PWA', () => {
  const rootDir = path.resolve(__dirname, '../..');

  it('should define FINDOCTOR brand and PWA meta tags in index.html', () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');
    expect(html).toContain('FINDOCTOR');
    expect(html).toContain('rel="manifest" href="/manifest.json"');
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="apple-mobile-web-app-title" content="FINDOCTOR"');
  });

  it('should provide a valid standalone PWA manifest.json and vector icon', () => {
    const manifestPath = path.join(rootDir, 'public/manifest.json');
    const iconPath = path.join(rootDir, 'public/favicon.svg');
    expect(fs.existsSync(manifestPath)).toBe(true);
    expect(fs.existsSync(iconPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.short_name).toBe('FINDOCTOR');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  it('should provide a Service Worker (public/sw.js) that bypasses /api/ routes', () => {
    const swPath = path.join(rootDir, 'public/sw.js');
    expect(fs.existsSync(swPath)).toBe(true);
    const swCode = fs.readFileSync(swPath, 'utf-8');
    expect(swCode).toContain('findoctor-shell-v1');
    expect(swCode).toContain("url.pathname.startsWith('/api/')");
  });

  it('should include ProductLanding with 1-click demo CTA and 3-step OnboardingChecklist', () => {
    const landingCode = fs.readFileSync(
      path.join(rootDir, 'src/client/components/landing/ProductLanding.tsx'),
      'utf-8'
    );
    expect(landingCode).toContain('FINDOCTOR');
    expect(landingCode).toContain('Попробовать с демо-данными (без регистрации)');
    expect(landingCode).toContain('landing-try-demo-btn');

    const onboardingCode = fs.readFileSync(
      path.join(rootDir, 'src/client/components/onboarding/OnboardingChecklist.tsx'),
      'utf-8'
    );
    expect(onboardingCode).toContain('onboarding-step-1-btn');
    expect(onboardingCode).toContain('onboarding-step-2-btn');
    expect(onboardingCode).toContain('onboarding-step-3-btn');
    expect(onboardingCode).toContain('demo-mode-banner');
  });
});
