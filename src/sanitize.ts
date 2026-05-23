const INJECTION_PATTERNS: RegExp[] = [
  // Classic instruction override
  /ignore\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+instructions?/i,
  /disregard\s+(?:all\s+)?(?:previous|prior|above|earlier)/i,
  /forget\s+(?:everything|all\s+(?:previous|prior|the\s+above))/i,

  // Prompt delimiter tags — XML/template style used by most model providers
  /<\/?(?:system|instruction|inst|assistant|human)\b[^>]*>/i,
  /\[(?:SYSTEM|INST|INSTRUCTION|OVERRIDE)\]/,
  /<\|(?:im_start|im_end|endoftext)\|>/,

  // Persona hijacking
  /you\s+are\s+now\s+(?:an?\s+)?(?:different|new|another|free|unrestricted)/i,
  /act\s+as\s+(?:an?\s+)?(?:different|new|another|unrestricted|evil|unfiltered)/i,
  /pretend\s+(?:you\s+are|to\s+be)\s+(?:an?\s+)?(?:different|new|another|unrestricted)/i,

  // Explicit override commands
  /new\s+system\s+instructions?:/i,
  /(?:override|bypass)\s+(?:your\s+)?(?:previous\s+)?(?:safety\s+)?instructions?/i,
];

export interface RedactionResult {
  text: string;
  redactedLines: number[];
}

export function redactKnownInjectionPatterns(text: string): RedactionResult {
  const redactedLines: number[] = [];
  const lines = text.split("\n");
  const redacted = lines.map((line, i) => {
    if (INJECTION_PATTERNS.some((p) => p.test(line))) {
      redactedLines.push(i + 1);
      return `<!-- [redacted: potential prompt injection, line ${i + 1}] -->`;
    }
    return line;
  });
  return { text: redacted.join("\n"), redactedLines };
}

export function wrapUntrustedContent(text: string): string {
  const { text: redacted } = redactKnownInjectionPatterns(text);
  return `BEGIN_UNTRUSTED_GITHUB_CONTENT\n${redacted}\nEND_UNTRUSTED_GITHUB_CONTENT`;
}
