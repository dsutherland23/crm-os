import React, { useState, useEffect, useMemo } from 'react';
import { cn } from "@/lib/utils";

// Internal component for a single digit.
const FlipUnit = ({
  digit,
  cardStyle,
}: {
  digit: string;
  cardStyle: React.CSSProperties;
}) => {
  const [currentDigit, setCurrentDigit] = useState(digit);
  const [previousDigit, setPreviousDigit] = useState(digit);
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    if (digit !== currentDigit) {
      setPreviousDigit(currentDigit);
      setCurrentDigit(digit);
      setIsFlipping(true);
    }
  }, [digit, currentDigit]);

  const handleAnimationEnd = () => {
    setIsFlipping(false);
    setPreviousDigit(digit);
  };

  return (
    <div className="flip-unit" style={cardStyle}>
      <div className="flip-card flip-card__bottom">{currentDigit}</div>
      <div className="flip-card flip-card__top">{previousDigit}</div>
      <div
        className={cn('flipper', isFlipping && 'is-flipping')}
        onAnimationEnd={handleAnimationEnd}
      >
        <div className="flip-card flipper__top">{previousDigit}</div>
        <div className="flip-card flipper__bottom">{currentDigit}</div>
      </div>
    </div>
  );
};

// Main exported component, customized for a small "visitor counter" style
export const FlipCountdown = ({
  count = 0n,
  className,
  cardBgColor = '#18181b', // Default zinc-900
  textColor = '#ffffff',
  minDigits = 5,
}: {
  count?: number | string | bigint;
  className?: string;
  cardBgColor?: string;
  textColor?: string;
  minDigits?: number;
}) => {
  const displayValue = useMemo(() => {
    const val = BigInt(count);
    return String(val < 0n ? 0n : val).padStart(minDigits, '0');
  }, [count, minDigits]);

  const cardStyle: React.CSSProperties = {
    '--flip-card-bg': cardBgColor,
    '--flip-card-text': textColor,
  } as React.CSSProperties;

  return (
    <div className={cn('flip-countdown-container', className)}>
      {displayValue.split('').map((digit, index) => (
        <FlipUnit key={index} digit={digit} cardStyle={cardStyle} />
      ))}
    </div>
  );
};
