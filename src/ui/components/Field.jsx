export function Field({ label, hint, error, required, children }) {
  return (
    <label className="block">
      {label && (
        <span className="label-base">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-red-500">{error}</span>}
    </label>
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
