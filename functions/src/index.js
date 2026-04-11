'use strict';

const { HttpsError, onCall } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { Timestamp, db } = require('./lib/firestore');
const { validateReportPayload } = require('./validators/report.validator');

const REGION = 'asia-southeast1';
const TIME_ZONE = 'Asia/Ho_Chi_Minh';

function formatDateKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function toMillis(value) {
  if (!value) {
    return null;
  }

  if (typeof value?.toMillis === 'function') {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return null;
}

function buildStudentRosterItem(doc) {
  const data = doc.data();

  return {
    studentId: doc.id,
    fullName: data.fullName,
    projectName: data.projectName ?? '',
    lastReportedAt: data.lastReportedAt ?? null,
    currentProgressPercent: data.currentProgressPercent ?? 0,
    currentStage: data.currentStage ?? 'Ý tưởng',
    currentStatus: data.currentStatus ?? 'Chưa bắt đầu',
  };
}

function buildLatestStudentReportItem(doc) {
  const data = doc.data();

  return {
    doneToday: data.doneToday ?? '',
    nextGoal: data.nextGoal ?? '',
    difficulties: data.difficulties ?? '',
    progressPercent: data.progressPercent ?? 0,
    stage: data.stage ?? 'Ý tưởng',
    status: data.status ?? 'Chưa bắt đầu',
    submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate().toISOString() : null,
  };
}

async function getValidatedActiveClass(classCode) {
  const classRef = db.collection('classes').doc(classCode);
  const classSnap = await classRef.get();

  if (!classSnap.exists) {
    throw new HttpsError('not-found', 'Không tìm thấy lớp học.');
  }

  const classData = classSnap.data();

  if (classData.hidden || classData.status !== 'active') {
    throw new HttpsError('failed-precondition', 'Lớp học hiện không mở để gửi báo cáo.');
  }

  return { ref: classRef, data: classData };
}

exports.listActiveClasses = onCall({ region: REGION, cors: true }, async () => {
  const snap = await db
    .collection('classes')
    .where('status', '==', 'active')
    .where('hidden', '==', false)
    .get();

  return {
    classes: snap.docs
      .map((doc) => {
        const data = doc.data();

        return {
          classId: doc.id,
          classCode: data.classCode,
          className: data.className,
        };
      })
      .sort((left, right) => left.className.localeCompare(right.className, 'vi')),
  };
});

exports.getClassRoster = onCall({ region: REGION, cors: true }, async (request) => {
  const classCode = String(request.data?.classCode ?? '').trim().toUpperCase();

  if (!classCode) {
    throw new HttpsError('invalid-argument', 'classCode là bắt buộc.');
  }

  await getValidatedActiveClass(classCode);

  const studentsSnap = await db
    .collection('students')
    .where('classId', '==', classCode)
    .where('active', '==', true)
    .get();

  return {
    students: studentsSnap.docs
      .map(buildStudentRosterItem)
      .sort((left, right) => left.fullName.localeCompare(right.fullName, 'vi')),
  };
});

exports.getLatestStudentReport = onCall({ region: REGION, cors: true }, async (request) => {
  const classCode = String(request.data?.classCode ?? '').trim().toUpperCase();
  const studentId = String(request.data?.studentId ?? '').trim();

  if (!classCode) {
    throw new HttpsError('invalid-argument', 'classCode là bắt buộc.');
  }

  if (!studentId) {
    throw new HttpsError('invalid-argument', 'studentId là bắt buộc.');
  }

  await getValidatedActiveClass(classCode);

  const studentRef = db.collection('students').doc(studentId);
  const studentSnap = await studentRef.get();

  if (!studentSnap.exists) {
    throw new HttpsError('not-found', 'Không tìm thấy học sinh.');
  }

  const studentData = studentSnap.data();

  if (!studentData.active || studentData.classId !== classCode) {
    throw new HttpsError(
      'failed-precondition',
      'Học sinh hiện không thuộc lớp được chọn hoặc đã bị khóa.',
    );
  }

  const latestReportId = String(studentData.latestReportId ?? '').trim();

  if (!latestReportId) {
    return {
      latestReport: null,
    };
  }

  const latestReportRef = db.collection('reports').doc(latestReportId);
  const latestReportSnap = await latestReportRef.get();

  if (!latestReportSnap.exists) {
    logger.warn('Latest report reference is missing', {
      classCode,
      studentId,
      latestReportId,
    });

    return {
      latestReport: null,
    };
  }

  const latestReportData = latestReportSnap.data();

  if (latestReportData.studentId !== studentId || latestReportData.classCode !== classCode) {
    logger.warn('Latest report reference does not match student or class', {
      classCode,
      studentId,
      latestReportId,
      reportStudentId: latestReportData.studentId ?? '',
      reportClassCode: latestReportData.classCode ?? '',
    });

    return {
      latestReport: null,
    };
  }

  return {
    latestReport: buildLatestStudentReportItem(latestReportSnap),
  };
});

exports.submitStudentReport = onCall({ region: REGION, cors: true }, async (request) => {
  const validation = validateReportPayload(request.data);

  if (!validation.isValid) {
    throw new HttpsError('invalid-argument', validation.errors.join(' '));
  }

  const { classCode, studentId, doneToday, nextGoal, difficulties, progressPercent, stage, status } =
    validation.value;

  await getValidatedActiveClass(classCode);

  const studentRef = db.collection('students').doc(studentId);
  const studentSnap = await studentRef.get();

  if (!studentSnap.exists) {
    throw new HttpsError('not-found', 'Không tìm thấy học sinh.');
  }

  const studentData = studentSnap.data();

  if (!studentData.active || studentData.classId !== classCode) {
    throw new HttpsError(
      'failed-precondition',
      'Học sinh hiện không thuộc lớp được chọn hoặc đã bị khóa.',
    );
  }

  const latestReportSnap = await db
    .collection('reports')
    .where('studentId', '==', studentId)
    .orderBy('submittedAt', 'desc')
    .limit(1)
    .get();

  const latestReport = latestReportSnap.empty ? null : latestReportSnap.docs[0].data();
  const latestProgress = latestReport?.progressPercent ?? null;
  const progressStalledCount =
    latestProgress === null ? 0 : progressPercent <= latestProgress ? (studentData.progressStalledCount ?? 0) + 1 : 0;

  const submittedAt = Timestamp.now();
  const submittedDateKey = formatDateKey(new Date());
  const reportRef = db.collection('reports').doc();

  await db.runTransaction(async (transaction) => {
    transaction.set(reportRef, {
      classId: classCode,
      classCode,
      studentId,
      studentName: studentData.fullName,
      projectName: studentData.projectName ?? '',
      progressPercent,
      stage,
      status,
      doneToday,
      nextGoal,
      difficulties,
      submittedAt,
      submittedDateKey,
      source: 'student-form',
      createdAt: submittedAt,
    });

    transaction.update(studentRef, {
      currentProgressPercent: progressPercent,
      currentStage: stage,
      currentStatus: status,
      currentDifficulties: difficulties,
      lastReportedAt: submittedAt,
      latestReportId: reportRef.id,
      progressStalledCount,
      updatedAt: submittedAt,
    });
  });

  logger.info('Student report submitted', {
    classCode,
    studentId,
    reportId: reportRef.id,
    progressPercent,
    progressStalledCount,
    submittedAtMillis: toMillis(submittedAt),
  });

  return {
    reportId: reportRef.id,
    submittedAt: submittedAt.toDate().toISOString(),
  };
});
