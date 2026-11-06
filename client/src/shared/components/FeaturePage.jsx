import '../styles/feature-pages.css'

export default function FeaturePage({
  title,
  description,
  actions,
  className = '',
  children,
}) {
  return (
    <section className={`feature-page${className ? ` ${className}` : ''}`}>
      <header className="feature-page__header">
        <div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>

        {actions && (
          <div className="feature-page__actions">
            {actions}
          </div>
        )}
      </header>

      {children}
    </section>
  )
}
