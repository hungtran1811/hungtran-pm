export function isArchivedClassStatus(status) {
  return status === 'completed' || status === 'archived';
}

export function isOperationalClassStatus(status) {
  return status === 'active' || status === 'completed';
}
