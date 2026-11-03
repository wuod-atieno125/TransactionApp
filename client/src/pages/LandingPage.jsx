import { ArrowRight, CalendarDays, Check, CircleDollarSign, ShieldCheck, UsersRound } from 'lucide-react'
import './landing.css'

const highlights = [
  { icon: CircleDollarSign, title: 'Track every contribution', text: 'Keep group income, expenses, and balances clear and easy to follow.' },
  { icon: UsersRound, title: 'Bring members together', text: 'Manage member records and access in one organized place.' },
  { icon: CalendarDays, title: 'Keep plans on track', text: 'Share meeting dates, minutes, and decisions with your group.' },
]

function Brand() {
  return <a className="landing-brand" href="#top" aria-label="pamoja home"><span className="landing-brand-icon"><UsersRound size={20} /></span><span>Pamoja<span>.</span></span></a>
}

function DashboardPreview() {
  return (
    <div className="landing-preview-wrap" aria-label="pamoja dashboard preview">
      <div className="landing-preview-glow" />
      <section className="landing-preview">
        <div className="preview-heading"><div><span className="preview-label">YOUR GROUP</span><h2>Good morning, Alex</h2></div><span className="preview-avatar">A</span></div>
        <div className="preview-balance"><span>Available balance</span><strong>KES 248,500</strong><small><span>↗</span> 12.8% <i>this month</i></small></div>
        <div className="preview-chart" aria-label="Group balance chart">
          <div className="chart-y-labels"><span>250k</span><span>200k</span><span>150k</span><span>100k</span></div>
          <svg viewBox="0 0 420 142" preserveAspectRatio="none" role="img" aria-label="Balance trending upward">
            <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2451dc" stopOpacity=".2"/><stop offset="100%" stopColor="#2451dc" stopOpacity="0"/></linearGradient></defs>
            <path className="preview-chart-fill" d="M0 112 C35 105 45 78 82 87 S132 97 166 68 S220 74 251 55 S302 69 336 38 S385 34 420 12 V142 H0Z" />
            <path className="preview-chart-line" d="M0 112 C35 105 45 78 82 87 S132 97 166 68 S220 74 251 55 S302 69 336 38 S385 34 420 12" />
            <circle cx="420" cy="12" r="5" />
          </svg>
          <div className="chart-x-labels"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span></div>
        </div>
        <div className="preview-activity"><span className="activity-icon"><Check size={16} /></span><span><b>Monthly contribution received</b><small>Today at 9:42 am</small></span><strong>+ KES 5,000</strong></div>
      </section>
      <div className="preview-note"><span><ShieldCheck size={18} /></span><div><b>Your group, in sync</b><small>Updates shared in one place</small></div></div>
    </div>
  )
}

export default function LandingPage({ onLogin, onRegister, notice }) {
  const go = (event, action) => { event.preventDefault(); action?.() }

  return (
    <main className="landing-page" id="top">
      {notice && <p className="landing-status app-feedback-toast" role="status">{notice}</p>}
      <header className="landing-header"><Brand /><nav aria-label="Main navigation"><a href="#features">Features</a><a href="#how-it-works">How it works</a></nav><div className="landing-header-actions"><button className="landing-login" onClick={onLogin}>Log in</button><button className="landing-signup" onClick={onRegister}>Get started <ArrowRight size={16} /></button></div></header>

      <section className="landing-hero">
        <div className="landing-hero-copy"><span className="landing-eyebrow"><span /> A clearer way to manage your group</span><h1>Good things happen when everyone’s <em>in sync.</em></h1><p>Bring your group’s money, members, and meetings together. Less time chasing updates. More time moving forward.</p><div className="landing-hero-actions"><a className="landing-primary" href="#create-account" onClick={event => go(event, onRegister)}>Create your account <ArrowRight size={17} /></a><button className="landing-secondary" onClick={onLogin}>Member sign in</button></div><div className="landing-reassurance"><span><Check size={14} /></span>Simple to use <i /> Made for groups <i /> Clear for everyone</div></div>
        <DashboardPreview />
      </section>

      <section className="landing-feature-section" id="features"><div className="landing-section-heading"><span className="landing-eyebrow">EVERYTHING IN ONE PLACE</span><h2>Your group’s work,<br /><em>working together.</em></h2><p>Practical tools that make everyday group life easier to manage.</p></div><div className="landing-feature-grid">{highlights.map(({ icon: Icon, title, text }, index) => <article className="landing-feature" key={title}><span className="landing-feature-number">0{index + 1}</span><span className="landing-feature-icon"><Icon size={21} /></span><h3>{title}</h3><p>{text}</p><div className="landing-feature-decoration" aria-hidden="true"><i /><i /><i /><i /><i /></div></article>)}</div></section>

      <section className="landing-steps" id="how-it-works"><div><span className="landing-eyebrow">GET STARTED</span><h2>Simple from<br />the <em>first step.</em></h2><p>Everything you need to get your group organized and moving forward.</p><a href="#create-account" onClick={event => go(event, onRegister)}>Join your group <ArrowRight size={16} /></a></div><ol><li><span>01</span><div><h3>Create an account</h3><p>Sign up with your details and request to join your group.</p></div></li><li><span>02</span><div><h3>Get connected</h3><p>Once approved, your group’s tools are ready when you are.</p></div></li><li><span>03</span><div><h3>Stay in the loop</h3><p>Follow contributions, meetings, and important updates together.</p></div></li></ol></section>

      <section className="landing-cta" id="create-account"><div className="landing-cta-icon"><UsersRound size={24} /></div><div><span>READY WHEN YOU ARE</span><h2>Let’s bring your group together.</h2><p>Create your account and take the first step.</p></div><a href="#create-account" onClick={event => go(event, onRegister)}>Get started <ArrowRight size={17} /></a></section>
      <footer className="landing-footer"><Brand /><span>Thoughtful tools for groups moving forward.</span><button onClick={onLogin}>Member sign in</button><small>© 2026 Pamoja</small></footer>
    </main>
  )
}
