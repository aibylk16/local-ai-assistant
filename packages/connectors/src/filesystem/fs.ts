import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { FileEntry, FilesystemConnector } from './types.js'

/**
 * Local filesystem connector. Permission gating is the caller's job —
 * the agent orchestrator must have already verified `file.read` for read
 * methods and `file.write` for write methods.
 *
 * `writeText` is intentionally non-destructive: it refuses to overwrite an
 * existing file. The renderer must show a confirmation modal and pass an
 * explicit `overwrite: true` (via a future API) when the user really means it.
 */
export class LocalFilesystemConnector implements FilesystemConnector {
  id = 'filesystem' as const

  async ready(): Promise<boolean> {
    return true
  }

  async listDir(target: string): Promise<FileEntry[]> {
    const entries = await fs.readdir(target, { withFileTypes: true })
    const stats = await Promise.all(
      entries.map(async (e) => {
        const full = path.join(target, e.name)
        const s = await fs.stat(full)
        return {
          path: full,
          size: s.size,
          modifiedAt: s.mtime.toISOString(),
          isDirectory: e.isDirectory(),
        } satisfies FileEntry
      }),
    )
    return stats
  }

  async readText(target: string): Promise<string> {
    return fs.readFile(target, 'utf8')
  }

  async writeText(target: string, content: string): Promise<{ ok: boolean }> {
    try {
      await fs.access(target)
      throw new Error(
        `Refusing to overwrite existing file without explicit user confirmation: ${target}`,
      )
    } catch (e: unknown) {
      // ENOENT => safe to write
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'ENOENT') {
        await fs.writeFile(target, content, 'utf8')
        return { ok: true }
      }
      throw e
    }
  }
}
