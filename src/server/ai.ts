// コミットから AI の関与を判定する

type Rule = { id: string; name: string; pattern: RegExp };

// Co-authored-by の名前・メール、または作者名にマッチさせる
const RULES: Rule[] = [
  { id: 'claude', name: 'Claude', pattern: /claude|anthropic/i },
  { id: 'copilot', name: 'GitHub Copilot', pattern: /copilot/i },
  { id: 'cursor', name: 'Cursor', pattern: /cursor/i },
  { id: 'devin', name: 'Devin', pattern: /devin/i },
  { id: 'codex', name: 'Codex', pattern: /codex|openai|chatgpt/i },
  { id: 'gemini', name: 'Gemini', pattern: /gemini|google-labs-jules|\bjules\b/i },
  { id: 'aider', name: 'Aider', pattern: /\baider\b/i },
  { id: 'amp', name: 'Amp', pattern: /ampcode/i },
  { id: 'windsurf', name: 'Windsurf', pattern: /windsurf|codeium/i },
  { id: 'junie', name: 'Junie', pattern: /junie/i },
];

const TOOL_NAMES = new Map(RULES.map((r) => [r.id, r.name]));

const CO_AUTHOR = /^co-authored-by:\s*(.*)$/gim;
const GENERATED = /generated with \[?claude code/i;

function matchTool(text: string) {
  return RULES.find((r) => r.pattern.test(text))?.id ?? null;
}

export function toolName(id: string) {
  return TOOL_NAMES.get(id) ?? id;
}

export function isBotName(name: string, email: string) {
  return /\[bot\]/i.test(name) || /\[bot\]/i.test(email);
}

/** 作者そのものが AI エージェントなら、そのツール ID を返す */
export function aiAuthor(name: string, email: string) {
  if (!isBotName(name, email) && !/^copilot$/i.test(name)) return null;
  return matchTool(`${name} ${email}`);
}

/** コミットメッセージのトレーラーから、共著した AI ツール ID を返す */
export function aiCoAuthor(message: string, authorName = '') {
  // aider は作者名に "(aider)" を付ける
  if (/\(aider\)/i.test(authorName)) return 'aider';
  for (const m of message.matchAll(CO_AUTHOR)) {
    const tool = matchTool(m[1]);
    if (tool) return tool;
  }
  return GENERATED.test(message) ? 'claude' : null;
}
