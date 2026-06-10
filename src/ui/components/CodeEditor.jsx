import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';

function editorFontTheme(fontSizePx) {
  return EditorView.theme({
    '&': { fontSize: `${fontSizePx}px` },
    '.cm-gutters': { fontSize: `${fontSizePx}px` },
    '.cm-content': { lineHeight: '1.55' },
  });
}

export function CodeEditor({
  value = '',
  onChange,
  readOnly = false,
  minHeight = '220px',
  placeholder = '',
  fontSize = 15,
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-600 ring-1 ring-slate-700/50">
      <CodeMirror
        value={value}
        height={minHeight}
        extensions={[python(), editorFontTheme(fontSize)]}
        theme={oneDark}
        onChange={(val) => onChange?.(val)}
        editable={!readOnly}
        placeholder={placeholder}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
          indentOnInput: true,
          bracketMatching: true,
          autocompletion: false,
        }}
      />
    </div>
  );
}
