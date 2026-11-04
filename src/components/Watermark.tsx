export function Watermark({ className = '' }: { className?: string }) {
  return (
    <div className={`text-center ${className}`}>
      <p className="text-[10px] text-neutral-400 dark:text-neutral-600 font-medium leading-relaxed">
        Powered by
      </p>
      <p className="text-[10px] text-neutral-500 dark:text-neutral-500 font-semibold leading-relaxed">
        Shehab Ossoly
      </p>
      <p className="text-[10px] text-neutral-500 dark:text-neutral-500 font-semibold leading-relaxed">
        A'laa Mohamed
      </p>
    </div>
  );
}
