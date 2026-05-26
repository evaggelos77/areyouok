import React, { useRef, useState } from 'react';
import clsx from 'clsx';

export default function Orb({
  title,
  subtitle,
  onPress,
  onLongPress,
  disabled
}: {
  title: string;
  subtitle: string;
  onPress: () => Promise<void> | void;
  onLongPress: () => void;
  disabled?: boolean;
}) {
  const timeoutRef = useRef<number | null>(null);
  const longRef = useRef(false);
  const [sparkle, setSparkle] = useState(false);

  const clear = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  const start = () => {
    if (disabled) return;
    longRef.current = false;
    clear();
    timeoutRef.current = window.setTimeout(() => {
      longRef.current = true;
      onLongPress();
    }, 520);
  };

  const end = async () => {
    if (disabled) return;
    const wasLong = longRef.current;
    clear();
    if (!wasLong) {
      try {
        await onPress();
        setSparkle(true);
        window.setTimeout(() => setSparkle(false), 650);
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="orb-wrap">
      <div
        className={clsx('orb', sparkle && 'sparkle')}
        onPointerDown={start}
        onPointerUp={end}
        onPointerCancel={clear}
        role="button"
        aria-label={title}
      >
        <div className="orb-ring" />
        <div className="orb-ring orb-ring-2" />
        <div className="orb-center glass">
          <div className="orb-title">{title}</div>
          <div className="orb-sub muted">{subtitle}</div>
        </div>
      </div>

      {sparkle ? (
        <>
          <span className="spark s1" />
          <span className="spark s2" />
          <span className="spark s3" />
          <span className="spark s4" />
        </>
      ) : null}
    </div>
  );
}
