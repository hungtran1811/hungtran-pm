import { subscribeClasses } from '../../services/classes.service.js';
import { subscribeCurriculumPrograms } from '../../services/curriculum.service.js';
import { subscribeStudents } from '../../services/students.service.js';
import { getAuthState } from '../../state/auth.store.js';
import { mapFirebaseError } from '../../utils/firebase-error.js';
import { escapeHtml } from '../../utils/html.js';
import { renderAppShell } from '../components/AppShell.js';
import { renderEmptyState } from '../components/EmptyState.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { renderStageBadge } from '../components/StageBadge.js';
import { renderStatusBadge } from '../components/StatusBadge.js';
import { showToast } from '../components/ToastStack.js';

export const adminAnalyticsPage = {
  title: 'Phân tích số liệu',
  async render() {
    const authState = getAuthState();

    return renderAppShell({
      title: 'Phân tích số liệu',
      subtitle: '',
      currentRoute: '/admin/analytics',
      user: authState.user,
      content: `
        <section class="admin-page admin-page--analytics">
          <div id="analytics-content-slot">${renderLoadingOverlay('Đang tải phân tích số liệu...')}</div>
        </section>
      `,
    });
  },

  async mount() {
    const contentSlot = document.getElementById('analytics-content-slot');
    if (!contentSlot) return;

    const state = {
      classes: [],
      students: [],
      programs: [],
      loading: {
        classes: true,
        students: true,
        programs: true,
      },
      searchTerm: '',
      classFilter: 'all',
      subjectFilter: 'all',
      statusFilter: 'in_progress',
    };

    function detectSubject(programId, className) {
      const id = String(programId || '').toLowerCase();
      const name = String(className || '').toLowerCase();

      if (id.includes('scratch') || name.includes('scratch')) return 'scratch';
      if (id.includes('gamemaker') || name.includes('gamemaker') || id.includes('game') || name.includes('game')) return 'gamemaker';
      if (id.includes('python') || name.includes('python')) return 'python';
      if (id.includes('web') || name.includes('web') || id.includes('js') || name.includes('js') || id.includes('frontend') || name.includes('frontend') || id.includes('html') || name.includes('html') || id.includes('css') || name.includes('css')) return 'web';
      if (id.includes('computer') || name.includes('computer') || id.includes('cs') || name.includes('cs') || id.includes('science') || name.includes('science')) return 'computer_science';

      return 'other';
    }

    function getFilteredStudents() {
      return state.students.filter(student => {
        const searchMatches = !state.searchTerm ||
          student.fullName.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
          (student.projectName && student.projectName.toLowerCase().includes(state.searchTerm.toLowerCase()));

        const cl = state.classes.find(c => c.classCode === student.classCode || c.id === student.classId);
        
        const classMatches = state.classFilter === 'all' ||
          student.classCode === state.classFilter ||
          student.classId === state.classFilter;

        let subjectMatches = true;
        if (state.subjectFilter !== 'all') {
          const progId = cl ? cl.curriculumProgramId : '';
          const clName = cl ? cl.className : '';
          subjectMatches = detectSubject(progId, clName) === state.subjectFilter;
        }

        const isCompletedStudent =
          student.currentStatus === 'Hoàn thành' ||
          Number(student.currentProgressPercent || 0) >= 100;
        const statusMatches =
          state.statusFilter === 'all' ||
          (state.statusFilter === 'completed' && isCompletedStudent) ||
          (state.statusFilter === 'in_progress' && !isCompletedStudent);

        return searchMatches && classMatches && subjectMatches && statusMatches;
      });
    }

    function updateFilteredTable() {
      const filtered = getFilteredStudents();
      const tbody = document.getElementById('analytics-projects-table-body');
      const countEl = document.getElementById('filtered-projects-count');

      if (countEl) {
        countEl.textContent = `${filtered.length} học sinh`;
      }

      if (!tbody) return;

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-4 text-muted">
              Không tìm thấy học sinh nào khớp với điều kiện lọc.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = filtered.map((student, index) => {
        const progress = Math.max(0, Math.min(100, student.currentProgressPercent));
        const cl = state.classes.find(c => c.classCode === student.classCode || c.id === student.classId);
        const className = cl ? cl.className : '';
        const classCodeMarkup = cl 
          ? `<span class="fw-bold text-primary">${escapeHtml(cl.classCode)}</span>${className ? `<span class="small text-muted d-block" style="font-size: 11px;">${escapeHtml(className)}</span>` : ''}`
          : `<span class="text-secondary">${escapeHtml(student.classCode || 'Chưa gán')}</span>`;

        return `
          <tr>
            <td data-label="#" class="text-secondary" style="width: 40px;">${index + 1}</td>
            <td data-label="Học viên" class="analytics-table-student-name">${escapeHtml(student.fullName)}</td>
            <td data-label="Lớp">${classCodeMarkup}</td>
            <td data-label="Dự án" class="analytics-table-project-name">${escapeHtml(student.projectName || 'Không đăng ký')}</td>
            <td data-label="Tiến độ">
              <div class="d-flex align-items-center gap-2">
                <span class="fw-bold small">${progress}%</span>
                <div class="progress flex-grow-1" style="height: 6px; min-width: 80px; max-width: 120px;">
                  <div class="progress-bar bg-primary" role="progressbar" style="width: ${progress}%" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
              </div>
            </td>
            <td data-label="Trạng thái">${renderStatusBadge(student.currentStatus)}</td>
          </tr>
        `;
      }).join('');
    }

    function renderView() {
      const isStillLoading = state.loading.classes || state.loading.students || state.loading.programs;
      if (isStillLoading && state.classes.length === 0) {
        contentSlot.innerHTML = renderLoadingOverlay('Đang tải dữ liệu phân tích...');
        return;
      }

      const totalClasses = state.classes.filter(c => !c.hidden).length;
      const totalStudents = state.students.length;

      const completedClasses = state.classes.filter(c => c.status === 'completed').length;
      const activeClasses = state.classes.filter(c => c.status === 'active' && !c.hidden).length;

      const completedStudents = state.students.filter(s => s.currentProgressPercent >= 100 || s.currentStatus === 'Hoàn thành').length;
      const activeStudents = state.students.filter(s => s.active).length;

      // Calculate subject distribution (number of students per subject)
      const subjectCounts = {
        scratch: 0,
        gamemaker: 0,
        python: 0,
        web: 0,
        computer_science: 0,
        other: 0
      };

      state.students.forEach(s => {
        const cl = state.classes.find(c => c.classCode === s.classCode || c.id === s.classId);
        const progId = cl ? cl.curriculumProgramId : '';
        const clName = cl ? cl.className : '';
        const subject = detectSubject(progId, clName);
        subjectCounts[subject]++;
      });

      const maxSubjectVal = Math.max(...Object.values(subjectCounts), 5);

      // SVG Gridlines
      const gridlines = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
        const y = 170 - ratio * 120;
        const gridValue = Math.round(ratio * maxSubjectVal);
        return `
          <line x1="50" y1="${y}" x2="520" y2="${y}" class="teacher-chart-gridline" />
          <text x="40" y="${y + 4}" text-anchor="end" class="chart-label-axis" style="font-size: 9px; font-weight: 700;">${gridValue}</text>
        `;
      }).join('');

      const subjectBrackets = [
        { label: 'Scratch', val: subjectCounts.scratch, color: 'url(#gradient-scratch)' },
        { label: 'GM', val: subjectCounts.gamemaker, color: 'url(#gradient-gamemaker)' },
        { label: 'Python', val: subjectCounts.python, color: 'url(#gradient-python)' },
        { label: 'Web', val: subjectCounts.web, color: 'url(#gradient-web)' },
        { label: 'CS', val: subjectCounts.computer_science, color: 'url(#gradient-cs)' },
        { label: 'Khác', val: subjectCounts.other, color: 'url(#gradient-other)' }
      ];

      const svgBars = subjectBrackets.map((b, index) => {
        const x = 75 + index * 75;
        const barHeight = (b.val / maxSubjectVal) * 120;
        const y = 170 - barHeight;
        
        return `
          <g class="chart-bar-group">
            <rect x="${x}" y="${y}" width="40" height="${barHeight}" fill="${b.color}" rx="4" class="teacher-chart-bar" />
            <text x="${x + 20}" y="${y - 8}" class="chart-label-value">${b.val}</text>
            <text x="${x + 20}" y="188" class="chart-label-axis">${b.label}</text>
          </g>
        `;
      }).join('');

      // Class average progress calculations
      const classProgressList = state.classes
        .filter(c => !c.hidden)
        .map(c => {
          const classSt = state.students.filter(s => s.classCode === c.classCode || s.classId === c.classCode || s.classId === c.id);
          const sum = classSt.reduce((acc, s) => acc + Math.max(0, Math.min(100, s.currentProgressPercent)), 0);
          const avg = classSt.length > 0 ? Math.round(sum / classSt.length) : 0;
          return {
            classCode: c.classCode,
            className: c.className,
            studentCount: classSt.length,
            avgProgress: avg,
            status: c.status
          };
        }).sort((a, b) => b.avgProgress - a.avgProgress);

      // Main Render
      contentSlot.innerHTML = `
        <div class="analytics-container">
          <!-- Condensed Metric Cards (4 KPI Cards) -->
          <div class="teacher-kpi-grid">
            <div class="teacher-card">
              <div class="teacher-card__info">
                <span class="teacher-card__label">Tổng số lớp học</span>
                <span class="teacher-card__value">${totalClasses} lớp</span>
                <span class="teacher-card__hint">${activeClasses} lớp đang chạy</span>
              </div>
              <div class="teacher-card__icon">
                <i class="bi bi-collection"></i>
              </div>
            </div>

            <div class="teacher-card teacher-card--purple">
              <div class="teacher-card__info">
                <span class="teacher-card__label">Tổng số học sinh</span>
                <span class="teacher-card__value">${totalStudents} HS</span>
                <span class="teacher-card__hint">${activeStudents} học sinh đang học</span>
              </div>
              <div class="teacher-card__icon">
                <i class="bi bi-people"></i>
              </div>
            </div>

            <div class="teacher-card teacher-card--green">
              <div class="teacher-card__info">
                <span class="teacher-card__label">Lớp đã hoàn thành</span>
                <span class="teacher-card__value">${completedClasses} lớp</span>
                <span class="teacher-card__hint">Đã đóng khóa học</span>
              </div>
              <div class="teacher-card__icon">
                <i class="bi bi-patch-check-fill"></i>
              </div>
            </div>

            <div class="teacher-card teacher-card--orange">
              <div class="teacher-card__info">
                <span class="teacher-card__label">Học sinh hoàn thành</span>
                <span class="teacher-card__value">${completedStudents} HS</span>
                <span class="teacher-card__hint">Đạt 100% tiến độ học tập</span>
              </div>
              <div class="teacher-card__icon">
                <i class="bi bi-award-fill"></i>
              </div>
            </div>
          </div>

          <!-- Charts Row -->
          <div class="teacher-grid-layout">
            <!-- Left: SVG Distribution by Subject (Scratch, Gamemaker, Python, Web, Computer Science) -->
            <div class="teacher-panel teacher-panel--class-progress">
              <div class="teacher-panel__head">
                <h2 class="teacher-panel__title">
                  <i class="bi bi-bar-chart-fill text-primary"></i> Phân bổ số lượng học sinh theo môn học
                </h2>
              </div>
              <div class="teacher-panel__body">
                <svg viewBox="0 0 540 210" class="teacher-svg-chart">
                  <defs>
                    <linearGradient id="gradient-scratch" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#f59e0b" />
                      <stop offset="100%" stop-color="#fdba74" />
                    </linearGradient>
                    <linearGradient id="gradient-gamemaker" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#ec4899" />
                      <stop offset="100%" stop-color="#fbcfe8" />
                    </linearGradient>
                    <linearGradient id="gradient-python" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#3b82f6" />
                      <stop offset="100%" stop-color="#93c5fd" />
                    </linearGradient>
                    <linearGradient id="gradient-web" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#10b981" />
                      <stop offset="100%" stop-color="#6ee7b7" />
                    </linearGradient>
                    <linearGradient id="gradient-cs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#8b5cf6" />
                      <stop offset="100%" stop-color="#c4b5fd" />
                    </linearGradient>
                    <linearGradient id="gradient-other" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#6b7280" />
                      <stop offset="100%" stop-color="#9ca3af" />
                    </linearGradient>
                  </defs>
                  
                  <!-- Gridlines -->
                  ${gridlines}
                  
                  <!-- Axes -->
                  <line x1="50" y1="170" x2="520" y2="170" class="teacher-chart-axis" />
                  <line x1="50" y1="30" x2="50" y2="170" class="teacher-chart-axis" />
                  
                  <!-- Bars -->
                  ${svgBars}
                </svg>
              </div>
            </div>

            <!-- Right: Class Progress Average List -->
            <div class="teacher-panel">
              <div class="teacher-panel__head">
                <h2 class="teacher-panel__title">
                  <i class="bi bi-list-task text-primary"></i> Tiến độ trung bình theo từng lớp học
                </h2>
              </div>
              <div class="teacher-panel__body teacher-class-progress-body">
                ${
                  classProgressList.length > 0
                    ? classProgressList.map(item => `
                        <div class="teacher-class-row">
                          <div class="teacher-class-code">
                            ${escapeHtml(item.classCode)}
                            ${item.status === 'completed' ? `<span class="badge bg-success-subtle text-success border border-success-subtle ms-1" style="font-size: 9px; padding: 1px 4px;">Done</span>` : ''}
                          </div>
                          <div class="teacher-class-bar-container">
                            <div class="teacher-class-progress-bar">
                              <div class="teacher-class-progress-fill" style="width: ${item.avgProgress}%;"></div>
                            </div>
                            <div class="teacher-class-name">${escapeHtml(item.className || 'Chưa đặt tên')} (${item.studentCount} học sinh)</div>
                          </div>
                          <div class="teacher-class-value">${item.avgProgress}%</div>
                        </div>
                      `).join('')
                    : `<div class="text-center py-4 text-muted">Chưa có thông tin lớp học.</div>`
                }
              </div>
            </div>
          </div>

          <!-- Bottom: Projects Tracker -->
          <div class="teacher-panel">
            <div class="teacher-panel__head">
              <h2 class="teacher-panel__title">
                <i class="bi bi-search text-primary"></i> Danh sách học sinh & Dự án thực tế
              </h2>
              <span class="badge bg-primary rounded-pill" id="filtered-projects-count">0 học sinh</span>
            </div>
            <div class="teacher-panel__body">
              <!-- Controls -->
              <div class="teacher-controls-row">
                <div class="teacher-search-wrapper">
                  <i class="bi bi-search"></i>
                  <input
                    type="text"
                    id="teacher-search-input"
                    class="teacher-search-input"
                    placeholder="Tìm tên học sinh hoặc đề tài..."
                    value="${escapeHtml(state.searchTerm)}"
                  />
                </div>

                <div class="teacher-filters-group">
                  <select id="teacher-status-filter" class="teacher-filter-select">
                    <option value="in_progress" ${state.statusFilter === 'in_progress' ? 'selected' : ''}>Đang theo dõi</option>
                    <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>Tất cả</option>
                    <option value="completed" ${state.statusFilter === 'completed' ? 'selected' : ''}>Đã hoàn thành</option>
                  </select>

                  <select id="teacher-subject-filter" class="teacher-filter-select">
                    <option value="all">Tất cả môn học</option>
                    <option value="scratch" ${state.subjectFilter === 'scratch' ? 'selected' : ''}>Scratch</option>
                    <option value="gamemaker" ${state.subjectFilter === 'gamemaker' ? 'selected' : ''}>Gamemaker</option>
                    <option value="python" ${state.subjectFilter === 'python' ? 'selected' : ''}>Python</option>
                    <option value="web" ${state.subjectFilter === 'web' ? 'selected' : ''}>Web Frontend</option>
                    <option value="computer_science" ${state.subjectFilter === 'computer_science' ? 'selected' : ''}>Computer Science</option>
                  </select>

                  <select id="teacher-class-filter" class="teacher-filter-select">
                    <option value="all">Tất cả lớp học</option>
                    ${state.classes
                      .filter(c => !c.hidden)
                      .map(c => `<option value="${escapeHtml(c.classCode)}" ${state.classFilter === c.classCode ? 'selected' : ''}>Lớp ${escapeHtml(c.classCode)}</option>`)
                      .join('')}
                  </select>
                </div>
              </div>

              <!-- Table -->
              <div class="analytics-table-responsive">
                <table class="teacher-clean-table">
                  <thead>
                    <tr>
                      <th style="width: 40px;">#</th>
                      <th>Học viên</th>
                      <th>Lớp học</th>
                      <th>Dự án thực tế</th>
                      <th>Tiến độ sản phẩm</th>
                      <th>Trạng thái học</th>
                    </tr>
                  </thead>
                  <tbody id="analytics-projects-table-body">
                    <!-- Rows filled dynamically -->
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      `;

      // Fill initial table contents
      updateFilteredTable();

      // Bind input events
      const searchInput = document.getElementById('teacher-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          state.searchTerm = e.target.value;
          updateFilteredTable();
        });
      }

      const subjectFilterSelect = document.getElementById('teacher-subject-filter');
      if (subjectFilterSelect) {
        subjectFilterSelect.addEventListener('change', (e) => {
          state.subjectFilter = e.target.value;
          updateFilteredTable();
        });
      }

      const classFilterSelect = document.getElementById('teacher-class-filter');
      if (classFilterSelect) {
        classFilterSelect.addEventListener('change', (e) => {
          state.classFilter = e.target.value;
          updateFilteredTable();
        });
      }

      const statusFilterSelect = document.getElementById('teacher-status-filter');
      if (statusFilterSelect) {
        statusFilterSelect.addEventListener('change', (e) => {
          state.statusFilter = e.target.value;
          updateFilteredTable();
        });
      }

      const refreshBtn = document.getElementById('btn-refresh-analytics');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          state.loading.classes = true;
          state.loading.students = true;
          state.loading.programs = true;
          renderView();
          
          showToast({
            title: 'Làm mới dữ liệu',
            message: 'Đang tải lại dữ liệu tiến độ mới nhất...',
            variant: 'info'
          });
        });
      }
    }

    const unsubscribers = [
      subscribeClasses(
        (classes) => {
          state.classes = classes;
          state.loading.classes = false;
          renderView();
        },
        (error) => {
          state.loading.classes = false;
          showToast({
            title: 'Lỗi tải lớp học',
            message: mapFirebaseError(error, 'Không thể tải danh sách lớp.'),
            variant: 'danger',
          });
          renderView();
        }
      ),
      subscribeStudents(
        (students) => {
          state.students = students;
          state.loading.students = false;
          renderView();
        },
        (error) => {
          state.loading.students = false;
          showToast({
            title: 'Lỗi tải học viên',
            message: mapFirebaseError(error, 'Không thể tải danh sách học viên.'),
            variant: 'danger',
          });
          renderView();
        }
      ),
      subscribeCurriculumPrograms(
        (programs) => {
          state.programs = programs;
          state.loading.programs = false;
          renderView();
        },
        (error) => {
          state.loading.programs = false;
          showToast({
            title: 'Lỗi tải chương trình',
            message: mapFirebaseError(error, 'Không thể tải dữ liệu chương trình học.'),
            variant: 'danger',
          });
          renderView();
        }
      )
    ];

    renderView();

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }
};
