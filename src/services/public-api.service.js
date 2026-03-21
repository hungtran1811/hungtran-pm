import { httpsCallable } from 'firebase/functions';
import { getFirebaseServices } from '../config/firebase.js';
import { toAppError } from '../utils/firebase-error.js';

function callable(name) {
  const { functions } = getFirebaseServices();
  return httpsCallable(functions, name);
}

export async function listActiveClasses() {
  try {
    const response = await callable('listActiveClasses')({});
    return response.data.classes ?? [];
  } catch (error) {
    throw toAppError(error, 'Không tải được danh sách lớp đang mở.');
  }
}

export async function getClassRoster(classCode) {
  try {
    const response = await callable('getClassRoster')({ classCode });
    return response.data.students ?? [];
  } catch (error) {
    throw toAppError(error, 'Không tải được danh sách học sinh của lớp này.');
  }
}

export async function submitStudentReport(payload) {
  try {
    const response = await callable('submitStudentReport')(payload);
    return response.data;
  } catch (error) {
    throw toAppError(error, 'Không thể gửi báo cáo lúc này.');
  }
}
