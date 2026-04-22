const TONE_STYLES = {
  blue: 'bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white border-transparent shadow-sm',
  green: 'bg-[#107C10] hover:bg-[#0B5E0B] active:bg-[#084008] text-white border-transparent shadow-sm',
  red: 'bg-[#C42B1C] hover:bg-[#A42118] active:bg-[#821410] text-white border-transparent shadow-sm',
  default: 'bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-800 border-black/15',
};

export default function BevelButton({
  children,
  className = '',
  tone = 'default',
  active = false,
  ...props
}) {
  const toneClass = TONE_STYLES[tone] ?? TONE_STYLES.default;
  const activeRing = active ? 'ring-2 ring-[#0078D4]/50 ring-offset-1' : '';

  return (
    <button
      className={`inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${toneClass} ${activeRing} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
