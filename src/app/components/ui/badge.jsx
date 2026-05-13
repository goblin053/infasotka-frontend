import React from 'react';
import { cn } from './utils';

export function Badge({ className, ...props }) {
  return <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs', className)} {...props} />;
}
