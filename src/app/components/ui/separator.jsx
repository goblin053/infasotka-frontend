import React from 'react';
import { cn } from './utils';

export function Separator({ className }) {
  return <hr className={cn('my-3 border-t', className)} />;
}
