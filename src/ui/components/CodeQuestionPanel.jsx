import { useState } from 'react';
import { Maximize2, Minimize2, Play, Terminal } from 'lucide-react';
import { CodeEditor } from './CodeEditor.jsx';
import { Button } from './Button.jsx';
import { Modal } from './Modal.jsx';
import { runPythonCode } from '../../lib/pythonRunner.js';

function OutputPanel({ output, error, running, tall = false }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
      <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2 text-xs font-medium text-slate-400">
        <Terminal className="h-3.5 w-3.5" />
        Kết quả chạy thử
      </div>
      <pre
        className={`overflow-auto p-3 font-mono leading-relaxed ${
          tall ? 'max-h-56 text-sm sm:max-h-72 sm:text-base' : 'max-h-40 text-sm sm:max-h-52'
        } ${error ? 'text-red-400' : 'text-emerald-400'}`}
      >
        {running ? 'Đang chạy...' : error || output || 'Bấm "Chạy thử" để xem kết quả.'}
      </pre>
    </div>
  );
}

function EditorToolbar({ onRun, onToggleExpand, expanded, running, runStatus }) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={onRun} loading={running} disabled={running}>
          <Play className="h-4 w-4" />
          Chạy thử
        </Button>
        {runStatus && !running && (
          <span className="text-xs text-slate-400">{runStatus}</span>
        )}
      </div>
      <button
        type="button"
        onClick={onToggleExpand}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        {expanded ? (
          <>
            <Minimize2 className="h-3.5 w-3.5" />
            Thu nhỏ
          </>
        ) : (
          <>
            <Maximize2 className="h-3.5 w-3.5" />
            Phóng to
          </>
        )}
      </button>
    </div>
  );
}

export function CodeQuestionPanel({
  value = '',
  onChange,
  placeholder = '# Viết code Python tại đây...',
  editorHeight = '320px',
  expandedHeight = 'min(52vh, 480px)',
}) {
  const [expanded, setExpanded] = useState(false);
  const [running, setRunning] = useState(false);
  const [runStatus, setRunStatus] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setOutput('');
    setRunStatus('');
    try {
      const result = await runPythonCode(value, {
        onProgress: (msg) => setRunStatus(msg),
      });
      setOutput(result.output);
      setError(result.error);
      setRunStatus('');
    } catch (err) {
      setError(err.message || 'Lỗi khi chạy code.');
      setRunStatus('');
    } finally {
      setRunning(false);
    }
  };

  const workspace = (height, isExpanded) => (
    <div className="space-y-3">
      <EditorToolbar
        onRun={handleRun}
        onToggleExpand={() => setExpanded((v) => !v)}
        expanded={isExpanded}
        running={running}
        runStatus={runStatus}
      />
      <CodeEditor
        value={value}
        onChange={onChange}
        minHeight={height}
        placeholder={placeholder}
        fontSize={isExpanded ? 18 : 15}
      />
      <OutputPanel output={output} error={error} running={running} tall={isExpanded} />
      {!isExpanded && (
        <p className="text-xs text-slate-400">
          Chạy thử chỉ để kiểm tra — không ảnh hưởng điểm. Hỗ trợ{' '}
          <code className="text-slate-500">print()</code> và Python cơ bản.
        </p>
      )}
    </div>
  );

  if (expanded) {
    return (
      <>
        <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800/40">
          <span>Đang soạn ở chế độ phóng to</span>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="font-medium text-brand-600 hover:underline dark:text-brand-300"
          >
            Thu nhỏ
          </button>
        </div>
        <Modal
          open
          onClose={() => setExpanded(false)}
          title="Soạn & chạy thử code"
          size="full"
        >
          <div className="overflow-y-auto">{workspace(expandedHeight, true)}</div>
        </Modal>
      </>
    );
  }

  return workspace(editorHeight, false);
}
