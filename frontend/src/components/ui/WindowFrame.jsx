export default function WindowFrame({ title, badge, children, contentClassName = '' }) {
  return (
    <section className="win95-window">
      <div className="win95-titlebar">
        <span>{title}</span>
        {badge ? <span className="tag-new pulse-badge">{badge}</span> : null}
      </div>
      <div className={`win95-content ${contentClassName}`.trim()}>{children}</div>
    </section>
  );
}
