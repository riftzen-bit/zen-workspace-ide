export function normalizePath(value: string): string {
  return value.replace(/\\/g, '/')
}

export function basename(value: string): string {
  const normalized = normalizePath(value)
  const parts = normalized.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? normalized
}

export function dirname(value: string): string {
  const normalized = normalizePath(value)
  const parts = normalized.split('/')
  parts.pop()
  return parts.join('/') || '/'
}

export function joinPath(...parts: string[]): string {
  const normalized = parts
    .filter(Boolean)
    .map((part, index) => {
      const cleaned = normalizePath(part)
      if (index === 0) {
        return cleaned.replace(/\/+$/g, '')
      }
      return cleaned.replace(/^\/+/g, '').replace(/\/+$/g, '')
    })
    .filter(Boolean)
  return normalized.join('/').replace(/\/{2,}/g, '/')
}

export function extname(value: string): string {
  const name = basename(value)
  const dotIndex = name.lastIndexOf('.')
  return dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : ''
}

export function withoutExtension(value: string): string {
  const name = basename(value)
  const dotIndex = name.lastIndexOf('.')
  return dotIndex >= 0 ? name.slice(0, dotIndex) : name
}

export function toRelativePath(root: string | null | undefined, value: string): string {
  if (!root) return normalizePath(value)
  const normalizedRoot = normalizePath(root).replace(/\/+$/g, '')
  const normalizedValue = normalizePath(value)
  if (!normalizedValue.startsWith(normalizedRoot)) {
    return normalizedValue
  }
  return normalizedValue.slice(normalizedRoot.length).replace(/^\/+/g, '')
}

export function uniquePaths(values: string[]): string[] {
  return Array.from(new Set(values.map(normalizePath)))
}
