import React from 'react';
import './App.css';

function App() {
  return (
    <div className="app">
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-container">
          <div className="logo">
            <img src={process.env.PUBLIC_URL + '/insova-logo.png'} alt="Insova" className="logo-icon" width="100" height="100" />
            <span className="logo-text">Insova</span>
          </div>
          <a href="#contact" className="nav-cta">Get in Touch</a>
        </div>
      </nav>

      {/* Hero */}
      <header className="hero">
        <div className="hero-glow hero-glow-1"></div>
        <div className="hero-glow hero-glow-2"></div>
        <div className="hero-glow hero-glow-3"></div>
        <div className="hero-grid-bg"></div>
        <div className="hero-container">
          <div className="hero-badge">Coming 2026 &middot; Built in Ireland</div>
          <h1 className="hero-title">
            Predicting medication shortages
            <span className="hero-title-accent"> before they happen.</span>
          </h1>
          <p className="hero-subtitle">
            Insova is building an AI-powered shortage prediction platform for Irish community 
            pharmacies. Turning weeks of foresight into action, where today there is none.
          </p>
          <div className="hero-actions">
            <a href="#solution" className="btn btn-primary">How It Works</a>
            <a href="#contact" className="btn btn-secondary">Partner With Us</a>
          </div>
        </div>
      </header>

      {/* Problem */}
      <section className="section section-problem" id="problem">
        <div className="container">
          <div className="section-label">The Problem</div>
          <h2 className="section-title">Ireland's pharmacies are in crisis.</h2>
          <p className="section-intro">
            Medication shortages have increased 30% in two years. Every single pharmacy in Ireland is affected, 
            and the only system in place is reactive. Pharmacists discover shortages when it's already too late.
          </p>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">361</div>
              <div className="stat-desc">drugs currently on the HPRA shortage list</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">42%</div>
              <div className="stat-desc">of pharmacists encountered over 61 shortages in the previous 4 months</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">6+ hrs</div>
              <div className="stat-desc">per week spent by pharmacists manually managing shortages</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">71%</div>
              <div className="stat-desc">report negative patient outcomes directly from shortages</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">73%</div>
              <div className="stat-desc">of community pharmacists indicated they experienced burnout in their role</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">78%</div>
              <div className="stat-desc">of Irish pharmacists expect the medicine shortage crisis to worsen over the coming year</div>
            </div>
          </div>
          <div className="problem-quote">
            <p>
              "Whilst medicine shortages may be a feature of modern health systems, we need to ensure 
              that the impact of such shortages is minimised to the greatest extent possible."
            </p>
            <cite>&mdash; Clare Fitzell, Secretary General, Irish Pharmacy Union, 2025</cite>
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="section section-solution" id="solution">
        <div className="container">
          <div className="section-label">The Solution</div>
          <h2 className="section-title">Intelligence, not guesswork.</h2>
          <p className="section-intro">
            Insova combines real-time data, historical patterns, and machine learning to give 
            pharmacists the one thing they've never had: advance warning.
          </p>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </div>
              <h3>Early Warning</h3>
              <p>
                Predict shortages 6+ weeks before they impact your pharmacy, using 
                demand-side analytics and historical patterns.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/>
                  <polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
              </div>
              <h3>Cascade Detection</h3>
              <p>
                See how primary shortages create secondary shortages in alternative drugs &mdash; 
                before the domino effect reaches your shelves.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h3>Alternatives Engine</h3>
              <p>
                Clinically appropriate alternative suggestions with dosing equivalents, 
                always requiring pharmacist or GP sign-off.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <h3>Pharmacy Network</h3>
              <p>
                Connect with other pharmacies to share stock visibility, replacing 
                the current system of ringing around.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <h3>Human in the Loop</h3>
              <p>
                Every clinical suggestion requires professional sign-off. 
                AI supports your decisions, it never replaces them.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Policy Alignment */}
      <section className="section section-policy" id="policy">
        <div className="container">
          <div className="section-label">Policy Alignment</div>
          <h2 className="section-title">Built for where Ireland is going.</h2>
          <p className="section-intro">
            Insova is aligned with Ireland's national healthcare AI strategy and upcoming 
            legislative changes that are transforming how pharmacies manage medication supply.
          </p>
          <div className="policy-grid">
            <div className="policy-card">
              <div className="policy-tag">HSE AI for Care 2026&ndash;2030</div>
              <h3>Supply Chain AI Optimisation</h3>
              <p>
                The HSE's AI Strategic Roadmap (ID 2.6) targets AI-powered supply chain 
                and logistic optimisation for Horizon 2 (2028). Insova is building the solution now, 
                so it's proven and ready when the HSE is.
              </p>
              <a href="https://about.hse.ie/publications/ai-for-care-2026-2030/" target="_blank" rel="noopener noreferrer" className="policy-link">
                Read the AI for Care Strategy &rarr;
              </a>
            </div>
            <div className="policy-card">
              <div className="policy-tag">Community Pharmacy Agreement 2025</div>
              <h3>Digital Health Priority</h3>
              <p>
                &euro;75 million invested in community pharmacy, explicitly calling it a 
                critical enabler for Ireland's digital health priorities, with AI highlighted 
                for personalised medicine and predictive analytics.
              </p>
            </div>
            <div className="policy-card">
              <div className="policy-tag">Health (Miscellaneous Provisions) Act 2024</div>
              <h3>Serious Shortage Protocol</h3>
              <p>
                New legislation enabling pharmacists to substitute medicines without reverting 
                to the prescriber, creating a direct use case for Insova's alternatives engine.
              </p>
              <a href="https://www.oireachtas.ie/en/bills/bill/2024/5/" target="_blank" rel="noopener noreferrer" className="policy-link">
                View the Health Act &rarr;
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* UCC Banner */}
      <div className="ucc-banner">
        <div className="ucc-banner-overlay"></div>
        <div className="ucc-banner-content">
          <p className="ucc-banner-text">Founded at University College Cork</p>
        </div>
      </div>

      {/* Team */}
      <section className="section section-team" id="team">
        <div className="container">
          <div className="section-label">Our Team</div>
          <h2 className="section-title">Pharmacy meets technology.</h2>
          <p className="section-intro">
            Insova is co-founded by a pharmacy and technology partnership from University College Cork, 
            with deep clinical advisory support from leading shortage researchers.
          </p>
          <div className="team-grid-two">
            <div className="team-card">
              <div className="team-photo">
                <img src={process.env.PUBLIC_URL + '/isobel.jpeg'} alt="Isobel Hynes" />
              </div>
              <h3>Isobel Hynes</h3>
              <div className="team-role">Co-Founder &middot; Pharmacy</div>
              <p>
                Pharmacy student at UCC with deep domain expertise in medication management 
                and shortage impact. Research focused on AI-driven shortage prediction 
                under the supervision of leading UCC researchers.
              </p>
            </div>
            <div className="team-card">
              <div className="team-photo">
                <img src={process.env.PUBLIC_URL + '/jack.png'} alt="Jack Kennedy" />
              </div>
              <h3>Jack Kennedy</h3>
              <div className="team-role">Co-Founder &middot; Technology</div>
              <p>
                Business Information Systems student at UCC. Building the technical 
                platform, from data pipelines and prediction models to the pharmacist-facing 
                dashboard and communication tools.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="section section-contact" id="contact">
        <div className="container">
          <div className="section-label">Get in Touch</div>
          <h2 className="section-title">Interested in Insova?</h2>
          <p className="section-intro">
            Whether you're a pharmacist interested in early access, a potential partner, 
            or a researcher working on medication shortages, we'd love to hear from you.
          </p>
          <div className="contact-cards">
            <a href="mailto:jack@insova.ie" className="contact-card">
              <svg className="contact-svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              <div className="contact-type">Email Us</div>
              <div className="contact-value">jack@insova.ie</div>
            </a>
            <a href="https://www.linkedin.com/company/insova" target="_blank" rel="noopener noreferrer" className="contact-card">
              <svg className="contact-svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              <div className="contact-type">LinkedIn</div>
              <div className="contact-value">Connect with us</div>
            </a>
          </div>
          <div className="contact-note">
            We're currently in the research and development phase, working with 
            UCC and pharmacy partners to build and validate our prediction model. 
            Early access trials beginning 2026.
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-brand">
            <img src={process.env.PUBLIC_URL + '/insova-logo.png'} alt="Insova" className="logo-icon" width="80" height="80" />
            <span>Insova</span>
          </div>
          <div className="footer-text">
            AI-powered medication shortage prediction for Irish pharmacies.
          </div>
          <div className="footer-bottom">
            <span>&copy; 2026 Insova. All rights reserved.</span>
            <span>Cork, Ireland</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;