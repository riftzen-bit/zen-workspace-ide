import type { CodeSnippet } from '../types'

const PLACEHOLDER_PATTERN = /\$\{([a-zA-Z0-9_]+)\}/g

export function extractSnippetPlaceholders(body: string): string[] {
  const placeholders = new Set<string>()
  for (const match of body.matchAll(PLACEHOLDER_PATTERN)) {
    placeholders.add(match[1])
  }
  return Array.from(placeholders)
}

export function resolveSnippetBody(
  snippet: Pick<CodeSnippet, 'body' | 'placeholders'>,
  values: Record<string, string>
): string {
  return snippet.body.replace(PLACEHOLDER_PATTERN, (_, key: string) => values[key] ?? key)
}
