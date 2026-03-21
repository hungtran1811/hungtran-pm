import { renderAdminGuard } from '../components/AdminGuard.js';

export const forbiddenPage = {
  title: 'Không có quyền truy cập',
  async render() {
    return renderAdminGuard();
  },
};
