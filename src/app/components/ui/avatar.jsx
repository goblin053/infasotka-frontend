import React from 'react';
import { cn } from './utils';

export function Avatar({ className, children, ...props }) {
  return <div className={cn('inline-flex h-10 w-10 items-center justify-center rounded-full border bg-gray-100', className)} {...props}>{children}</div>;
}

export function AvatarFallback({ className, children, ...props }) {
  return <span className={cn('text-xs font-semibold', className)} {...props}>{children}</span>;
}
