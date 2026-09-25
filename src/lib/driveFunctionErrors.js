import { captureError } from './errorReporting.js';

export function isLocalFunctionsHint(error) {
  return typeof error?.message === 'string' && error.message.includes('dev:functions');
}

export function reportDriveFunctionError(error, context = {}) {
  if (!error || isLocalFunctionsHint(error)) return;
  captureError(error, context).catch(() => {});
}
