import { db } from './firebase.js';
import { getStudentDb } from './studentFirebase.js';

let useStudent = false;

export function setStudentFirestoreActive(active) {
  useStudent = Boolean(active);
}

export function appDb() {
  return useStudent ? getStudentDb() : db;
}
