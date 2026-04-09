import React from 'react';
import { cn } from '../utils/cn.js';

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className, children }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}
