import React from 'react';
import { cn } from './utils';

export function Label({ className, ...props }) {
  return <label className={cn('text-sm font-medium', className)} {...props} />;
}
