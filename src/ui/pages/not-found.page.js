export const notFoundPage = {
  title: 'Không tìm thấy trang',
  async render() {
    return `
      <div class="container py-5">
        <div class="card border-0 shadow-sm mx-auto" style="max-width: 560px;">
          <div class="card-body p-5 text-center">
            <i class="bi bi-compass fs-1 text-secondary"></i>
            <h1 class="h4 mt-3">Không tìm thấy trang</h1>
            <p class="text-secondary mb-4">Đường dẫn bạn đang mở không tồn tại trong hệ thống.</p>
            <a href="#/student/report" class="btn btn-primary">Quay về trang học sinh</a>
          </div>
        </div>
      </div>
    `;
  },
};
