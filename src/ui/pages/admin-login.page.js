import { getAdminProfileByEmail } from '../../services/admins.service.js';
import { resolveGoogleRedirectResult, signInWithGoogle, signInWithGoogleRedirect, signOutUser } from '../../services/auth.service.js';
import { getAuthState } from '../../state/auth.store.js';
import { renderAlert } from '../components/Alert.js';
import { renderBrandLogo } from '../components/BrandLogo.js';

const REDIRECT_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
]);

async function completeAdminLogin(user, navigate) {
  const adminProfile = await getAdminProfileByEmail(user?.email);

  if (!adminProfile?.active) {
    await signOutUser();
    throw new Error('Tài khoản Google này đã đăng nhập thành công nhưng chưa có quyền admin trong hệ thống.');
  }

  navigate('/admin/dashboard');
}

export const adminLoginPage = {
  title: 'Đăng nhập quản trị',
  async render() {
    return `
      <div class="login-layout">
        <div class="container py-5">
          <div class="row justify-content-center">
            <div class="col-12 col-md-8 col-lg-5">
              <div class="card border-0 shadow-lg">
                <div class="card-body p-4 p-lg-5">
                  <div class="mb-4">${renderBrandLogo({
                    className: 'login-brand-lockup',
                    tone: 'dark',
                    compact: true,
                  })}</div>
                  <h1 class="h3 mb-3">Đăng nhập Admin</h1>
                  <div id="admin-login-alert"></div>
                  <button type="button" id="admin-login-button" class="btn btn-dark w-100 py-3">
                    <i class="bi bi-google me-2"></i>Đăng nhập với Google
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },
  async mount({ navigate }) {
    const authState = getAuthState();

    if (authState.isAdmin) {
      navigate('/admin/dashboard');
      return;
    }

    const alertSlot = document.getElementById('admin-login-alert');
    const loginButton = document.getElementById('admin-login-button');

    try {
      const redirectResult = await resolveGoogleRedirectResult();

      if (redirectResult?.user) {
        await completeAdminLogin(redirectResult.user, navigate);
        return;
      }
    } catch (error) {
      alertSlot.innerHTML = renderAlert(error.message || 'Không thể hoàn tất phiên đăng nhập trước đó.', 'danger');
    }

    if (authState.user && !authState.isAdmin) {
      alertSlot.innerHTML = renderAlert(
        'Tài khoản của bạn đã đăng nhập vào Firebase nhưng chưa có quyền admin. Hãy kiểm tra collection admins.',
        'warning',
      );
    }

    loginButton.addEventListener('click', async () => {
      loginButton.disabled = true;
      loginButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang đăng nhập...';
      alertSlot.innerHTML = '';

      try {
        const result = await signInWithGoogle();
        await completeAdminLogin(result.user, navigate);
      } catch (error) {
        if (REDIRECT_FALLBACK_CODES.has(error?.code)) {
          alertSlot.innerHTML = renderAlert(
            'Trình duyệt đang chặn popup đăng nhập. Hệ thống sẽ chuyển sang đăng nhập bằng redirect.',
            'warning',
          );
          await signInWithGoogleRedirect();
          return;
        }

        alertSlot.innerHTML = renderAlert(error.message || 'Không thể đăng nhập bằng Google.', 'danger');
      } finally {
        loginButton.disabled = false;
        loginButton.innerHTML = '<i class="bi bi-google me-2"></i>Đăng nhập với Google';
      }
    });
  },
};
