import { animate, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  format?: (value: number) => string;
  className?: string;
}

/**
 * Counts up to `value` once the element is on screen, then tweens between
 * subsequent values from wherever it currently sits — so a slider does not
 * make the number snap back to zero on every drag step.
 */
export function AnimatedCounter({
  value,
  duration = 1.1,
  prefix = "",
  suffix = "",
  format,
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(value);
  const current = useRef(value);
  const started = useRef(false);

  useEffect(() => {
    if (!inView) return;
    // First reveal counts up from zero; later changes tween from the last value.
    const from = started.current ? current.current : 0;
    started.current = true;
    const controls = animate(from, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        current.current = latest;
        setDisplay(latest);
      },
    });
    return () => controls.stop();
  }, [inView, value, duration]);

  const shown = format ? format(display) : Math.round(display).toLocaleString("en-GB");

  return (
    <span ref={ref} className={className}>
      {prefix}
      {shown}
      {suffix}
    </span>
  );
}
