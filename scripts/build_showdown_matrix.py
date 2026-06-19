"""Build full showdownMatrixBank.js (R1 + R2 + R3) from extracted docx text."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TXT = ROOT / "showdown_matrix_new.txt"
BANK = ROOT / "src" / "data" / "showdownMatrixBank.js"

TURTLE_RE = re.compile(
    r"turtle|t\.(?:forward|left|right|circle|pen(?:up|down|color)?|fd|lt|rt|pu|pd|color|home|speed)"
    r"|penup|pendown|pencolor|bgcolor|rùa",
    re.I,
)


def is_turtle_question(*fields) -> bool:
    return bool(TURTLE_RE.search(" ".join(str(f) for f in fields)))

R1_TOPIC_MAP = {
    "Print": "io",
    "Input": "io",
    "Output": "io",
    "Print/Input": "io",
    "Variable": "variables",
    "Data Type": "variables",
    "Type Cast": "variables",
    "Type": "variables",
    "Math": "operators",
    "Operator": "operators",
    "If": "conditionals",
    "If/Else": "conditionals",
    "If/Elif": "conditionals",
    "Loop": "loops",
    "While": "loops",
    "Range": "loops",
    "List": "lists",
    "String": "strings",
    "Function": "functions",
    "Debug": "debug",
    "Syntax": "custom",
    "Mixed": "custom",
    "Logic": "conditionals",
}

R3_TOPIC_MAP = {
    **R1_TOPIC_MAP,
    "If/Loop": "conditionals",
    "Nested Loop": "loops",
    "String/List": "strings",
    "Function/Mixed": "functions",
    "Input/Loop": "io",
    "Math/Loop": "loops",
    "Loop/List": "lists",
    "Game Logic": "custom",
    "Time": "operators",
    "Project Mini": "custom",
}

R2_TYPE_TOPIC = {
    "Syntax Error": "debug",
    "Indentation": "debug",
    "Type Error": "debug",
    "Loop Debug": "loops",
    "List Debug": "lists",
    "List Logic": "lists",
    "Algorithm": "loops",
    "Debug": "debug",
    "Predict Output": "output",
    "Logic": "conditionals",
    "List": "lists",
    "String": "strings",
    "Function": "functions",
}

R2_CODE_TYPES = {
    "Syntax Error",
    "Indentation",
    "Type Error",
    "Loop Debug",
    "List Debug",
    "List Logic",
    "Algorithm",
    "Debug",
}

DIFFICULTY_MAP = {
    "Easy": "easy",
    "Medium": "medium",
    "Hard": "hard",
}

STMT_KEYWORDS = (
    "print",
    "if ",
    "for ",
    "while ",
    "def ",
    "else:",
    "elif ",
    "return ",
    "import ",
)


def _in_string_at(code: str, i: int) -> bool:
    in_str = False
    quote = ""
    j = 0
    while j < i:
        ch = code[j]
        if not in_str and ch in "\"'":
            in_str = True
            quote = ch
            j += 1
            continue
        if in_str:
            if ch == "\\":
                j += 2
                continue
            if ch == quote:
                in_str = False
            j += 1
            continue
        j += 1
    return in_str


def _insert_newline_before(out: list[str]) -> None:
    if not out or out[-1] != "\n":
        out.append("\n")


def split_jammed_code(code: str) -> str:
    out: list[str] = []
    i = 0
    n = len(code)
    while i < n:
        ch = code[i]
        if ch in "\"'":
            quote = ch
            start = i
            i += 1
            while i < n:
                if code[i] == "\\":
                    i += 2
                    continue
                if code[i] == quote:
                    i += 1
                    break
                i += 1
            out.append(code[start:i])
            continue

        if not _in_string_at(code, i):
            if i > 0 and code[i - 1] == ":" and (code[i].isalpha() or code[i] in "_#"):
                _insert_newline_before(out)
            elif i > 0 and code[i - 1] in ")]" and (code[i].isalpha() or code[i] in "_#"):
                _insert_newline_before(out)
            elif i > 0 and code[i - 1].isdigit() and re.match(r"[a-zA-Z_]+\s*=", code[i:]):
                _insert_newline_before(out)
            elif i > 0 and code[i - 1].isalnum() and code.startswith("print", i):
                _insert_newline_before(out)
            elif (i == 0 or not code[i - 1].isalpha()) and any(
                code.startswith(kw, i) for kw in STMT_KEYWORDS
            ):
                _insert_newline_before(out)

        out.append(ch)
        i += 1
    return "".join(out)


def format_code(code: str) -> str:
    code = code.strip()
    if not code:
        return ""

    elif_token = "__ELIF__"
    code = code.replace("elif", elif_token)
    code = re.sub(r"    +", "\n    ", code)
    code = split_jammed_code(code)
    code = code.replace(elif_token, "elif")
    code = split_jammed_code(code)

    raw_lines = [ln.rstrip() for ln in code.split("\n") if ln.strip()]
    out: list[str] = []
    for line in raw_lines:
        content = line.lstrip()
        leading = line[: len(line) - len(content)]
        if leading:
            out.append(line)
        elif (
            out
            and out[-1].rstrip().endswith(":")
            and not content.startswith(("elif ", "else:"))
        ):
            out.append("    " + content)
        else:
            out.append(content)
    return "\n".join(out)


def format_prompt(text: str) -> str:
    text = text.strip()
    if not text:
        return text
    code_markers = ("if ", "for ", "while ", "print", "def ", "input", "import ", " = ")
    qm = re.match(r"^(.*?[?？])(.+)$", text, re.S)
    if qm and any(m in qm.group(2) for m in code_markers):
        return f"{qm.group(1).strip()}\n{format_code(qm.group(2))}"
    if re.search(r"[A-D]\.", text):
        return re.sub(r"(?<=[A-D]\.)", "\n", text).strip()
    for sep in (":",):
        if sep in text:
            idx = text.index(sep)
            label = text[: idx + 1].strip()
            rest = text[idx + 1 :].strip()
            if rest and any(m in rest for m in code_markers):
                return f"{label}\n{format_code(rest)}"
    if any(m in text for m in code_markers):
        return format_code(text)
    return text


def format_r2_prompt(type_raw: str, text: str) -> str:
    """Format obstacle prompt — keep buggy code as-is for debug items."""
    text = text.strip()
    if type_raw == "Algorithm":
        m = re.match(r"^(.*?):([A-D]\..*)", text, re.S)
        if m:
            items = re.sub(r"(?<=[^\n])(?=[A-D]\.)", "\n", m.group(2).strip())
            return f"{m.group(1).strip()}:\n{items}"
        return re.sub(r"(?<=[^\n])(?=[A-D]\.)", "\n", text)
    if type_raw in R2_CODE_TYPES:
        qm = re.match(r"^(.*?[?：:])(.+)$", text, re.S)
        if qm:
            body = split_jammed_code(qm.group(2).strip())
            return f"{qm.group(1).strip()}\n{body}"
        cm = re.match(r"^(Tìm lỗi sai:)(.+)$", text, re.S)
        if cm:
            return f"{cm.group(1)}\n{split_jammed_code(cm.group(2).strip())}"
        return split_jammed_code(text)
    return format_prompt(text)


def js_escape_template(s: str) -> str:
    return s.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


def slug_topic(raw: str, mapping: dict) -> str:
    return mapping.get(
        raw,
        raw.lower().replace("/", "_").replace(" ", "_"),
    )


def parse_r1(lines: list[str]) -> list[tuple]:
    questions = []
    i = 0
    while i < len(lines):
        m = re.match(r"^R1-(\d+)$", lines[i].strip())
        if m:
            qid = lines[i].strip()
            topic_raw = lines[i + 1].strip()
            prompt = lines[i + 2].strip()
            answer = lines[i + 3].strip()
            diff_raw = lines[i + 4].strip()
            questions.append(
                (
                    qid,
                    slug_topic(topic_raw, R1_TOPIC_MAP),
                    prompt,
                    answer,
                    DIFFICULTY_MAP.get(diff_raw, diff_raw.lower()),
                )
            )
            i += 5
            continue
        if lines[i].strip().startswith("R2-"):
            break
        i += 1
    return questions


def parse_r2(lines: list[str]) -> list[tuple]:
    questions = []
    i = 0
    while i < len(lines):
        m = re.match(r"^R2-(\d+)$", lines[i].strip())
        if m:
            qid = lines[i].strip()
            type_raw = lines[i + 1].strip()
            prompt = format_r2_prompt(type_raw, lines[i + 2].strip())
            answer = lines[i + 3].strip()
            qtype = "code" if type_raw in R2_CODE_TYPES else "short_answer"
            topic = R2_TYPE_TOPIC.get(type_raw, "custom")
            questions.append((qid, topic, qtype, prompt, answer))
            i += 4
            continue
        if re.match(r"^R3-", lines[i].strip()):
            break
        i += 1
    return questions


def parse_r3(lines: list[str]) -> list[tuple]:
    questions = []
    i = 0
    while i < len(lines):
        m = re.match(r"^R3-(E|M|H)-(\d+)$", lines[i].strip())
        if m:
            diff_key = {"E": "easy", "M": "medium", "H": "hard"}[m.group(1)]
            qid = lines[i].strip()
            topic_raw = lines[i + 1].strip()
            prompt = lines[i + 2].strip()
            sol = format_code(lines[i + 3].strip())
            questions.append(
                (
                    qid,
                    slug_topic(topic_raw, R3_TOPIC_MAP),
                    diff_key,
                    prompt,
                    sol,
                )
            )
            i += 4
            continue
        i += 1
    return questions


def build_bank_file(r1: list, r2: list, r3: list) -> str:
    r1_rows = []
    for qid, topic, prompt, answer, diff in r1:
        r1_rows.append(
            f"  ['{qid}', '{topic}', `{js_escape_template(prompt)}`, "
            f"`{js_escape_template(answer)}`, '{diff}'],"
        )

    r2_rows = []
    for qid, topic, qtype, prompt, answer in r2:
        r2_rows.append(
            f"  ['{qid}', '{topic}', '{qtype}', `{js_escape_template(prompt)}`, "
            f"`{js_escape_template(answer)}`],"
        )

    r3_rows = []
    for qid, topic, diff, prompt, sol in r3:
        r3_rows.append(
            f"  ['{qid}', '{topic}', '{diff}', `{js_escape_template(prompt)}`, "
            f"`{js_escape_template(sol)}`],"
        )

    return f"""/**
 * Coding Showdown — Python Basic (ma trận thầy Hưng + bộ cũ).
 * Nguồn: Ma_tran_de_Coding_Showdown_Python_Basic.docx + ma trận gốc MindX (không turtle).
 *
 * Vòng 1: 80 câu mới + 71 câu cũ (R1-Lxx, không turtle) = 151 câu vấn đáp.
 * Vòng 2: 20 câu mới + 19 câu cũ (R2-Lxx, không turtle) = 39 câu chướng ngại.
 * Vòng 3: 120 câu viết code (GV chấm).
 */
import {{ LEGACY_R1, LEGACY_R2 }} from './showdownLegacyBank.js';

const R1 = [
{chr(10).join(r1_rows)}
].map(([id, topic, prompt, correctAnswer, difficulty]) => ({{
  id: `sd-${{id}}`,
  subject: 'Python',
  level: 'Basic',
  topic,
  round: 'startup',
  bankRound: 'startup',
  difficulty,
  questionType: 'oral',
  prompt,
  codeSnippet: null,
  options: [],
  correctAnswer,
  correctIndex: null,
  starterCode: '',
  referenceSolution: '',
  explanation: '',
  timeLimitSeconds: 5,
  points: 10,
}}));

const R2 = [
{chr(10).join(r2_rows)}
].map(([id, topic, questionType, prompt, ans]) => ({{
  id: `sd-${{id}}`,
  subject: 'Python',
  level: 'Basic',
  topic,
  round: 'obstacle',
  bankRound: 'acceleration',
  difficulty: 'medium',
  questionType,
  prompt,
  codeSnippet: null,
  options: [],
  correctAnswer: questionType === 'short_answer' ? ans : '',
  correctIndex: null,
  starterCode: '',
  referenceSolution: questionType === 'code' ? ans : '',
  explanation: '',
  timeLimitSeconds: 25,
  points: 20,
}}));

const R3 = [
{chr(10).join(r3_rows)}
].map(([id, topic, difficulty, prompt, sol]) => ({{
  id: `sd-${{id}}`,
  subject: 'Python',
  level: 'Basic',
  topic,
  round: 'finish',
  bankRound: 'finish',
  difficulty,
  questionType: 'code',
  prompt,
  codeSnippet: null,
  options: [],
  correctAnswer: '',
  correctIndex: null,
  starterCode: '',
  referenceSolution: sol,
  explanation: '',
  timeLimitSeconds: difficulty === 'easy' ? 20 : difficulty === 'medium' ? 60 : 120,
  points: difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 30,
}}));

export const SHOWDOWN_MATRIX_BANK = [...R1, ...LEGACY_R1, ...R2, ...LEGACY_R2, ...R3];
"""


def main():
    lines = TXT.read_text(encoding="utf-8").splitlines()
    r1 = [q for q in parse_r1(lines) if not is_turtle_question(*q[2:4], q[1])]
    r2 = [q for q in parse_r2(lines) if not is_turtle_question(*q[3:5], q[1], q[2])]
    r3 = [q for q in parse_r3(lines) if not is_turtle_question(*q[3:5], q[1], q[2])]
    print(f"parsed R1={len(r1)} R2={len(r2)} R3={len(r3)}")
    if len(r1) != 80 or len(r2) != 20 or len(r3) != 120:
        raise SystemExit(
            f"expected 80/20/120, got {len(r1)}/{len(r2)}/{len(r3)}"
        )

    BANK.write_text(build_bank_file(r1, r2, r3), encoding="utf-8")
    print(f"written {BANK}")


if __name__ == "__main__":
    main()
