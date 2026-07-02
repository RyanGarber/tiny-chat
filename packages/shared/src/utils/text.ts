function parseAttrs(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([\w-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(attrString)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function parseDirectiveAttrs(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([\w-]+)=([^\s}]+)/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(attrString)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function attrsToDirectiveString(attrs: Record<string, string>): string {
  const entries = Object.entries(attrs);
  if (!entries.length) return '';
  return `{${entries.map(([k, v]) => (v.includes(' ') ? `${k}="${v}"` : `${k}=${v}`)).join(' ')}}`;
}

function attrsToXmlString(attrs: Record<string, string>): string {
  return Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Given a string and a tag name, finds the closing tag that matches the
 * opening tag ending at `searchFrom`, accounting for nested same-name tags.
 */
function findMatchingClose(
  str: string,
  tagName: string,
  searchFrom: number,
): { closeStart: number; closeEnd: number } | null {
  const escapedName = escapeRegex(tagName);
  const tagRegex = new RegExp(`<${escapedName}(?:\\s[^>]*)?>|<\\/${escapedName}>`, 'g');
  tagRegex.lastIndex = searchFrom;

  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(str)) !== null) {
    if (match[0].startsWith('</')) {
      depth--;
      if (depth === 0) {
        return { closeStart: match.index, closeEnd: tagRegex.lastIndex };
      }
    } else {
      depth++;
    }
  }
  return null;
}

/**
 * Replaces <tag attr="val">Content</tag> with a directive, choosing the form based on
 * whether the content spans multiple lines:
 *   - Single line (inline): :tag[Content]{attr=val} — a remark-directive text directive.
 *   - Multi-line (block): :::tag{attr=val}\nContent\n::: — a container directive. Handles
 *     nesting: each level of depth adds one extra colon to the fence, per remark-directive
 *     convention.
 * Only tags whose name is in `allowedTags` are converted.
 */
export function xmlToDirective(input: string, allowedTags: string[], depth = 0): string {
  if (!allowedTags.length) return input;

  const tagAlternation = allowedTags.map(escapeRegex).join('|');
  const openTagRegex = new RegExp(`<(${tagAlternation})((?:\\s+[\\w-]+="[^"]*")*)\\s*>`, 'g');

  let result = '';
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = openTagRegex.exec(input)) !== null) {
    const [fullMatch, tag, attrString] = match;
    const openStart = match.index;
    const openEnd = openStart + fullMatch.length;

    const closeInfo = findMatchingClose(input, tag, openEnd);
    if (!closeInfo) {
      // No matching close tag — leave it alone and keep scanning past it.
      continue;
    }

    result += input.slice(cursor, openStart);

    const innerContent = input.slice(openEnd, closeInfo.closeStart).trim();
    const attrPart = attrsToDirectiveString(parseAttrs(attrString));
    const isBlock = innerContent.includes('\n');

    if (isBlock) {
      const convertedInner = xmlToDirective(innerContent, allowedTags, depth + 1);
      const fence = ':'.repeat(3 + depth);
      result += `${fence}${tag}${attrPart}\n${convertedInner.trim()}\n${fence}`;
    } else {
      const convertedInner = xmlToDirective(innerContent, allowedTags, depth);
      result += `:${tag}[${convertedInner}]${attrPart}`;
    }

    cursor = closeInfo.closeEnd;
    openTagRegex.lastIndex = cursor;
  }

  result += input.slice(cursor);
  return result;
}

/**
 * Replaces both directive forms with their XML equivalent:
 *   - :tag[Content]{attr=val} (text directive) -> <tag attr="val">Content</tag>
 *   - :::tag{attr=val}\nContent\n::: (container directive) -> <tag attr="val">\nContent\n</tag>
 * Only directives whose name is in `allowedTags` are converted; everything else is left as-is.
 */
export function directiveToXml(input: string, allowedTags: string[]): string {
  if (!allowedTags.length) return input;

  const tagAlternation = allowedTags.map(escapeRegex).join('|');
  const directiveRegex = new RegExp(
    `^(:::)(${tagAlternation})(?:\\{([^}]*)\\})?([\\s\\S]*?)\\1` +
      `|(::|:)(${tagAlternation})\\[([^\\]]*)\\](?:\\{([^}]*)\\})?`,
    'gm',
  );

  return input.replace(
    directiveRegex,
    (
      _full: string,
      _blockMarker: string,
      blockTag: string | undefined,
      blockAttrString: string | undefined,
      blockContent: string | undefined,
      _inlineMarker: string | undefined,
      inlineTag: string | undefined,
      inlineContent: string | undefined,
      inlineAttrString: string | undefined,
    ) => {
      const tag = blockTag ?? inlineTag;
      const attrString = blockTag ? blockAttrString : inlineAttrString;
      const content = blockTag ? (blockContent ?? '') : (inlineContent ?? '');

      const attrs = attrString ? parseDirectiveAttrs(attrString) : {};
      const attrPart = attrsToXmlString(attrs);
      return `<${tag}${attrPart}>${directiveToXml(content, allowedTags)}</${tag}>`;
    },
  );
}
