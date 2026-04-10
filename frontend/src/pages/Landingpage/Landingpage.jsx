import React from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Bell,
  Brain,
  CalendarDays,
  Check,
  ClipboardList,
  Download,
  FileText,
  HeartHandshake,
  Pill,
  ScanSearch,
  Shield,
  Stethoscope,
  Upload,
  Video,
  Wallet,
  ExternalLink,
} from "lucide-react";
import techMedixApkImage from "../../assets/TechMedix APK.png";
import dowappImage from "../../assets/dowapp.png";
import "./Landingpage.css";

const featureCards = [
  {
    title: "Appointments + queue",
    description:
      "Book appointments, see availability, and follow queue updates from your dashboard.",
    cta: "Open dashboard",
    to: "/home",
    icon: CalendarDays,
  },
  {
    title: "Video consultation flow",
    description:
      "Consultation-ready experience with queue status, timeline context, and follow-up flows.",
    cta: "See consult flow",
    to: "/home",
    icon: Video,
  },
  {
    title: "Reminders + notifications",
    description:
      "Medicine reminders and timely updates so you never miss what matters.",
    cta: "View reminders",
    to: "/home",
    icon: Bell,
  },
  {
    title: "Medicine search + wishlist",
    description:
      "Search medicines, compare options, and save favorites for quick reordering.",
    cta: "Search medicines",
    to: "/home",
    icon: Pill,
  },
  {
    title: "Payments + Health Wallet",
    description:
      "Wallet flows with payment support for smoother appointment and follow-up journeys.",
    cta: "Open Health Wallet",
    to: "/home",
    icon: Wallet,
  },
  {
    title: "Health metrics + history",
    description:
      "Track personal metrics and build a clearer view of trends over time.",
    cta: "See metrics",
    to: "/home",
    icon: Activity,
  },
  {
    title: "Prescription upload + insights",
    description:
      "Upload prescriptions and review structured details inside your timeline.",
    cta: "Upload now",
    to: "/home",
    icon: Upload,
  },
];

const doctorCards = [
  {
    name: "Dr. A. Sharma",
    specialty: "General Physician",
    badge: "Next available",
  },
  {
    name: "Dr. R. Mehta",
    specialty: "Dermatology",
    badge: "Queue updates",
  },
  {
    name: "Dr. S. Iyer",
    specialty: "Cardiology",
    badge: "Follow-ups",
  },
];

const careHighlights = [
  {
    title: "Secure sessions",
    description: "JWT + cookie-based authentication and role-based access.",
    icon: Shield,
  },
  {
    title: "Patient-first UX",
    description: "Soft UI, clear pathways, and calm visual hierarchy.",
    icon: HeartHandshake,
  },
  {
    title: "Doctor-ready tools",
    description:
      "Queue, appointments, schedule management, and patient lookup.",
    icon: Stethoscope,
  },
];

const trackingCards = [
  {
    title: "Metrics + trends",
    description:
      "Track health metrics and create a history that supports better conversations and follow-ups.",
    bullets: [
      "Health metrics view and personal history",
      "Timeline-friendly organization",
      "Optional Google Fit integration",
    ],
    cta: "Open health metrics",
    to: "/home",
    icon: Activity,
  },
  {
    title: "Reminders + follow-through",
    description:
      "A practical set of tools for daily consistency: reminders, notifications, and visit continuity.",
    bullets: [
      "Medicine reminder schedules",
      "Queue and appointment updates",
      "Follow-up prompts after visits",
    ],
    cta: "View reminders",
    to: "/home",
    icon: Bell,
  },
];

const aiCards = [
  {
    title: "Health insights",
    description:
      "AI-assisted flows to help summarize and organize health context.",
    icon: Brain,
  },
  {
    title: "Report generation",
    description:
      "Generate readable summaries that support follow-ups and continuity.",
    cta: "Open report generator",
    to: "/home",
    icon: FileText,
  },
  {
    title: "X-ray analysis",
    description:
      "Dedicated analysis flows with history views for patients who need it.",
    cta: "Open X-ray analyzer",
    to: "/home",
    icon: ScanSearch,
  },
];

const navLinks = [
  { label: "Preview", href: "#preview" },
  { label: "Care", href: "#care" },
  { label: "Tracking", href: "#tracking" },
  { label: "AI", href: "#ai" },
  { label: "Download", href: "#download" },
];

const specialtyPills = [
  "General Physician",
  "Pediatrics",
  "Dermatology",
  "Cardiology",
  "Orthopedics",
  "Mental Wellness",
];

const quickTags = [
  { label: "Secure login", icon: Shield },
  { label: "Reminders", icon: Bell },
  { label: "Metrics + history", icon: Activity },
  { label: "Medicine search", icon: Pill },
];

const storeButtons = ["GET IT ON Google Play", "Download on the App Store"];

const footerLinks = [
  { label: "Preview", href: "#preview" },
  { label: "Care", href: "#care" },
  { label: "Tracking", href: "#tracking" },
  { label: "AI", href: "#ai" },
  { label: "Download", href: "#download" },
  { label: "Terms", to: "/terms" },
];

const footerHighlights = [
  {
    label: "24/7 access",
    description: "Appointments, reminders, and consult history in one place.",
    icon: CalendarDays,
  },
  {
    label: "Secure care flow",
    description: "Authentication, health records, and protected sessions.",
    icon: Shield,
  },
  {
    label: "AI-assisted tools",
    description: "Structured reports and clinical support workflows.",
    icon: Brain,
  },
];

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="landing-section-heading">
      {eyebrow ? <span className="landing-eyebrow">{eyebrow}</span> : null}
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

const Landingpage = ({ setShowLogin }) => {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-header__inner">
          <Link className="landing-brand" to="/">
            TechMedix
          </Link>

          <nav className="landing-nav" aria-label="Landing page">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>

          <div className="landing-header__actions">
            <button
              type="button"
              className="landing-button landing-button--ghost"
              onClick={() => setShowLogin?.(true)}
            >
              Patient login
            </button>
            <Link className="landing-button landing-button--primary" to="/doctor/login">
              Doctor login
            </Link>
          </div>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero" id="preview">
          <div className="landing-hero__copy">
            <span className="landing-badge">Connected care on web + mobile</span>
            <h1>
              Care beyond the clinic. Trust beyond the screen
            </h1>
            <p>
              Book appointments, follow real-time queues, upload prescriptions,
              track health metrics, and access AI-assisted insights built for
              patients, doctors, and admins.
            </p>

            <div className="landing-hero__actions">
              <Link className="landing-button landing-button--primary" to="/home">
                Open patient dashboard
              </Link>
              <Link className="landing-button landing-button--medicine" to="/search">
                Search Medicines
              </Link>
              <a className="landing-button landing-button--ghost" href="https://drive.google.com/uc?export=download&id=1lrCdWHnf_6N5ZcSrMPA7uUrT4lnrCfEQ">
                Download the app
              </a>
            </div>

            <div className="landing-tag-list">
              {quickTags.map((tag) => {
                const Icon = tag.icon;
                return (
                  <span key={tag.label} className="landing-tag">
                    <Icon size={18} />
                    {tag.label}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="landing-preview-card">
            <div className="landing-preview-card__top">
              <h3>Live consultation preview</h3>
              <div className="landing-chip-group">
                <span>Video</span>
                <span>Doctor queue</span>
                <span>Prescription notes</span>
              </div>
            </div>

            <div className="landing-preview-card__screens">
              <div>Doctor</div>
              <div>Patient</div>
              <div>Vitals</div>
            </div>

            <div className="landing-preview-card__controls">
              <span className="landing-call landing-call--accept" />
              <span className="landing-call landing-call--mute" />
              <span className="landing-call landing-call--end" />
            </div>

            <div className="landing-preview-card__stats">
              <div>
                <strong>Queue</strong>
                <span>Real-time updates</span>
              </div>
              <div>
                <strong>After-care</strong>
                <span>Reminders + timeline</span>
              </div>
              <div>
                <strong>Payments</strong>
                <span>Wallet-ready flows</span>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section" id="care">
          <SectionHeading
            title="Everything you need to manage care"
            description="Core patient flows, doctor tools, and platform features designed with soft UI and calming healthcare colors."
          />

          <div className="landing-feature-grid">
            {featureCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.title} className="landing-card">
                  <div className="landing-card__icon">
                    <Icon size={24} />
                  </div>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                  <button
                    type="button"
                    className="landing-card__cta"
                    onClick={() => setShowLogin?.(true)}
                  >
                    {card.cta} →
                  </button>
                </article>
              );
            })}
          </div>
        </section>



        <section className="landing-section" id="preview-care">
          <SectionHeading
            title="Specialist care, organized for speed"
            description="Find the right care path quickly, then book an appointment and follow your queue status with updates."
          />

          <div className="landing-pill-row">
            {specialtyPills.map((pill) => (
              <span key={pill}>{pill}</span>
            ))}
          </div>

          <div className="landing-care-grid">
            <div className="landing-doctor-list">
              {doctorCards.map((doctor) => (
                <article key={doctor.name} className="landing-doctor-card">
                  <div>
                    <h3>{doctor.name}</h3>
                    <p>{doctor.specialty}</p>
                  </div>
                  <span>{doctor.badge}</span>
                </article>
              ))}

              <div className="landing-care-grid__actions">
                <Link
                  type="button"
                  className="landing-button landing-button--primary"
                  to="/home"
                >
                  Open patient dashboard
                </Link>
                <Link
                  type="button"
                  className="landing-button landing-button--ghost"
                  to="/search"
                >
                  Browse medicines
                </Link>
              </div>
            </div>

            <div className="landing-highlight-list">
              {careHighlights.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="landing-highlight-card">
                    <div className="landing-card__icon">
                      <Icon size={24} />
                    </div>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="landing-section" id="tracking">
          <SectionHeading
            title="Health tracking that fits your routine"
            description="Keep a personal view of metrics, reminders, and health history, then bring it into your next consult."
          />

          <div className="landing-tracking-grid">
            {trackingCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.title} className="landing-card landing-card--large">
                  <div className="landing-card__icon">
                    <Icon size={24} />
                  </div>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                  <ul className="landing-check-list">
                    {card.bullets.map((bullet) => (
                      <li key={bullet}>
                        <Check size={18} />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="landing-button landing-button--ghost landing-button--inline"
                    onClick={() => setShowLogin?.(true)}
                  >
                    {card.cta}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="landing-section" id="ai">
          <SectionHeading
            title="Clinical intelligence built in"
            description="TechMedix includes AI-assisted flows for health insights, prescriptions, and X-ray analysis."
          />

          <div className="landing-ai-grid">
            {aiCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.title} className="landing-card landing-card--ai">
                  <div className="landing-card__icon">
                    <Icon size={24} />
                  </div>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                  {card.cta ? (
                    <button
                      type="button"
                      className="landing-card__cta"
                      onClick={() => setShowLogin?.(true)}
                    >
                      {card.cta}
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
                <section className="landing-section" id="download">
          <SectionHeading
            title="Download the TechMedix mobile app"
            description="Use the Mobile App to keep care close: appointments, reminders, health metrics, and connected updates."
          />

          <div className="landing-download">
            <div className="landing-download__actions">
              <div className="landing-download__preview">
                <img src={dowappImage} alt="TechMedix app preview" />
              </div>
            </div>

            <div className="landing-qr-card">
              <h3>Scan to download</h3>
              <div className="landing-qr-placeholder" aria-hidden="true">
                <img src={techMedixApkImage} alt="TechMedix APP
                oad" />
              </div>
              <div className="landing-download__buttons">
                <a className="landing-button landing-button--primary" href="https://drive.google.com/uc?export=download&id=1lrCdWHnf_6N5ZcSrMPA7uUrT4lnrCfEQ">
                  <Download size={18} />
                  Download APP
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer__shell">
          

          <div className="landing-footer__grid">
            <div className="landing-footer__column">
              <h3>Quick links</h3>
              <nav className="landing-footer__nav" aria-label="Footer">
                {footerLinks.map((link) =>
                  link.to ? (
                    <Link key={link.label} to={link.to}>
                      {link.label}
                    </Link>
                  ) : (
                    <a key={link.label} href={link.href}>
                      {link.label}
                    </a>
                  )
                )}
              </nav>
            </div>

            <div className="landing-footer__column">
              <h3>Why it works</h3>
              <div className="landing-footer__highlights">
                {footerHighlights.map((item) => {
                  const Icon = item.icon;

                  return (
                    <article key={item.label} className="landing-footer__highlight">
                      <div className="landing-footer__highlight-icon">
                        <Icon size={18} />
                      </div>
                      <div>
                        <strong>{item.label}</strong>
                        <p>{item.description}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="landing-footer__column landing-footer__column--card">
              <Link
                className="landing-button landing-button--ghost"
                to="/about-techmedix"
              >
                <div className="landing-mini-shot">
                  <ExternalLink size={25} style={{ marginLeft: "6px" }} />
                  <span>Want to know more about the website</span>
                </div>
              </Link>
              <p className="landing-footer__caption">
                Built for queue visibility, secure sessions, reminders, and
                continuous patient context.
              </p>
            </div>
          </div>

          <div className="landing-footer__meta">
            <p>© 2025 TechMedix</p>
            <span>Built for calm, connected care.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landingpage;
