import { Component } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button.jsx';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info?.componentStack);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const { title = 'Đã xảy ra lỗi', homeTo = '/', variant = 'default' } = this.props;
      const isStudent = variant === 'student';

      return (
        <div
          className={
            isStudent
              ? 'student-portal flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50/40 via-slate-50 to-slate-50 px-4 py-10 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950'
              : 'flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950'
          }
        >
          <div className="card max-w-md p-6 text-center sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Trang gặp sự cố tạm thời. Bạn có thể tải lại trang hoặc quay về trang chủ.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button onClick={this.handleReload} className="min-h-12">
                <RefreshCw className="h-4 w-4" />
                Tải lại trang
              </Button>
              <Link to={homeTo} className="inline-flex">
                <Button variant="secondary" className="min-h-12 w-full sm:w-auto" onClick={this.handleReset}>
                  {isStudent ? 'Về trang nhập mã lớp' : 'Về trang chủ'}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
