import React from 'react';
import { cn } from './utils';

export function Button({ className, type = 'button', ...props }) {
  return <button type={type} className={cn('inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm', className)} {...props} />;
}
