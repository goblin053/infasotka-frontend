import React from 'react';
import { cn } from './utils';

export function Textarea({ className, ...props }) {
  return <textarea className={cn('w-full rounded-md border px-3 py-2 text-sm', className)} {...props} />;
}
