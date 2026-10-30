import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { Link, usePageTitle } from "../lib/router.jsx";
import { cx, prefersReducedMotion } from "../lib/motion.js";
import { CountUp, Reveal } from "../components/motion.jsx";
import { useToast } from "../components/Toast.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";

const NAV = [
  ["home", "Home"],
  ["services", "Services"],
  ["crm", "CRM"],
  ["solutions", "Solutions"],
  ["about", "About"],
  ["contact", "Contact"],
];

function SiteHeader() {
  const progressRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("home");

  // Reading progress, condensed header and the section currently in view
  useEffect(() => {
    let ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progressRef.current?.style.setProperty("--p", max > 0 ? (y / max).toFixed(4) : "0");
      setScrolled(y > 8);
      const line = window.innerHeight * 0.35;
      let current = "home";
      NAV.slice(1).forEach(([id]) => {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= line) current = id;
      });
      if (max > 0 && y >= max - 4) current = NAV[NAV.length - 1][0];
      setActive(current);
    };
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <>
      <div className="scroll-progress" ref={progressRef} aria-hidden="true" />
      <header className={cx("site-header", scrolled && "is-scrolled")}>
        <div className="container nav-bar">
          <div className="brand">
            <img className="brand-mark" src="/images/gb-tech-logo.png" alt="" />
            <div>
              <strong>GB Tech Corp</strong>
              <span>Innovation Reloaded</span>
            </div>
          </div>
          <nav className="main-nav" aria-label="Main navigation">
            {NAV.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className={active === id ? "is-active" : undefined}
                aria-current={active === id ? "true" : undefined}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="nav-actions">
            <ThemeToggle />
            <Link className="btn btn-primary" to="/admin-login">Admin Login</Link>
          </div>
        </div>
      </header>
    </>
  );
}

function Hero() {
  const heroRef = useRef(null);
  const frame = useRef(0);

  // Soft glow that follows the pointer
  const handlePointerMove = (event) => {
    if (frame.current || prefersReducedMotion() || !window.matchMedia("(pointer: fine)").matches) return;
    const { clientX, clientY } = event;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const bounds = heroRef.current?.getBoundingClientRect();
      if (!bounds) return;
      heroRef.current.style.setProperty("--mx", `${clientX - bounds.left}px`);
      heroRef.current.style.setProperty("--my", `${clientY - bounds.top}px`);
    });
  };

  return (
    <section className="hero" ref={heroRef} onPointerMove={handlePointerMove}>
      <div className="container hero-grid">
        <div className="hero-copy">
          <span className="eyebrow">Technology that powers growth</span>
          <h1>Digital systems built for modern offices.</h1>
          <p>
            GB Tech Corp helps businesses streamline operations, modernize workflows,
            and grow with confidence through smart IT, CRM, and digital strategy.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#contact">Book a Consultation</a>
            <Link className="btn btn-secondary" to="/admin-login">View CRM</Link>
          </div>
          <ul className="quick-points">
            <li>24/7 IT support</li>
            <li>Custom CRM setup</li>
            <li>Business automation</li>
          </ul>
        </div>

        <div className="hero-panel">
          <div className="panel-card metric-card">
            <div>
              <span className="label">Client retention</span>
              <strong><CountUp text="96%" delay={450} /></strong>
            </div>
            <span className="trend up">+18% this year</span>
          </div>
          <div className="panel-card dashboard-card">
            <div className="mini-header">
              <span>Operations Snapshot</span>
              <span className="status-dot">Live</span>
            </div>
            <div className="bars">
              {[38, 52, 60, 74, 90].map((height) => <span key={height} style={{ height: `${height}%` }} />)}
            </div>
          </div>
          <div className="panel-card info-card">
            <p>Projects delivered</p>
            <strong><CountUp text="180+" delay={450} /></strong>
            <small>Across startups, agencies, and offices.</small>
          </div>
        </div>
      </div>
    </section>
  );
}

const STATS = [
  ["120+", "Businesses supported"],
  ["8 yrs", "Industry experience"],
  ["5.0/5", "Average client rating"],
  ["24/7", "Helpdesk coverage"],
];

const SERVICES = [
  ["it-infrastructure", "Illustration of connected IT infrastructure, servers, and devices", "IT Infrastructure", "Reliable networks, device management, and infrastructure support for growing teams."],
  ["crm-management", "CRM interface illustration for managing contacts and leads", "CRM Management", "Lead tracking, contact management, sales visibility, and customer follow-up automation."],
  ["business-automation", "Business workflow automation technology illustration", "Business Automation", "Streamlined repeatable tasks, reporting, and document workflows that save time daily."],
];

const CRM_FEATURES = [
  ["01", "Bring leads into focus", "Collect enquiries, keep contact details together, and record each opportunity with its source, owner, status, and value."],
  ["02", "See the pipeline clearly", "Search and filter leads by status, from first contact through qualification and proposal, so your team can find the right record quickly."],
  ["03", "Make decisions with context", "Review live lead totals, qualified opportunities, pipeline value, your employee directory, team tasks, and customer enquiries in one workspace."],
];

const SOLUTIONS = [
  ["Workflow optimization", "Reduce manual admin and improve team coordination."],
  ["Data-driven decisions", "Turn customer and business data into smarter performance insights."],
  ["Long-term growth", "Build systems that support expansion without operational friction."],
];

const QUOTES = [
  ["Our sales process became much more organized after implementing the CRM system.", "Sarah M., Operations Lead"],
  ["GB Tech Corp made our office systems easier to manage and much more reliable.", "Daniel F., Managing Director"],
  ["The team is responsive, knowledgeable, and always focused on practical business value.", "Aisha T., Business Owner"],
];

function ContactForm() {
  const toast = useToast();
  const [status, setStatus] = useState({ text: "", type: "" });
  const [sending, setSending] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setSending(true);
    try {
      await api("/api/enquiries", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
      });
      form.reset();
      setStatus({ text: "Thanks. Your enquiry has been sent to our team.", type: "success" });
      toast("Enquiry sent. We’ll be in touch soon.");
    } catch (error) {
      setStatus({ text: error.message, type: "error" });
    } finally {
      setSending(false);
    }
  }

  return (
    <form id="contactForm" className="contact-form" onSubmit={handleSubmit}>
      <div className="contact-fields">
        <input name="name" type="text" placeholder="Your name" aria-label="Your name" required />
        <input name="email" type="email" placeholder="Work email" aria-label="Work email" required />
        <input name="subject" type="text" placeholder="What can we help with?" aria-label="Subject" required />
        <textarea name="message" placeholder="Tell us a little more" aria-label="Message" rows={3} required />
      </div>
      <button className="btn btn-primary" type="submit" disabled={sending}>
        {sending ? "Sending…" : "Send enquiry"}
      </button>
      <p id="contactMessage" className={cx("contact-message", status.type)} aria-live="polite">{status.text}</p>
    </form>
  );
}

export default function HomePage() {
  usePageTitle("GB Tech Corp | Smart Business Solutions");

  // Support links like /#contact when arriving from another page
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  return (
    <>
      <SiteHeader />
      <main id="home">
        <Hero />

        <section className="stats">
          <Reveal className="container stats-grid">
            {STATS.map(([value, label]) => (
              <div className="stat-box" key={label}>
                <strong><CountUp text={value} /></strong>
                <span>{label}</span>
              </div>
            ))}
          </Reveal>
        </section>

        <section id="services" className="section">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow accent">Our services</span>
              <h2>Solutions tailored for office productivity</h2>
            </div>
            <div className="card-grid three-col">
              {SERVICES.map(([image, alt, title, text], index) => (
                <Reveal as="article" className="feature-card" delay={index * 90} key={title}>
                  <img className="feature-card-image" src={`/images/services/${image}.png`} alt={alt} loading="lazy" />
                  <h3>{title}</h3>
                  <p>{text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="crm" className="section crm-overview">
          <div className="container">
            <Reveal className="crm-overview-heading">
              <div>
                <span className="eyebrow accent">Customer relationship management</span>
                <h2>Every lead. Every next step. One clear view.</h2>
              </div>
              <p>
                Keep customer enquiries and sales opportunities organized with a CRM workspace
                designed around the way your team works.
              </p>
            </Reveal>
            <div className="crm-feature-grid">
              {CRM_FEATURES.map(([number, title, text], index) => (
                <Reveal as="article" className="crm-feature-card" delay={index * 90} key={number}>
                  <span className="crm-feature-number" aria-hidden="true">{number}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </Reveal>
              ))}
            </div>
            <Reveal className="crm-overview-footer">
              <p>Want a CRM shaped around your business process?</p>
              <div className="crm-overview-actions">
                <a className="btn btn-primary" href="#contact">Talk to our team</a>
                <Link className="crm-text-link" to="/admin-login">Explore the CRM workspace <span aria-hidden="true">→</span></Link>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="solutions" className="section muted-section">
          <div className="container split-layout">
            <Reveal>
              <span className="eyebrow accent">Why GB Tech Corp</span>
              <h2>Built to help teams move faster and serve customers better.</h2>
              <p>
                We combine strategy, technical implementation, and ongoing support to help businesses stay organized,
                responsive, and competitive.
              </p>
              <ul className="check-list">
                <li>Dedicated support and onboarding</li>
                <li>Custom CRM for lead and sales tracking</li>
                <li>Secure, scalable digital systems</li>
                <li>Transparent reporting and dashboards</li>
              </ul>
            </Reveal>
            <div className="feature-stack">
              {SOLUTIONS.map(([title, text], index) => (
                <Reveal className="mini-panel" delay={index * 90} key={title}>
                  <h4>{title}</h4>
                  <p>{text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="section">
          <div className="container">
            <div className="section-heading center">
              <span className="eyebrow accent">About us</span>
              <h2>Technology for growing businesses.</h2>
            </div>
            <Reveal className="story-box">
              <p>
                GB Tech Corp partners with offices and organizations that need dependable technology, clearer workflows,
                and a more structured customer journey. From setup to support, we help teams deliver smoother operations.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="section testimonials">
          <div className="container">
            <div className="section-heading center">
              <span className="eyebrow accent">Client feedback</span>
              <h2>Trusted by forward-thinking teams</h2>
            </div>
            <div className="card-grid three-col">
              {QUOTES.map(([quote, author], index) => (
                <Reveal as="blockquote" className="quote-card" delay={index * 90} key={author}>
                  “{quote}”
                  <footer>— {author}</footer>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="section cta-section">
          <Reveal className="container cta-box">
            <div>
              <span className="eyebrow accent">Let’s build your next move</span>
              <h2>Ready to upgrade your office systems?</h2>
            </div>
            <ContactForm />
          </Reveal>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-row">
          <p>© {new Date().getFullYear()} GB Tech Corp. All rights reserved.</p>
          <div className="social-links">
            <a href="https://www.linkedin.com/company/gbtechcorp/posts/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
            <a href="https://www.instagram.com/gbtechcorp/?hl=en" target="_blank" rel="noopener noreferrer">Instagram</a>
          </div>
        </div>
      </footer>
    </>
  );
}
