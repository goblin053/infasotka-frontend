import React from 'react';
import { cn } from './utils';

export function Card({ className, ...props }) {
  return <div className={cn('rounded-lg border bg-white p-4', className)} {...props} />;
}
