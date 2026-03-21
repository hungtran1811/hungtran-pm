import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import * as bootstrap from 'bootstrap';
import './styles/main.css';
import { bootstrapApp } from './app/bootstrap.js';

window.bootstrap = bootstrap;

bootstrapApp().catch((error) => {
  document.getElementById('app').innerHTML = `
    <div class="container py-5">
      <div class="card border-0 shadow-sm mx-auto" style="max-width: 720px;">
        <div class="card-body p-4 p-lg-5">
          <h1 class="h4 mb-3">Không thể khởi động ứng dụng</h1>
          <p class="text-secondary mb-3">Kiểm tra lại file môi trường Firebase và cấu hình build trước khi chạy ứng dụng.</p>
          <pre class="bg-light rounded-3 p-3 mb-0">${error.message}</pre>
        </div>
      </div>
    </div>
  `;
});
