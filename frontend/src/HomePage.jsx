import React, { useEffect, useState } from 'react';
import { AppHeader, PublicFooter } from './components/AppChrome';
import { getStoredUser } from './api';

const HOME_NAV = [
  { href: '#home', label: 'Home' },
  { href: '#content', label: 'Content' },
  { href: '#workspace', label: 'Workspace' },
];

const SECTION_IDS = HOME_NAV.map((item) => item.href.slice(1));

const examples = [
  {
    title: 'Website Content',
    text: 'Homepages, landing pages and product content.',
  },
  {
    title: 'SEO Articles',
    text: 'Useful, search-focused articles and guides.',
  },
  { title: 'Social Media', text: 'Posts, captions and campaign content.' },
  {
    title: 'Press Releases',
    text: 'Clear company announcements ready to publish.',
  },
];

const services = [
  {
    title: 'Blog Posts',
    eyebrow: 'SEARCH & CONTENT',
    text: 'Create useful, structured articles that sound like your brand and are ready to refine and publish.',
    tag: 'SEO-ready',
  },
  {
    title: 'Social Strategy',
    eyebrow: 'SOCIAL MEDIA',
    text: 'Turn an idea into platform-ready social content with the right tone, hook and call to action.',
    tag: 'Multi-platform',
  },
  {
    title: 'Weekly Newsletters',
    eyebrow: 'EMAIL CONTENT',
    text: 'Build clear newsletters that keep your audience informed, engaged and coming back.',
    tag: 'Audience-first',
  },
  {
    title: 'Email Campaigns',
    eyebrow: 'CAMPAIGNS',
    text: 'Generate campaign copy for launches, promotions, follow-ups and customer journeys.',
    tag: 'Conversion-focused',
  },
  {
    title: 'Ad Banner Copy',
    eyebrow: 'ADVERTISING',
    text: 'Create concise headline and supporting copy for banners and performance creatives.',
    tag: 'High-impact',
  },
];

<div style="max-width:420px;border:1px solid #d9d9d9;border-radius:10px;padding:28px 24px;background:#fff;box-shadow:0 6px 18px rgba(0,0,0,0.06);font-family:Georgia,'Times New Roman',serif;">
  <h3 style='margin:0 0 14px 0;font-size:24px;color:#1f1f1f;line-height:1.25;'>
    Content Consulting Services
  </h3>
  <p style='margin:0 0 16px 0;font-size:15px;color:#4a4a4a;line-height:1.6;'>
    Strategic content solutions designed to strengthen brand voice, improve
    audience engagement, and drive measurable business outcomes.
  </p>
  <ul style='margin:0 0 18px 18px;padding:0;color:#2f2f2f;font-size:15px;line-height:1.7;'>
    <li>Content Strategy & Planning</li>
    <li>Editorial Calendar Development</li>
    <li>SEO-Focused Content Guidance</li>
    <li>Brand Voice & Messaging Refinement</li>
  </ul>
  <a
    href='#contact'
    style='display:inline-block;text-decoration:none;background:#1f1f1f;color:#fff;padding:10px 18px;border-radius:6px;font-size:14px;letter-spacing:.2px;'
  >
    Book a Consultation
  </a>
</div>;
export default function HomePage() {
  const user = getStoredUser();
  const [activeSection, setActiveSection] = useState('home');
  const [previewText, setPreviewText] = useState('');
  const [previewType, setPreviewType] = useState('SEO Articles');
  const [activeService, setActiveService] = useState(0);

  const go = (path) => {
    window.location.href = path;
  };
  const enterApp = () =>
    go(user ? (user.is_staff ? '/admin' : '/workspace') : '/login');

  const scrollTo = (id) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    const demos = [
      {
        type: 'SEO Articles',
        text: 'Write an SEO article about digital marketing',
      },
      {
        type: 'Website Content',
        text: 'Create homepage content for a technology company',
      },
      {
        type: 'Social Media',
        text: 'Write social media posts for a product launch',
      },
      {
        type: 'Press Releases',
        text: 'Create a press release for our new product',
      },
    ];
    let index = 0;
    let position = 0;
    let deleting = false;
    let timer;

    const tick = () => {
      const current = demos[index];
      setPreviewType(current.type);
      if (!deleting) {
        position += 1;
        setPreviewText(current.text.slice(0, position));
        if (position >= current.text.length) {
          deleting = true;
          timer = window.setTimeout(tick, 1700);
          return;
        }
      } else {
        position -= 1;
        setPreviewText(current.text.slice(0, position));
        if (position <= 0) {
          deleting = false;
          index = (index + 1) % demos.length;
          timer = window.setTimeout(tick, 450);
          return;
        }
      }
      timer = window.setTimeout(tick, deleting ? 24 : 45);
    };

    timer = window.setTimeout(tick, 800);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveService((current) => (current + 1) % services.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const sections = SECTION_IDS.map((id) =>
      document.getElementById(id)
    ).filter(Boolean);
    if (!sections.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (!visible.length) return;
        const topMost = visible.reduce((a, b) =>
          a.boundingClientRect.top <= b.boundingClientRect.top ? a : b
        );
        setActiveSection(topMost.target.id);
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const items = document.querySelectorAll('.cc-reveal');
    if (!items.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return (
    <main className='public-home public-home-dark'>
      <AppHeader nav={HOME_NAV} activeHref={`#${activeSection}`} />

      <section
        id='home'
        className='content-hero content-hero-dark cc-page-enter'
      >
        <div className='content-hero-inner'>
          <div className='content-hero-copy'>
            <div className='content-kicker'>CONTENT WORKSPACE</div>
            <h1>
              <em>Content?</em>
              <br />
              when you are ready.
            </h1>
            <p>
              Find the right format, start with an idea, and turn it into
              finished content.
            </p>
            <div className='content-hero-actions'>
              <button className='content-primary-btn' onClick={enterApp}>
                Open workspace <b>→</b>
              </button>
              <button
                className='content-hero-link'
                onClick={() => scrollTo('content')}
              >
                Explore content <b>↓</b>
              </button>
            </div>
          </div>
          <div
            className='service-showcase'
            aria-label='Content Consult services'
          >
            <div className='service-showcase-top'>
              <span>WHAT WE PROVIDE</span>
              <span>
                {String(activeService + 1).padStart(2, '0')} /{' '}
                {String(services.length).padStart(2, '0')}
              </span>
            </div>
            <div className='service-showcase-body'>
              <span className='service-showcase-eyebrow'>
                {services[activeService].eyebrow}
              </span>
              <h2>{services[activeService].title}</h2>
              <p>{services[activeService].text}</p>
              <div className='service-showcase-footer'>
                <span>{services[activeService].tag}</span>
                <button type='button' onClick={enterApp}>
                  Create content <b>→</b>
                </button>
              </div>
            </div>
            <div className='service-dots' role='tablist' aria-label='Services'>
              {services.map((service, index) => (
                <button
                  type='button'
                  key={service.title}
                  className={index === activeService ? 'active' : ''}
                  onClick={() => setActiveService(index)}
                  aria-label={`Show ${service.title}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id='content'
        className='content-section content-section-dark cc-reveal'
      >
        <div className='content-section-heading'>
          <div>
            <span>EXPLORE CONTENT</span>
            <h2>Start with the content you need.</h2>
          </div>
          <p>One workspace for the formats your team creates every day.</p>
        </div>

        <div className='content-example-grid'>
          {examples.map((item) => (
            <button
              className='content-example-card'
              key={item.title}
              onClick={enterApp}
            >
              <span className='content-card-index'>
                0{examples.indexOf(item) + 1}
              </span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
              <b>→</b>
            </button>
          ))}
        </div>
      </section>

      <section
        id='workspace'
        className='content-workspace-section content-workspace-section-dark cc-reveal'
      >
        <div className='workspace-showcase'>
          <div>
            <span>CONTENT WORKSPACE</span>
            <h2>From idea to finished content.</h2>
            <p>
              Search, generate, edit and manage your content without jumping
              between tools.
            </p>
            <button className='content-primary-btn' onClick={enterApp}>
              Open workspace <b>→</b>
            </button>
          </div>
          <div
            className='workspace-preview'
            aria-label='Animated Content Consult workspace preview'
          >
            <div className='workspace-preview-top'>
              <span>CONTENT CONSULT / WORKSPACE</span>
              <span>WORKSPACE</span>
            </div>
            <div className='workspace-preview-body'>
              <aside>
                <small>CONTENT</small>
                {[
                  'Website Content',
                  'SEO Articles',
                  'Social Media',
                  'Press Releases',
                ].map((item) => (
                  <span
                    className={previewType === item ? 'is-active' : ''}
                    key={item}
                  >
                    {item}
                  </span>
                ))}
              </aside>
              <div className='workspace-preview-main'>
                <small>SEARCH CONTENT</small>
                <div className='preview-search'>
                  <span className='preview-search-icon' aria-hidden='true'>
                    ⌕
                  </span>
                  <span className='preview-search-text'>{previewText}</span>
                  <span className='preview-cursor' aria-hidden='true' />
                </div>
                <div className='preview-ideas'>
                  <div className='preview-ideas-icon' aria-hidden='true' />
                  <div>
                    <strong>Get personalized content ideas</strong>
                    <span>
                      Start typing above to discover content ideas tailored to
                      your needs.
                    </span>
                  </div>
                </div>
                <div className='preview-editor-label'>
                  <span>CONTENT PREVIEW</span>
                  <b>
                    {previewType === 'SEO Articles'
                      ? 'SEO'
                      : previewType.replace(' Content', '')}
                  </b>
                </div>
                <div className='preview-lines'>
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
