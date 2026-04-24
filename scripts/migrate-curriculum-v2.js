import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { toCurriculumProgramModelFromData } from '../src/models/curriculum-program.model.js';

function getProjectId() {
  return process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'hungtran-pm';
}

function loadServiceAccountCredential() {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    return cert(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')));
  }

  return null;
}

function getFirebaseToolsConfigPath() {
  return path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
}

async function getFirebaseCliAccessToken() {
  const configPath = getFirebaseToolsConfigPath();

  if (!fs.existsSync(configPath)) {
    throw new Error('Không tìm thấy firebase-tools.json để lấy access token từ Firebase CLI.');
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const tokens = config?.tokens || {};

  if (tokens.access_token && Number(tokens.expires_at || 0) > Date.now() + 60_000) {
    return tokens.access_token;
  }

  throw new Error(
    'Access token từ Firebase CLI đã hết hạn. Hãy chạy lại một lệnh Firebase CLI để làm mới phiên đăng nhập rồi migrate lại.',
  );
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => toFirestoreValue(item)),
      },
    };
  }

  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }

  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }

  if (typeof value === 'string') {
    return { stringValue: value };
  }

  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, nestedValue]) => [key, toFirestoreValue(nestedValue)]),
        ),
      },
    };
  }

  return { stringValue: String(value) };
}

function toFirestoreDocumentFields(payload) {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, toFirestoreValue(value)]),
  );
}

function fromFirestoreValue(value) {
  if (!value) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(value, 'nullValue')) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) {
    return value.stringValue;
  }

  if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) {
    return value.booleanValue;
  }

  if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) {
    return Number(value.integerValue);
  }

  if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) {
    return Number(value.doubleValue);
  }

  if (value.arrayValue) {
    return (value.arrayValue.values || []).map((item) => fromFirestoreValue(item));
  }

  if (value.mapValue) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([key, nestedValue]) => [
        key,
        fromFirestoreValue(nestedValue),
      ]),
    );
  }

  return null;
}

function buildPayload(programId, rawData) {
  const program = toCurriculumProgramModelFromData(programId, rawData);

  return {
    name: program.name,
    subject: program.subject,
    level: program.level,
    knowledgePhaseEndSession: program.knowledgePhaseEndSession,
    totalSessionCount: program.totalSessionCount,
    finalMode: program.finalMode,
    description: program.description,
    active: program.active,
    lessons: program.lessons,
    finalChecklist: program.finalChecklist,
  };
}

async function migrateWithAdminSdk() {
  const credential = loadServiceAccountCredential();

  if (!credential) {
    throw new Error('NO_SERVICE_ACCOUNT');
  }

  initializeApp({ credential });
  const db = getFirestore();
  const snapshot = await db.collection('curriculumPrograms').get();
  const batch = db.batch();

  snapshot.docs.forEach((docSnapshot) => {
    const payload = buildPayload(docSnapshot.id, docSnapshot.data());
    batch.set(docSnapshot.ref, payload, { merge: true });
  });

  await batch.commit();
  return snapshot.size;
}

async function fetchCurriculumProgramsViaRest() {
  const accessToken = await getFirebaseCliAccessToken();
  const projectId = getProjectId();
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/curriculumPrograms?pageSize=100`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Không thể tải curriculumPrograms qua REST (${response.status}): ${errorText}`);
  }

  const payload = await response.json();
  return payload.documents || [];
}

async function migrateWithFirestoreRest() {
  const accessToken = await getFirebaseCliAccessToken();
  const projectId = getProjectId();
  const documents = await fetchCurriculumProgramsViaRest();
  const writes = documents.map((document) => {
    const programId = document.name.split('/').pop();
    const rawData = Object.fromEntries(
      Object.entries(document.fields || {}).map(([key, value]) => [key, fromFirestoreValue(value)]),
    );

    return {
      update: {
        name: document.name,
        fields: toFirestoreDocumentFields(buildPayload(programId, rawData)),
      },
    };
  });

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ writes }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Migrate curriculum v2 qua REST thất bại (${response.status}): ${errorText}`);
  }

  return documents.length;
}

async function migrateCurriculumPrograms() {
  try {
    const count = await migrateWithAdminSdk();
    console.log(`Migrated ${count} curriculum programs via Admin SDK.`);
    return;
  } catch (error) {
    if (error.message !== 'NO_SERVICE_ACCOUNT') {
      throw error;
    }
  }

  const count = await migrateWithFirestoreRest();
  console.log(`Migrated ${count} curriculum programs via Firestore REST.`);
}

try {
  await migrateCurriculumPrograms();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
