'use client';

import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

const FIELD_CLASSES =
  'w-full rounded-btn border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-muted outline-none transition focus:border-gold disabled:opacity-50';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, id, className = '', ...props },
  ref,
) {
  const field = (
    <input ref={ref} id={id} className={`${FIELD_CLASSES} ${className}`} {...props} />
  );
  if (!label) return field;
  return (
    <label className="block text-sm" htmlFor={id}>
      <span className="mb-1.5 block text-muted">{label}</span>
      {field}
    </label>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, id, className = '', ...props },
  ref,
) {
  const field = (
    <textarea ref={ref} id={id} className={`${FIELD_CLASSES} ${className}`} {...props} />
  );
  if (!label) return field;
  return (
    <label className="block text-sm" htmlFor={id}>
      <span className="mb-1.5 block text-muted">{label}</span>
      {field}
    </label>
  );
});
