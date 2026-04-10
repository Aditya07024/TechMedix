import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BrainCircuit,
  Database,
  Globe,
  HeartPulse,
  Layers3,
  Lock,
  Server,
  Sparkles,
  Stethoscope,
  Upload,
  Users,
  Workflow,
  Wrench,
} from "lucide-react";
import "./AboutTechMedix.css";

const overviewCards = [
  {
    title: "Who it serves",
    description:
      "Patients, doctors, and admins each get a separate flow so the same platform supports care delivery, operations, and follow-up.",
    icon: Users,
  },
  {
    title: "What it solves",
    description:
      "Appointments, queue visibility, prescriptions, medicine discovery, reports, scans, and health tracking are handled in one connected product.",
    icon: HeartPulse,
  },
  {
    title: "How it feels",
    description:
      "The product is designed to reduce friction. Patients get clarity, doctors get speed, and admins get control over the system.",
    icon: Sparkles,
  },
];

const stackGroups = [
  {
    title: "User experience layer",
    icon: Globe,
    items: [
      "Clean and responsive interface that works smoothly on web and mobile screens",
      "Easy navigation between pages like appointments, reports, and medicines",
      "Real-time updates so users don’t need to refresh manually",
      "Visual charts and simple layouts to make health data understandable",
    ],
  },
  {
    title: "Core system engine",
    icon: Server,
    items: [
      "Handles user requests like booking appointments, uploading reports, and managing profiles",
      "Ensures secure login and keeps user roles (patient, doctor, admin) separate",
      "Manages file uploads like prescriptions and medical reports",
      "Connects different parts of the platform and keeps everything in sync",
    ],
  },
  {
    title: "Data management",
    icon: Database,
    items: [
      "Stores all important information like appointments, reports, and medical history",
      "Keeps data organized so it can be quickly accessed when needed",
      "Maintains records over time for better tracking and insights",
    ],
  },
  {
    title: "Smart intelligence layer",
    icon: BrainCircuit,
    items: [
      "Helps understand prescriptions and extract useful information automatically",
      "Suggests possible diseases based on symptoms using trained models",
      "Enhances medicine information when something is missing",
      "Analyzes X-rays and provides insights with optional visual explanations",
    ],
  },
];

const flowSteps = [
  {
    title: "Patient starts on the web or mobile surface",
    description:
      "A patient logs in, searches medicines, books an appointment, uploads a prescription, or opens a health tool.",
    icon: Users,
  },
  {
    title: "Frontend talks to the API layer",
    description:
      "React pages call Express routes using Axios. Protected flows carry auth context and user role information.",
    icon: Layers3,
  },
  {
    title: "Backend validates, stores, and coordinates",
    description:
      "Express routes validate input, check permissions, save records in Postgres, trigger uploads, and return structured responses.",
    icon: Workflow,
  },
  {
    title: "Live events update the experience",
    description:
      "Queue movement, patient arrival, consultation status, and notifications are pushed through Socket.IO instead of waiting for a page refresh.",
    icon: Server,
  },
  {
    title: "AI or ML services run when needed",
    description:
      "Prescription intelligence, disease prediction, medicine enrichment, and X-ray analysis are called only for the flows that require them.",
    icon: BrainCircuit,
  },
];

const intelligenceBlocks = [
  {
    title: "Agents in prescription workflows",
    description:
      "The backend orchestrator runs a sequence of specialized agents. First it extracts prescription information, then it runs safety and price checks in parallel, and finally it evaluates adherence-related guidance.",
    points: [
      "Extraction agent pulls structured medicine information from uploaded prescription data.",
      "Safety agent checks for issues that should block or warn before proceeding.",
      "Price agent looks for pricing intelligence and cost-oriented suggestions.",
      "Adherence agent focuses on how well the prescribed plan can be followed in practice.",
    ],
    icon: Workflow,
  },
  {
    title: "How the ML model works",
    description:
      "TechMedix includes a Python service that reads symptom inputs, turns them into a feature vector, and runs a trained decision-tree classifier to predict a likely disease label with confidence scores.",
    points: [
      "Training data is loaded from a CSV file of symptom columns and prognosis labels.",
      "Only valid symptom columns are used for training to avoid schema mismatch issues.",
      "The API returns a predicted disease, confidence, related symptoms, and probabilities.",
      "This is assistive output and should support, not replace, clinical judgment.",
    ],
    icon: BrainCircuit,
  },
  {
    title: "How prescription text is understood",
    description:
      "Prescription OCR cleanup is handled as a layered process: text correction first, then regex-based extraction, and then optional medical NER enrichment when that model is enabled.",
    points: [
      "Noisy OCR text is normalized to fix common handwriting and scan mistakes.",
      "Medicine names, dosage, duration, and frequency are extracted from cleaned lines.",
      "An optional ONNX medical NER model can enrich the parsed output offline.",
      "The result is easier to show in UI, compare, and use in downstream flows.",
    ],
    icon: Upload,
  },
  {
    title: "How X-ray analysis works",
    description:
      "The user uploads an X-ray image, the backend stores or forwards the file, then a dedicated AI service analyzes the scan and returns a primary diagnosis, confidence, and optional diagnostic heatmap.",
    points: [
      "Uploads are accepted by Express and optionally pushed to Cloudinary.",
      "The backend forwards the local file to a separate AI X-ray service.",
      "Predictions and metadata are stored so patients can revisit scan history later.",
      "Optional heatmaps can be generated for more interpretable visual output.",
    ],
    icon: Stethoscope,
  },
];

const nonTechnicalNotes = [
  "For patients, TechMedix acts like a digital care companion that keeps appointments, prescriptions, reminders, reports, and health history in one place.",
  "For doctors, it reduces admin friction by exposing queue state, patient context, schedules, and support tools inside a single workflow.",
  "For admins, it provides control over branches, platform operations, and higher-level monitoring across the system.",
  "For the product team, the architecture separates UI, API, storage, and intelligence layers so features can evolve without rebuilding the whole system.",
];

const trustNotes = [
  {
    title: "Access control",
    description:
      "Protected routes and backend middleware enforce patient, doctor, and admin permissions separately.",
    icon: Lock,
  },
  {
    title: "Service separation",
    description:
      "The core web app, ML API, and X-ray AI service are separated, which keeps heavier intelligence workloads outside the main request path when appropriate.",
    icon: Wrench,
  },
  {
    title: "Operational resilience",
    description:
      "Several flows already have fallback behavior, such as AI medicine lookup when the local medicine dataset does not contain a requested record.",
    icon: Layers3,
  },
];

const AboutTechMedix = () => {
  return (
    <div className="about-techmedix">
      <header className="about-techmedix__hero">
        <div className="about-techmedix__hero-inner">
          <Link className="about-techmedix__back" to="/">
            <ArrowLeft size={18} />
            Back to landing page
          </Link>

          <span className="about-techmedix__eyebrow">
            TechMedix architecture and platform overview
          </span>
          <h1>Everything about how TechMedix works</h1>
          <p>
            This page explains the platform in simple and technical terms:
            product purpose, tech stack, agent workflow, machine learning,
            real-time systems, data movement, and the reasoning behind the
            overall design.
          </p>

          <div className="about-techmedix__actions">
            <Link
              className="about-techmedix__button about-techmedix__button--primary"
              to="/home"
            >
              Explore the app
            </Link>
            <Link
              className="about-techmedix__button about-techmedix__button--ghost"
              to="/"
            >
              Return to landing
            </Link>
          </div>
        </div>
      </header>

      <main className="about-techmedix__content">
        <section className="about-techmedix__section">
          <div className="about-techmedix__section-heading">
            <span>Big picture</span>
            <h2>What TechMedix is</h2>
          </div>
          <div className="about-techmedix__grid about-techmedix__grid--three">
            {overviewCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.title} className="about-techmedix__card">
                  <div className="about-techmedix__icon">
                    <Icon size={22} />
                  </div>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="about-techmedix__section">
          <div className="about-techmedix__section-heading">
            <span>Technical foundation</span>
            <h2>The current stack</h2>
          </div>
          <div className="about-techmedix__grid about-techmedix__grid--two">
            {stackGroups.map((group) => {
              const Icon = group.icon;
              return (
                <article
                  key={group.title}
                  className="about-techmedix__card about-techmedix__card--stack"
                >
                  <div className="about-techmedix__icon">
                    <Icon size={22} />
                  </div>
                  <h3>{group.title}</h3>
                  <ul className="about-techmedix__list">
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        <section className="about-techmedix__section">
          <div className="about-techmedix__section-heading">
            <span>System flow</span>
            <h2>How the platform works end to end</h2>
          </div>
          <div className="about-techmedix__timeline">
            {flowSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <article key={step.title} className="about-techmedix__timeline-item">
                  <div className="about-techmedix__timeline-index">{index + 1}</div>
                  <div className="about-techmedix__timeline-body">
                    <div className="about-techmedix__icon">
                      <Icon size={20} />
                    </div>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.description}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="about-techmedix__section">
          <div className="about-techmedix__section-heading">
            <span>Intelligence layer</span>
            <h2>Agents, AI, and ML inside TechMedix</h2>
          </div>
          <div className="about-techmedix__stacked">
            {intelligenceBlocks.map((block) => {
              const Icon = block.icon;
              return (
                <article key={block.title} className="about-techmedix__feature">
                  <div className="about-techmedix__feature-head">
                    <div className="about-techmedix__icon">
                      <Icon size={22} />
                    </div>
                    <div>
                      <h3>{block.title}</h3>
                      <p>{block.description}</p>
                    </div>
                  </div>
                  <ul className="about-techmedix__list">
                    {block.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        <section className="about-techmedix__section">
          <div className="about-techmedix__split">
            <div className="about-techmedix__panel">
              <div className="about-techmedix__section-heading">
                <span>Non-technical view</span>
                <h2>What this means in plain language</h2>
              </div>
              <ul className="about-techmedix__list">
                {nonTechnicalNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>

            <div className="about-techmedix__panel">
              <div className="about-techmedix__section-heading">
                <span>Trust and operations</span>
                <h2>Why the architecture is practical</h2>
              </div>
              <div className="about-techmedix__stacked">
                {trustNotes.map((item) => {
                  const Icon = item.icon;
                  return (
                    <article key={item.title} className="about-techmedix__mini-card">
                      <div className="about-techmedix__icon">
                        <Icon size={20} />
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
          </div>
        </section>
      </main>
    </div>
  );
};

export default AboutTechMedix;
