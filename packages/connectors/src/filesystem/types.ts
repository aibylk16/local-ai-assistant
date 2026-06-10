export interface FileEntry {
  path: string
  size: number
  modifiedAt: string
  isDirectory: boolean
}

export interface FilesystemConnector {
  id: 'filesystem'
  ready(): Promise<boolean>
  listDir(path: string): Promise<FileEntry[]>
  readText(path: string): Promise<string>
  /** REQUIRES file.write permission upstream AND a confirmation modal for any delete or overwrite. */
  writeText(path: string, content: string): Promise<{ ok: boolean }>
}
