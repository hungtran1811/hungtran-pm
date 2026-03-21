export function renderAdminGuard() {
  return `
    <div class="container py-5">
      <div class="card shadow-sm border-0 mx-auto" style="max-width: 520px;">
        <div class="card-body p-4 text-center">
          <i class="bi bi-shield-lock fs-1 text-danger"></i>
          <h1 class="h4 mt-3">Bạn không có quyền truy cập</h1>
          <p class="text-secondary mb-0">Vui lòng đăng nhập bằng tài khoản quản trị đã được cấp quyền trong Firebase.</p>
        </div>
      </div>
    </div>
  `;
}
