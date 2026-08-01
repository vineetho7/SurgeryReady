import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef, type JSX, type ReactNode } from 'react';
import { Link } from 'react-router';
import './LandingPage.css';

function Mark(): JSX.Element {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m7.5 12.4 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Arrow(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LandingButton({ children, secondary = false }: { children: ReactNode; secondary?: boolean }): JSX.Element {
  if (secondary) {
    return <a className="landing-button secondary" href="#how-it-works">{children}</a>;
  }
  return (
    <Link className="landing-button" to="/dashboard">
      {children}
      <Arrow />
    </Link>
  );
}

function InsoleVisual(): JSX.Element {
  const reduceMotion = useReducedMotion();
  const zones = [
    { cx: 63, cy: 58, rx: 15, ry: 18, label: 'Hallux' },
    { cx: 66, cy: 111, rx: 18, ry: 16, label: 'Medial forefoot' },
    { cx: 105, cy: 118, rx: 17, ry: 15, label: 'Lateral forefoot' },
    { cx: 100, cy: 181, rx: 15, ry: 28, label: 'Midfoot' },
    { cx: 77, cy: 251, rx: 25, ry: 30, label: 'Heel' },
  ];
  return (
    <motion.div
      className="insole-visual"
      aria-label="Smart insole with five sensing regions"
      initial={reduceMotion ? false : { opacity: 0, y: 48, rotateX: -12 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: [0, -10, 0], rotateX: 0, rotateZ: [-0.6, 0.6, -0.6] }}
      whileHover={reduceMotion ? undefined : { scale: 1.025, rotateZ: 0 }}
      transition={{ opacity: { duration: 0.7 }, rotateX: { duration: 0.8 }, y: { duration: 7, repeat: Infinity, ease: 'easeInOut' }, rotateZ: { duration: 9, repeat: Infinity, ease: 'easeInOut' } }}
    >
      <span className="visual-kicker">Live pressure signal</span>
      <svg viewBox="0 0 170 320" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="sole" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#202326" />
            <stop offset="1" stopColor="#111315" />
          </linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="5" /></filter>
        </defs>
        <path d="M78 12c35 0 57 27 54 68-2 31-15 48-18 71-4 24 4 41 5 61 3 38-14 91-43 91-28 0-45-53-42-91 2-20 9-37 5-61-4-23-16-40-18-71C18 39 43 12 78 12Z" fill="url(#sole)" stroke="#34383b" strokeWidth="2" />
        {[87, 104, 120, 132].map((cx, i) => <circle key={cx} cx={cx} cy={37 + i * 9} r={8 - i} fill="#191c1f" stroke="#34383b" />)}
        {zones.map((zone, index) => (
          <g key={zone.label}>
            <motion.ellipse
              cx={zone.cx} cy={zone.cy} rx={zone.rx} ry={zone.ry}
              fill={index === 2 ? '#efb65f' : index === 3 ? '#82c4ae' : '#f28c68'}
              opacity=".24" filter="url(#glow)"
              animate={reduceMotion ? undefined : { opacity: [.12, .38, .12], scale: [1, 1.08, 1] }}
              transition={{ duration: 2.8, repeat: Infinity, delay: index * .35, ease: 'easeInOut' }}
              style={{ transformOrigin: `${zone.cx}px ${zone.cy}px` }}
            />
            <motion.ellipse
              cx={zone.cx} cy={zone.cy} rx={zone.rx} ry={zone.ry}
              fill={index === 2 ? '#efb65f' : index === 3 ? '#82c4ae' : '#f28c68'}
              opacity=".78" stroke="#ffe0d5" strokeWidth="1"
              animate={reduceMotion ? undefined : { opacity: [.62, .92, .62] }}
              transition={{ duration: 2.8, repeat: Infinity, delay: index * .35, ease: 'easeInOut' }}
            />
          </g>
        ))}
      </svg>
      <div className="sensor-note"><span /> Continuous readings</div>
    </motion.div>
  );
}

function ProductShowcase(): JSX.Element {
  const stageRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: stageRef, offset: ['start end', 'end start'] });
  const leftY = useTransform(scrollYProgress, [0, 1], [60, -55]);
  const rightY = useTransform(scrollYProgress, [0, 1], [90, -35]);
  const insoleY = useTransform(scrollYProgress, [0, 1], [24, -24]);

  return (
    <div className="hero-product" ref={stageRef}>
      <div className="product-aura" aria-hidden="true" />
      <motion.figure
        className="product-screen screen-board"
        style={{ y: reduceMotion ? 0 : leftY, rotateY: 8, rotateZ: -1.5 }}
        initial={reduceMotion ? false : { opacity: 0, x: -70, rotateY: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: .9, ease: [0.16, 1, 0.3, 1] }}
      >
        <img src="/showcase/dashboard-board.png" alt="CareOrbit dashboard showing perioperative exceptions" />
        <figcaption>Today’s board <span>Exceptions first</span></figcaption>
      </motion.figure>
      <motion.div className="insole-stage" style={{ y: reduceMotion ? 0 : insoleY }}>
        <InsoleVisual />
        <div className="insole-caption"><span>01</span><strong>Measure every step</strong><small>Five plantar zones · continuous signal</small></div>
      </motion.div>
      <motion.figure
        className="product-screen screen-detail"
        style={{ y: reduceMotion ? 0 : rightY, rotateY: -8, rotateZ: 1.5 }}
        initial={reduceMotion ? false : { opacity: 0, x: 70, rotateY: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: .9, delay: .12, ease: [0.16, 1, 0.3, 1] }}
      >
        <img src="/showcase/dashboard-detail.png" alt="CareOrbit recovery detail with pressure map and trend" />
        <figcaption>Recovery detail <span>Signal into context</span></figcaption>
      </motion.figure>
      <div className="signal-path path-left" aria-hidden="true"><i /></div>
      <div className="signal-path path-right" aria-hidden="true"><i /></div>
      <div className="product-label label-sense"><span /> Sense</div>
      <div className="product-label label-understand"><span /> Understand</div>
      <div className="product-label label-act"><span /> Act</div>
      <div className="mobile-screen-strip">
        <img src="/showcase/dashboard-recovery.png" alt="CareOrbit recovery list" />
        <img src="/showcase/dashboard-detail.png" alt="CareOrbit patient recovery detail" />
      </div>
      <div className="showcase-note">
        <span className="live-dot" />
        <span>Real CareOrbit interface</span>
        <small>Synthetic demonstration data</small>
      </div>
    </div>
  );
}

const steps = [
  ['Measure', 'Smart-insole sensors continuously measure pressure across five regions of the foot.'],
  ['Understand', 'Loading is compared with clinician-defined limits, patient history and the expected recovery trajectory.'],
  ['Guide', 'Patients receive precise feedback to help them follow their prescribed recovery plan.'],
  ['Connect', 'Care teams receive concise reports and alerts, supported by context collected through a voice agent.'],
];

const patientBenefits = [
  'More precise, personalized recovery feedback',
  'Greater confidence between appointments',
  'Earlier awareness of excessive or insufficient loading',
  'Voice-based support without interpreting complex graphs',
];

const clinicianBenefits = [
  'Continuous visibility into recovery trends',
  'Exception-based alerts instead of raw sensor streams',
  'Objective data paired with patient-reported symptoms',
  'Earlier identification of patients who may need review',
];

export function LandingPage(): JSX.Element {
  return (
    <div className="landing">
      <header className="landing-nav">
        <a className="landing-brand" href="#top"><Mark /><span>CareOrbit</span></a>
        <nav aria-label="Landing page navigation">
          <a href="#problem">The Problem</a><a href="#how-it-works">How It Works</a><a href="#benefits">Benefits</a><a href="#technology">Technology</a>
        </nav>
        <Link className="nav-dashboard" to="/dashboard">Open Dashboard <Arrow /></Link>
      </header>

      <main id="top">
        <section className="landing-hero landing-wrap">
          <div className="hero-copy">
            <div className="eyebrow"><span /> Connecting Every Stage of Care Through Data</div>
            <h1>Every Step Is Part of Recovery. <em>Make Every Step Count.</em></h1>
            <p>CareOrbit turns continuous smart-insole pressure data into precise, personalized recovery feedback for patients and actionable insights for care teams.</p>
            <div className="hero-actions"><LandingButton>Open Dashboard</LandingButton><LandingButton secondary>See How It Works</LandingButton></div>
            <div className="hero-proof"><span><b>5</b> pressure regions</span><span><b>24h</b> recovery reports</span><span><b>FHIR</b> structured data</span></div>
          </div>
          <ProductShowcase />
        </section>

        <section className="problem-section" id="problem">
          <div className="landing-wrap problem-grid">
            <div><div className="section-label">The problem</div><h2>Recovery Happens<br />Between Appointments</h2></div>
            <div className="problem-copy">
              <p>Patients recovering from lower-limb surgery often rely on instructions given during occasional clinical visits, leaving them unsure whether they are placing the right amount of pressure on the healing limb.</p>
              <div className="big-stat"><strong>27.5%</strong><span>of patients in one study did not follow postoperative non-weight-bearing restrictions despite explicit instructions and education.</span></div>
              <p>Without continuous monitoring and precise feedback, patients may unknowingly overload the limb or progress too slowly, making it harder to follow the prescribed recovery plan.</p>
            </div>
          </div>
        </section>

        <section className="landing-section landing-wrap" id="how-it-works">
          <div className="section-intro"><div className="section-label">How it works</div><h2>From every step to the right next step.</h2><p>Continuous measurements become focused guidance—without asking care teams to watch another stream of raw data.</p></div>
          <div className="steps-grid">{steps.map(([title, copy], i) => <article key={title}><span>0{i + 1}</span><div className="step-icon">{['⌁', '◎', '↗', '◇'][i]}</div><h3>{title}</h3><p>{copy}</p></article>)}</div>
        </section>

        <section className="benefits-section" id="benefits">
          <div className="landing-wrap">
            <div className="section-intro"><div className="section-label">Designed for both sides of care</div><h2>Clearer guidance. Earlier visibility.</h2></div>
            <div className="benefits-grid">
              <article><div className="benefit-title"><span className="person-icon">P</span><div><small>For</small><h3>Patients</h3></div></div><ul>{patientBenefits.map(x => <li key={x}><Mark />{x}</li>)}</ul></article>
              <article><div className="benefit-title"><span className="person-icon clinician">+</span><div><small>For</small><h3>Care teams</h3></div></div><ul>{clinicianBenefits.map(x => <li key={x}><Mark />{x}</li>)}</ul></article>
            </div>
          </div>
        </section>

        <section className="difference landing-wrap">
          <div className="section-label">What makes it different</div>
          <blockquote>“We are not building another pressure-sensing insole. We are building the intelligence and communication layer that makes insole data clinically actionable.”</blockquote>
          <p>Existing sensors capture pressure. CareOrbit turns those readings into recovery trends, patient feedback, voice-assisted context and concise clinician reports—while keeping treatment decisions with the care team.</p>
        </section>

        <section className="technology-section" id="technology">
          <div className="landing-wrap">
            <div className="section-intro"><div className="section-label">Technology</div><h2>A connected recovery loop.</h2></div>
            <div className="architecture" aria-label="Smart Insole to patient and clinician architecture">
              {['Smart Insole', 'Bluetooth', 'Recovery Analytics', 'Medplum', 'moss.dev', 'Deepgram', 'Patient + Clinician'].map((x, i) => <div key={x}><span>{i + 1}</span>{x}</div>)}
            </div>
            <div className="tech-grid">
              <article><strong>Smart Insole</strong><p>Captures pressure across five foot regions.</p></article>
              <article><strong>Medplum</strong><p>Stores structured recovery reports using FHIR.</p></article>
              <article><strong>moss.dev</strong><p>Retrieves relevant procedure and recovery context.</p></article>
              <article><strong>Deepgram</strong><p>Powers voice conversations with patients and clinicians.</p></article>
            </div>
          </div>
        </section>

        <section className="evidence landing-wrap">
          <div className="section-intro"><div className="section-label">Research context</div><h2>Why feedback matters.</h2></div>
          <div className="evidence-grid">
            <a href="https://pubmed.ncbi.nlm.nih.gov/27655984/" target="_blank" rel="noreferrer"><strong>27.5%</strong><p>did not follow postoperative non-weight-bearing restrictions in a 51-patient study.</p><span>View study ↗</span></a>
            <a href="https://link.springer.com/article/10.1007/s00264-023-05783-0" target="_blank" rel="noreferrer"><strong>0% → 2%</strong><p>met a prescribed loading limit at two measurements in one postoperative knee study.</p><span>View study ↗</span></a>
            <a href="https://ijspt.scholasticahq.com/article/129259-the-impact-of-real-time-biofeedback-on-partial-weightbearing-training-a-comparative-study" target="_blank" rel="noreferrer"><strong>88% vs 19%</strong><p>compliance after real-time biofeedback versus conventional training in healthy participants.</p><span>View study ↗</span></a>
          </div>
          <p className="disclaimer">Research findings are study-specific. Outcomes and weight-bearing protocols vary by patient and procedure. CareOrbit demonstration data is synthetic and does not diagnose healing or independently change treatment.</p>
        </section>

        <section className="final-cta"><div className="landing-wrap"><div className="cta-mark"><Mark /></div><h2>Keep Recovery on Track—<br />One Step at a Time.</h2><p>Give patients the feedback they need between appointments and give care teams the visibility they need to act earlier.</p><LandingButton>Open CareOrbit Dashboard</LandingButton></div></section>
      </main>

      <footer className="landing-footer landing-wrap"><div className="landing-brand"><Mark /><span>CareOrbit</span></div><span>Connecting Every Stage of Care Through Data</span><Link to="/dashboard">Demo dashboard →</Link></footer>
    </div>
  );
}
