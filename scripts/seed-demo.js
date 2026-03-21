import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import fs from 'node:fs';

function loadCredential() {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    return cert(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')));
  }

  return applicationDefault();
}

initializeApp({
  credential: loadCredential(),
});

const db = getFirestore();
const now = Timestamp.now();

const classes = [
  {
    classCode: 'PBL101',
    className: 'Lớp PBL 101',
    status: 'active',
    hidden: false,
    startDate: '2026-03-01',
    endDate: '2026-05-30',
    studentCount: 3,
  },
  {
    classCode: 'PBL202',
    className: 'Lớp PBL 202',
    status: 'active',
    hidden: false,
    startDate: '2026-03-05',
    endDate: '2026-06-15',
    studentCount: 3,
  },
];

const students = [
  ['st001', 'Nguyễn Minh Anh', 'PBL101', 'Website thư viện mini', 35, 'Thiết kế', 'Đang làm', '', 0],
  ['st002', 'Trần Gia Huy', 'PBL101', 'Ứng dụng ghi chú học tập', 60, 'Xây dựng chức năng', 'Cần hỗ trợ', 'Lỗi đồng bộ dữ liệu realtime.', 1],
  ['st003', 'Lê Khánh Vy', 'PBL101', 'Landing page CLB Khoa học', 90, 'Hoàn thiện', 'Gần hoàn thành', '', 0],
  ['st004', 'Phạm Quốc Bảo', 'PBL202', 'Website bán cây cảnh', 20, 'Lên kế hoạch', 'Đang làm', '', 0],
  ['st005', 'Đỗ Thu Hà', 'PBL202', 'Ứng dụng quản lý bài tập', 100, 'Thuyết trình / Nộp sản phẩm', 'Hoàn thành', '', 0],
  ['st006', 'Vũ Hoàng Nam', 'PBL202', 'Portfolio cá nhân', 45, 'Xây dựng chức năng', 'Đang làm', '', 2],
];

const reports = [
  ['rp001', 'PBL101', 'st001', 'Nguyễn Minh Anh', 'Website thư viện mini', 35, 'Thiết kế', 'Đang làm'],
  ['rp002', 'PBL101', 'st002', 'Trần Gia Huy', 'Ứng dụng ghi chú học tập', 60, 'Xây dựng chức năng', 'Cần hỗ trợ'],
  ['rp003', 'PBL101', 'st003', 'Lê Khánh Vy', 'Landing page CLB Khoa học', 90, 'Hoàn thiện', 'Gần hoàn thành'],
  ['rp004', 'PBL202', 'st004', 'Phạm Quốc Bảo', 'Website bán cây cảnh', 20, 'Lên kế hoạch', 'Đang làm'],
  ['rp005', 'PBL202', 'st005', 'Đỗ Thu Hà', 'Ứng dụng quản lý bài tập', 100, 'Thuyết trình / Nộp sản phẩm', 'Hoàn thành'],
  ['rp006', 'PBL202', 'st006', 'Vũ Hoàng Nam', 'Portfolio cá nhân', 45, 'Xây dựng chức năng', 'Đang làm'],
  ['rp007', 'PBL101', 'st001', 'Nguyễn Minh Anh', 'Website thư viện mini', 25, 'Lên kế hoạch', 'Đang làm'],
  ['rp008', 'PBL101', 'st002', 'Trần Gia Huy', 'Ứng dụng ghi chú học tập', 55, 'Xây dựng chức năng', 'Đang làm'],
  ['rp009', 'PBL101', 'st003', 'Lê Khánh Vy', 'Landing page CLB Khoa học', 80, 'Kiểm thử', 'Đang làm'],
  ['rp010', 'PBL202', 'st004', 'Phạm Quốc Bảo', 'Website bán cây cảnh', 10, 'Ý tưởng', 'Đang làm'],
  ['rp011', 'PBL202', 'st005', 'Đỗ Thu Hà', 'Ứng dụng quản lý bài tập', 95, 'Hoàn thiện', 'Gần hoàn thành'],
  ['rp012', 'PBL202', 'st006', 'Vũ Hoàng Nam', 'Portfolio cá nhân', 45, 'Thiết kế', 'Đang làm'],
];

function slugifyVietnamese(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .replaceAll(/đ/g, 'd')
    .replaceAll(/Đ/g, 'D')
    .toLowerCase();
}

async function seed() {
  for (const item of classes) {
    await db.collection('classes').doc(item.classCode).set({
      ...item,
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const [id, fullName, classId, projectName, progress, stage, status, difficulties, stalledCount] of students) {
    await db.collection('students').doc(id).set({
      fullName,
      fullNameKey: slugifyVietnamese(fullName),
      classId,
      classCode: classId,
      projectName,
      active: true,
      currentProgressPercent: progress,
      currentStage: stage,
      currentStatus: status,
      currentDifficulties: difficulties,
      lastReportedAt: now,
      latestReportId: '',
      progressStalledCount: stalledCount,
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const [id, classId, studentId, studentName, projectName, progressPercent, stage, status] of reports) {
    await db.collection('reports').doc(id).set({
      classId,
      classCode: classId,
      studentId,
      studentName,
      projectName,
      progressPercent,
      stage,
      status,
      doneToday: 'Hoàn thành một phần chức năng theo kế hoạch buổi học.',
      nextGoal: 'Tiếp tục hoàn thiện tính năng còn thiếu và kiểm thử trên giao diện thật.',
      difficulties: status === 'Cần hỗ trợ' ? 'Cần hỗ trợ xử lý lỗi đồng bộ dữ liệu từ Firestore.' : '',
      submittedAt: now,
      submittedDateKey: '2026-03-21',
      source: 'seed-script',
      createdAt: now,
    });
  }

  const adminEmail = String(process.env.SEED_ADMIN_EMAIL || 'admin@example.com').toLowerCase();
  await db.collection('admins').doc(adminEmail).set({
    email: adminEmail,
    role: 'owner',
    active: true,
    displayName: 'Demo Admin',
    createdAt: now,
    updatedAt: now,
  });

  console.log('Seed demo completed successfully.');
}

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
