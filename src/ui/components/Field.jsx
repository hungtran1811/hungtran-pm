import { cloneElement, isValidElement, useId } from 'react';

export function Field({ label, hint, error, required, children, id: idProp, className }) {
  const autoId = useId();
  const fieldId = idProp || autoId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        ...children.props,
        id: children.props.id || fieldId,
        'aria-invalid': error ? true : children.props['aria-invalid'],
        'aria-describedby': describedBy,
      })
    : children;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={fieldId} className="label-base">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {control}
      {hint && !error && (
        <span id={hintId} className="mt-1 block text-xs text-slate-500">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="mt-1 block text-xs font-medium text-red-500" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function Input(props) {
  return <input {...props} className={`input-base ${props.className || ''}`} />;
}

export function Textarea(props) {
  return <textarea {...props} className={`input-base min-h-24 resize-y ${props.className || ''}`} />;
}

export function Select({ children, ...props }) {
  return (
    <select {...props} className={`input-base ${props.className || ''}`}>
      {children}
    </select>
  );
}
