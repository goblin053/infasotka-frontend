import React from 'react';
import { cn } from './utils';

export function ScrollArea({ className, ...props }) {
  return <div className={cn('max-h-80 overflow-auto', className)} {...props} />;
}
