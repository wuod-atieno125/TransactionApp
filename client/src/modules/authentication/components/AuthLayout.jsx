import { CalendarDays, Check, HandCoins, Sparkles } from 'lucide-react'

export default function AuthLayout({
  children,
  eyebrow,
  title,
  description,
  onHome,
  variant = 'default',
}) {
  function goHome(event) {
    event.preventDefault()
    onHome?.()
  }

  return (
    <main className={`auth-screen auth-screen--${variant}`}>
      <div className="auth-shell">
        <aside className="auth-visual">
          <a className="auth-story-brand" href="#home" onClick={goHome}>
            <span className="auth-story-mark">p</span>
            Pamoja<span>.</span>
          </a>

          <div className="auth-story-copy">
            <span className="auth-story-kicker">
              <Sparkles size={14} /> BETTER, TOGETHER
            </span>
            <h2>Make good things happen, <em>together.</em></h2>
            <p>
              A calmer way to bring your people, plans, and contributions into
              focus.
            </p>
          </div>

          <div className="auth-story-card" aria-hidden="true">
            <div className="auth-story-card-top">
              <span className="auth-story-card-icon"><HandCoins size={18} /></span>
              <span>
                <strong>Group contributions</strong>
                <small>One clear picture</small>
              </span>
              <span className="auth-story-live"><i /> In sync</span>
            </div>
            <div className="auth-story-progress"><span /></div>
            <div className="auth-story-card-bottom">
              <span className="auth-story-people"><i>A</i><i>B</i><i>C</i><b>Your community</b></span>
              <span className="auth-story-meeting"><CalendarDays size={14} /> Sunday, 10:30 am</span>
            </div>
          </div>

          <div className="auth-story-footer" aria-label="Group tools">
            <span><Check size={13} /> Contributions</span>
            <span><Check size={13} /> Members</span>
            <span><Check size={13} /> Meetings</span>
          </div>
        </aside>

        <section className="auth-card">
          <a className="auth-mobile-brand" href="#home" onClick={goHome}>
            <span className="auth-story-mark">g</span>
            pamoja<span>.</span>
          </a>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
        </section>
      </div>
    </main>
  )
}
