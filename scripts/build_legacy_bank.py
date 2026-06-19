"""Generate showdownLegacyBank.js from extracted old matrix (no turtle)."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEGACY_SRC = ROOT / "src" / "data" / "showdownMatrixBankLegacy.js"
OUT = ROOT / "src" / "data" / "showdownLegacyBank.js"

TURTLE_RE = re.compile(
    r"turtle|t\.(?:forward|left|right|circle|pen(?:up|down|color)?|fd|lt|rt|pu|pd|color|home|speed)"
    r"|penup|pendown|pencolor|bgcolor|rùa",
    re.I,
)


def is_turtle_text(text: str) -> bool:
    return bool(TURTLE_RE.search(text))


def extract_rows(source: str, name: str) -> list[str]:
    match = re.search(rf"const {name} = \[(.*?)\]\.map", source, re.S)
    if not match:
        return []
    return [
        line.strip().rstrip(",")
        for line in match.group(1).strip().splitlines()
        if line.strip().startswith("[")
    ]


def renumber_rows(rows: list[str], id_prefix: str) -> list[str]:
    out = []
    for index, row in enumerate(rows, start=1):
        out.append(re.sub(r"\['[^']+'", f"['{id_prefix}{index:02d}'", row, count=1))
    return out


def main():
    legacy = LEGACY_SRC.read_text(encoding="utf-8")
    r1_rows = [r for r in extract_rows(legacy, "R1") if not is_turtle_text(r)]
    r2_rows = [r for r in extract_rows(legacy, "R2") if not is_turtle_text(r)]
    r1 = "\n".join(f"  {row}," for row in renumber_rows(r1_rows, "R1-L"))
    r2 = "\n".join(f"  {row}," for row in renumber_rows(r2_rows, "R2-L"))

    removed_r1 = len(extract_rows(legacy, "R1")) - len(r1_rows)
    removed_r2 = len(extract_rows(legacy, "R2")) - len(r2_rows)

    content = f"""/**
 * Bộ đề cũ (ma trận gốc MindX) — gộp vào kho chính (đã loại câu turtle).
 * {len(r1_rows)} câu vấn đáp · {len(r2_rows)} câu chướng ngại
 */

const LEGACY_R1 = [
{r1}
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

const LEGACY_R2 = [
{r2}
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

export {{ LEGACY_R1, LEGACY_R2 }};
"""
    OUT.write_text(content, encoding="utf-8")
    print(f"R1 legacy: {len(r1_rows)} (removed {removed_r1} turtle)")
    print(f"R2 legacy: {len(r2_rows)} (removed {removed_r2} turtle)")
    print(f"written {OUT}")


if __name__ == "__main__":
    main()
