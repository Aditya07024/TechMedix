import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { assets } from "../../assets/assets";
import "./Landingpage.css";
import logo from "../../../public/Screenshot_2025-05-21_at_9.08.34_PM-removebg-preview.png";
import landingphoto from "../../assets/landingphoto.jpg";


const navigationItems = [
  { label: "Home", href: "#home" },
  { label: "About Us", href: "#about" },
  { label: "Experties", href: "#expertise" },
  { label: "Facilities", href: "#facilities" },
  { label: "News", href: "#news" },
];

const expertiseItems = [
  {
    title: "Primary Care",
    description:
      "Compassionate consultations, preventive screening, and continuity of care built around your routine.",
  },
  {
    title: "Specialist Support",
    description:
      "Integrated referrals and treatment planning across multiple disciplines inside one connected system.",
  },
  {
    title: "Digital Follow-Up",
    description:
      "Seamless appointment reminders, recovery guidance, and health records that stay accessible.",
  },
];

const facilityItems = [
  "Modern consultation rooms designed for privacy and comfort.",
  "Queue-friendly waiting areas with a calming patient-first layout.",
  "End-to-end appointment coordination from intake to follow-up.",
];

const newsItems = [
  {
    title: "Expanded Consultation Hours",
    description:
      "Early and late appointment windows help patients book care around work and family schedules.",
  },
  {
    title: "Patient Experience Upgrade",
    description:
      "A refined front-desk and waiting-flow process keeps each visit calmer, faster, and more predictable.",
  },
];

const Landingpage = () => {
  const heroSectionRef = useRef(null);
  const heroContentRef = useRef(null);

  useEffect(() => {
    const heroSection = heroSectionRef.current;
    const heroContent = heroContentRef.current;

    if (!heroSection || !heroContent) {
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      heroContent.style.setProperty("--hero-scroll-progress", "0");
      return undefined;
    }

    let ticking = false;

    const updateHeroMotion = () => {
      const rect = heroSection.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const scrollSpan = Math.max(heroSection.offsetHeight - viewportHeight * 0.28, 1);
      const progress = Math.min(Math.max(-rect.top / scrollSpan, 0), 1);

      heroContent.style.setProperty("--hero-scroll-progress", progress.toFixed(3));
      ticking = false;
    };

    const requestUpdate = () => {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(updateHeroMotion);
    };

    updateHeroMotion();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, []);

  return (
    <div className="landing-shell">
      <main className="landing-page">
        <section className="landing-hero" id="home" ref={heroSectionRef}>
          <header className="landing-nav">
            <a className="landing-brand" href="#home" aria-label="TechMedix home">
              <span className="landing-brand-mark" aria-hidden="true">
                <img src={assets.logo} alt="" />
              </span>
              {/* <span className="landing-brand-name">TechMedix</span> */}
            </a>

            <div className="landing-nav-actions">
              <Link to="/home" className="landing-secondary-action">
                Patient Login
              </Link>
              <Link to="/doctor/signup" className="landing-primary-action">
                Doctor Login
              </Link>
            </div>
          </header>

          <div className="landing-hero-media">
            <div className="landing-hero-overlay" />
            <img src={landingphoto} alt="Hospital hallway" />

            <div className="landing-hero-content" ref={heroContentRef}>
              <h1>YOUR JOURNEY TO WELLNESS BEGINS AT HERE</h1>
              <p>
                Schedule your appointment today and embark on a health journey
                where you are the hero. Your well-being starts with us.
              </p>
              <Link to="/home" className="landing-hero-cta">
                Click Here
              </Link>
            </div>
          </div>
        </section>

        <section className="landing-info-section" id="about">
          <div className="landing-section-heading">
            <span>About Us</span>
            <h2>Calm spaces, clear care, and one place to begin.</h2>
          </div>
          <p>
            TechMedix brings consultations, appointment flow, and follow-up
            support into a single patient experience designed to feel simple and
            reassuring from the moment you arrive.
          </p>
        </section>

        <section className="landing-card-grid" id="expertise">
          {expertiseItems.map((item) => (
            <article className="landing-info-card" key={item.title}>
              <span className="landing-card-kicker">Experties</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </section>

        <section className="landing-split-section" id="facilities">
          <div className="landing-section-heading">
            <span>Facilities</span>
            <h2>Designed to make every visit feel lighter.</h2>
          </div>
          <div className="landing-facility-list">
            {facilityItems.map((item) => (
              <div className="landing-facility-item" key={item}>
                <span className="landing-facility-bullet" aria-hidden="true" />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-news-section" id="news">
          <div className="landing-section-heading">
            <span>News</span>
            <h2>Patient updates from the clinic floor.</h2>
          </div>
          <div className="landing-news-grid">
            {newsItems.map((item) => (
              <article className="landing-news-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Landingpage;
