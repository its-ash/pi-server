export default function BevelButton({
  children,
  className = '',
  tone = 'default',
  active = false,
  ...props
}) {
  const toneClass = tone === 'blue' || tone === 'green' || tone === 'red' ? tone : '';
  const activeClass = active ? 'is-active' : '';

  return (
    <button className={`btn-95 ${toneClass} ${activeClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
