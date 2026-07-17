import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const PROJECT_ID = 'demo-hungtran-pm-spy-rules';
const CLASS_CODE = 'PY101';
const SESSION_ID = 'spy-session-1';
const STUDENT_1 = 'student-1';
const STUDENT_2 = 'student-2';
const STUDENT_3 = 'student-3';
const ADMIN_EMAIL = 'admin@test.com';

let testEnv;

function serverTimestamp() {
  return firebase.firestore.FieldValue.serverTimestamp();
}

function publicDb() {
  return testEnv.unauthenticatedContext().firestore();
}

function adminDb() {
  return testEnv.authenticatedContext(ADMIN_EMAIL, { email: ADMIN_EMAIL }).firestore();
}

function spySessionBase(overrides = {}) {
  return {
    classCode: CLASS_CODE,
    status: 'lobby',
    presentStudentIds: [STUDENT_1, STUDENT_2, STUDENT_3],
    describeRoundTotal: 1,
    describeRoundCurrent: 1,
    describeOrder: [],
    describeIndex: 0,
    eliminatedIds: [],
    voteRound: 0,
    activePlayerIds: [],
    civilianWord: '',
    spyWord: '',
    stateVersion: 0,
    ...overrides,
  };
}

function participantJoin(studentId, studentName) {
  return {
    studentName,
    joinedAt: serverTimestamp(),
    assignedWord: '',
    isSpy: false,
    eliminated: false,
  };
}

async function seedBaseline() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      db.doc(`admins/${ADMIN_EMAIL}`).set({ active: true }),
      db.doc(`classes/${CLASS_CODE}`).set({
        classCode: CLASS_CODE,
        status: 'active',
        hidden: false,
        curriculumProgramId: 'python-basic',
        curriculumCurrentSession: 1,
        curriculumPhase: 'learning',
      }),
      db.doc(`students/${STUDENT_1}`).set({
        id: STUDENT_1,
        fullName: 'An Nguyen',
        classId: CLASS_CODE,
        active: true,
      }),
      db.doc(`students/${STUDENT_2}`).set({
        id: STUDENT_2,
        fullName: 'Binh Tran',
        classId: CLASS_CODE,
        active: true,
      }),
      db.doc(`students/${STUDENT_3}`).set({
        id: STUDENT_3,
        fullName: 'Chi Le',
        classId: CLASS_CODE,
        active: true,
      }),
      db.doc(`spySessions/${SESSION_ID}`).set(spySessionBase()),
    ]);
  });
}

async function seedVotePhase() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`spySessions/${SESSION_ID}`).set(spySessionBase({
      status: 'vote',
      voteRound: 1,
      activePlayerIds: [STUDENT_1, STUDENT_2, STUDENT_3],
    }));
    await Promise.all([
      db.doc(`spySessions/${SESSION_ID}/participants/${STUDENT_1}`).set({
        studentName: 'An Nguyen',
        joinedAt: serverTimestamp(),
        assignedWord: 'Pho',
        isSpy: false,
        eliminated: false,
      }),
      db.doc(`spySessions/${SESSION_ID}/participants/${STUDENT_2}`).set({
        studentName: 'Binh Tran',
        joinedAt: serverTimestamp(),
        assignedWord: 'Bun bo',
        isSpy: true,
        eliminated: false,
      }),
      db.doc(`spySessions/${SESSION_ID}/participants/${STUDENT_3}`).set({
        studentName: 'Chi Le',
        joinedAt: serverTimestamp(),
        assignedWord: 'Pho',
        isSpy: false,
        eliminated: true,
      }),
    ]);
  });
}

async function seedCrewPlayingPhase() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`spySessions/${SESSION_ID}`).set(spySessionBase({
      status: 'playing',
      mode: 'crew',
      activePlayerIds: [STUDENT_1, STUDENT_2, STUDENT_3],
      taskPerPlayer: 5,
      crewTaskTarget: 10,
      sabotageActive: false,
      sabotageById: '',
      reportedByIds: [],
      meetingOpenedBy: '',
      meetingReporterId: '',
    }));
    await Promise.all([
      db.doc(`spySessions/${SESSION_ID}/participants/${STUDENT_1}`).set({
        studentName: 'An Nguyen',
        joinedAt: serverTimestamp(),
        assignedWord: '',
        isSpy: false,
        eliminated: false,
      }),
      db.doc(`spySessions/${SESSION_ID}/participants/${STUDENT_2}`).set({
        studentName: 'Binh Tran',
        joinedAt: serverTimestamp(),
        assignedWord: '',
        isSpy: true,
        eliminated: false,
      }),
      db.doc(`spySessions/${SESSION_ID}/participants/${STUDENT_3}`).set({
        studentName: 'Chi Le',
        joinedAt: serverTimestamp(),
        assignedWord: '',
        isSpy: false,
        eliminated: false,
      }),
    ]);
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedBaseline();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('spy session reads', () => {
  it('allows public read of open-class spy session', async () => {
    await assertSucceeds(publicDb().doc(`spySessions/${SESSION_ID}`).get());
  });

  it('denies public list of participants', async () => {
    await assertFails(publicDb().collection(`spySessions/${SESSION_ID}/participants`).get());
  });
});

describe('spy lobby join', () => {
  it('allows present student to create own participant in lobby', async () => {
    const db = publicDb();
    await assertSucceeds(
      db.doc(`spySessions/${SESSION_ID}/participants/${STUDENT_1}`).set(
        participantJoin(STUDENT_1, 'An Nguyen'),
      ),
    );
  });

  it('denies join when session is not lobby', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`spySessions/${SESSION_ID}`).update({ status: 'describe' });
    });
    const db = publicDb();
    await assertFails(
      db.doc(`spySessions/${SESSION_ID}/participants/${STUDENT_1}`).set(
        participantJoin(STUDENT_1, 'An Nguyen'),
      ),
    );
  });

  it('denies join with wrong student name', async () => {
    const db = publicDb();
    await assertFails(
      db.doc(`spySessions/${SESSION_ID}/participants/${STUDENT_1}`).set(
        participantJoin(STUDENT_1, 'Wrong Name'),
      ),
    );
  });

  it('allows get participant doc for present students', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc(`spySessions/${SESSION_ID}/participants/${STUDENT_1}`).set(
        participantJoin(STUDENT_1, 'An Nguyen'),
      );
    });
    await assertSucceeds(
      publicDb().doc(`spySessions/${SESSION_ID}/participants/${STUDENT_1}`).get(),
    );
  });
});

describe('spy vote', () => {
  beforeEach(async () => {
    await seedVotePhase();
  });

  it('allows active participant to vote in vote phase', async () => {
    const db = publicDb();
    await assertSucceeds(
      db.doc(`spySessions/${SESSION_ID}/votes/${STUDENT_1}`).set({
        targetStudentId: STUDENT_2,
        votedAt: serverTimestamp(),
      }),
    );
  });

  it('allows blank vote in vote phase', async () => {
    const db = publicDb();
    await assertSucceeds(
      db.doc(`spySessions/${SESSION_ID}/votes/${STUDENT_1}`).set({
        targetStudentId: '__blank__',
        votedAt: serverTimestamp(),
      }),
    );
  });

  it('denies vote for eliminated participant', async () => {
    const db = publicDb();
    await assertFails(
      db.doc(`spySessions/${SESSION_ID}/votes/${STUDENT_3}`).set({
        targetStudentId: STUDENT_2,
        votedAt: serverTimestamp(),
      }),
    );
  });

  it('denies voting for eliminated target', async () => {
    const db = publicDb();
    await assertFails(
      db.doc(`spySessions/${SESSION_ID}/votes/${STUDENT_1}`).set({
        targetStudentId: STUDENT_3,
        votedAt: serverTimestamp(),
      }),
    );
  });

  it('denies self vote', async () => {
    const db = publicDb();
    await assertFails(
      db.doc(`spySessions/${SESSION_ID}/votes/${STUDENT_1}`).set({
        targetStudentId: STUDENT_1,
        votedAt: serverTimestamp(),
      }),
    );
  });

  it('denies duplicate vote', async () => {
    const db = publicDb();
    await assertSucceeds(
      db.doc(`spySessions/${SESSION_ID}/votes/${STUDENT_1}`).set({
        targetStudentId: STUDENT_2,
        votedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      db.doc(`spySessions/${SESSION_ID}/votes/${STUDENT_1}`).set({
        targetStudentId: STUDENT_2,
        votedAt: serverTimestamp(),
      }),
    );
  });

  it('denies vote outside vote phase', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`spySessions/${SESSION_ID}`).update({ status: 'describe' });
    });
    const db = publicDb();
    await assertFails(
      db.doc(`spySessions/${SESSION_ID}/votes/${STUDENT_1}`).set({
        targetStudentId: STUDENT_2,
        votedAt: serverTimestamp(),
      }),
    );
  });

  it('denies vote update during normal vote phase', async () => {
    const db = publicDb();
    await assertSucceeds(
      db.doc(`spySessions/${SESSION_ID}/votes/${STUDENT_1}`).set({
        targetStudentId: STUDENT_2,
        votedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      db.doc(`spySessions/${SESSION_ID}/votes/${STUDENT_1}`).update({
        targetStudentId: STUDENT_2,
        votedAt: serverTimestamp(),
      }),
    );
  });

  it('allows vote update during tie_revote phase', async () => {
    const db = publicDb();
    await assertSucceeds(
      db.doc(`spySessions/${SESSION_ID}/votes/${STUDENT_1}`).set({
        targetStudentId: STUDENT_2,
        votedAt: serverTimestamp(),
      }),
    );
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`spySessions/${SESSION_ID}`).update({
        status: 'tie_revote',
        tieCandidateIds: [STUDENT_1, STUDENT_2],
      });
      // STUDENT_3 is eliminated — revive as active target for change vote
      await context.firestore().doc(`spySessions/${SESSION_ID}/participants/${STUDENT_3}`).update({
        eliminated: false,
      });
    });
    await assertSucceeds(
      db.doc(`spySessions/${SESSION_ID}/votes/${STUDENT_1}`).update({
        targetStudentId: STUDENT_3,
        votedAt: serverTimestamp(),
      }),
    );
  });
});

describe('spy admin writes', () => {
  it('allows admin to update session', async () => {
    await assertSucceeds(
      adminDb().doc(`spySessions/${SESSION_ID}`).update({ status: 'describe' }),
    );
  });
});

describe('spy crew mode', () => {
  beforeEach(async () => {
    await seedCrewPlayingPhase();
  });

  it('allows task progress write in playing phase', async () => {
    const db = publicDb();
    await assertSucceeds(
      db.doc(`spySessions/${SESSION_ID}/taskProgress/${STUDENT_1}`).set({
        total: 5,
        completedCount: 2,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('allows spy sabotage to eliminate and open alert', async () => {
    const db = publicDb();
    await assertSucceeds(
      db.doc(`spySessions/${SESSION_ID}`).update({
        status: 'sabotage_alert',
        voteRound: 0,
        eliminatedIds: [STUDENT_1],
        lastEliminatedId: STUDENT_1,
        meetingOpenedBy: '',
        meetingReporterId: '',
        sabotageById: STUDENT_2,
        sabotageAt: serverTimestamp(),
        sabotageActive: true,
      }),
    );
  });

  it('allows acknowledge sabotage alert into vote', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`spySessions/${SESSION_ID}`).update({
        status: 'sabotage_alert',
        voteRound: 0,
        eliminatedIds: [STUDENT_1],
        lastEliminatedId: STUDENT_1,
        sabotageById: STUDENT_2,
        sabotageActive: true,
        meetingOpenedBy: '',
      });
    });
    const db = publicDb();
    await assertSucceeds(
      db.doc(`spySessions/${SESSION_ID}`).update({
        status: 'vote',
        voteRound: 1,
        meetingOpenedBy: 'sabotage',
        sabotageActive: false,
        crewSabotageAckById: STUDENT_3,
        crewVoteResolveEndsAt: null,
      }),
    );
  });

  it('denies sabotage by civilian', async () => {
    const db = publicDb();
    await assertFails(
      db.doc(`spySessions/${SESSION_ID}`).update({
        status: 'sabotage_alert',
        voteRound: 0,
        eliminatedIds: [STUDENT_2],
        lastEliminatedId: STUDENT_2,
        meetingOpenedBy: '',
        meetingReporterId: '',
        sabotageById: STUDENT_1,
        sabotageAt: serverTimestamp(),
        sabotageActive: true,
      }),
    );
  });

  it('denies sabotage eliminating the spy', async () => {
    const db = publicDb();
    await assertFails(
      db.doc(`spySessions/${SESSION_ID}`).update({
        status: 'sabotage_alert',
        voteRound: 0,
        eliminatedIds: [STUDENT_2],
        lastEliminatedId: STUDENT_2,
        meetingOpenedBy: '',
        meetingReporterId: '',
        sabotageById: STUDENT_2,
        sabotageAt: serverTimestamp(),
        sabotageActive: true,
      }),
    );
  });

  it('allows crew vote quorum schedule', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`spySessions/${SESSION_ID}`).update({ status: 'vote', voteRound: 1 });
    });
    const db = publicDb();
    await assertSucceeds(
      db.doc(`spySessions/${SESSION_ID}`).update({
        crewVoteResolveEndsAt: new Date(Date.now() + 5000),
        crewVoteQuorumById: STUDENT_1,
      }),
    );
  });

  it('allows one-time report to open meeting', async () => {
    const db = publicDb();
    await assertSucceeds(
      db.doc(`spySessions/${SESSION_ID}`).update({
        status: 'vote',
        voteRound: 1,
        reportedByIds: [STUDENT_1],
        meetingOpenedBy: 'report',
        meetingReporterId: STUDENT_1,
        sabotageActive: false,
        sabotageById: '',
      }),
    );
  });

  it('denies second report by same student', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`spySessions/${SESSION_ID}`).update({
        reportedByIds: [STUDENT_1],
      });
    });
    const db = publicDb();
    await assertFails(
      db.doc(`spySessions/${SESSION_ID}`).update({
        status: 'vote',
        voteRound: 1,
        reportedByIds: [STUDENT_1],
        meetingOpenedBy: 'report',
        meetingReporterId: STUDENT_1,
        sabotageActive: false,
        sabotageById: '',
      }),
    );
  });
});
