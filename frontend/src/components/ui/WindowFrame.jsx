export default function WindowFrame({ title, badge, children, contentClassName = '' }) {
  return (
    <section className="bg-white/85 backdrop-blur-sm rounded-xl border border-black/8 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/6">
        <span className="text-xs font-semibold text-[#605E5C] uppercase tracking-wider">{title}</span>
        {badge ? (
          <span className="text-xs font-semibold bg-[#0078D4] text-white px-2 py-0.5 rounded-full">
            {badge}
          </span>
        ) : null}
      </div>
      <div className={`p-4 ${contentClassName}`.trim()}>{children}</div>
    </section>
  );
}
