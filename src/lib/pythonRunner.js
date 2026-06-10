const PYODIDE_VERSION = '0.26.4';
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let pyodideReady = null;

function loadPyodideScript() {
  return new Promise((resolve, reject) => {
    if (window.loadPyodide) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[data-pyodide]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Không tải được Python runner.')));
      return;
    }
    const script = document.createElement('script');
    script.src = `${PYODIDE_BASE}pyodide.js`;
    script.dataset.pyodide = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không tải được Python runner.'));
    document.head.appendChild(script);
  });
}

export async function ensurePyodide(onProgress) {
  if (!pyodideReady) {
    pyodideReady = (async () => {
      onProgress?.('Đang tải Python...');
      await loadPyodideScript();
      const pyodide = await window.loadPyodide({ indexURL: PYODIDE_BASE });
      onProgress?.('Sẵn sàng.');
      return pyodide;
    })();
  }
  return pyodideReady;
}

export async function runPythonCode(code, { timeoutMs = 8000, onProgress } = {}) {
  const pyodide = await ensurePyodide(onProgress);
  pyodide.globals.set('_user_code', code);

  const runTask = pyodide.runPythonAsync(`
import sys
from io import StringIO

_buf = StringIO()
sys.stdout = _buf
sys.stderr = _buf
_err = None
try:
    exec(_user_code, {"__name__": "__main__"})
except Exception as e:
    _err = f"{type(e).__name__}: {e}"
    print(_err)
_out = _buf.getvalue()
`);

  const timeoutTask = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Hết thời gian chạy (tối đa 8 giây).')), timeoutMs);
  });

  await Promise.race([runTask, timeoutTask]);

  const output = pyodide.globals.get('_out') ?? '';
  const errFlag = pyodide.globals.get('_err');
  const text = String(output).trimEnd();
  return {
    output: text || '(chương trình chạy xong — không có output)',
    error: errFlag ? String(errFlag) : null,
  };
}
