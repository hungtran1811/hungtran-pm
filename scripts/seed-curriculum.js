import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEMO_CURRICULUM_PROGRAMS,
  DEMO_FINAL_CHECKLIST_BY_PROGRAM,
  DEMO_LESSONS_BY_PROGRAM,
} from '../src/demo/curriculum-demo.data.js';
import { getProjectStageChecklist } from '../src/demo/project-stage-guide.js';

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
    'Access token từ Firebase CLI đã hết hạn. Hãy chạy lại một lệnh Firebase CLI để làm mới phiên đăng nhập rồi seed lại.',
  );
}

function buildProgramPayload(program) {
  return {
    ...program,
    active: true,
    lessons: DEMO_LESSONS_BY_PROGRAM[program.id] || [],
    finalChecklist:
      program.finalMode === 'project'
        ? getProjectStageChecklist(program.id)
        : DEMO_FINAL_CHECKLIST_BY_PROGRAM[program.id] || [],
  };
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

async function seedWithAdminSdk() {
  const credential = loadServiceAccountCredential();

  if (!credential) {
    throw new Error('NO_SERVICE_ACCOUNT');
  }

  initializeApp({ credential });
  const db = getFirestore();
  const batch = db.batch();

  DEMO_CURRICULUM_PROGRAMS.forEach((program) => {
    const programRef = db.collection('curriculumPrograms').doc(program.id);
    batch.set(programRef, buildProgramPayload(program), { merge: true });
  });

  await batch.commit();
}

async function seedWithFirestoreRest() {
  const accessToken = await getFirebaseCliAccessToken();
  const projectId = getProjectId();
  const writes = DEMO_CURRICULUM_PROGRAMS.map((program) => ({
    update: {
      name: `projects/${projectId}/databases/(default)/documents/curriculumPrograms/${program.id}`,
      fields: toFirestoreDocumentFields(buildProgramPayload(program)),
    },
  }));

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
    throw new Error(`Seed curriculum qua REST thất bại (${response.status}): ${errorText}`);
  }
}

async function seedCurriculumPrograms() {
  try {
    await seedWithAdminSdk();
    console.log(`Seeded ${DEMO_CURRICULUM_PROGRAMS.length} curriculum programs via Admin SDK.`);
    return;
  } catch (error) {
    if (error.message !== 'NO_SERVICE_ACCOUNT') {
      throw error;
    }
  }

  await seedWithFirestoreRest();
  console.log(`Seeded ${DEMO_CURRICULUM_PROGRAMS.length} curriculum programs via Firestore REST.`);
}

try {
  await seedCurriculumPrograms();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
