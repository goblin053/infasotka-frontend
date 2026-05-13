import React from 'react';

export function Select({ children, ...props }) {
  return <select {...props}>{children}</select>;
}
