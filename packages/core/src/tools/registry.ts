import type { Tool } from './types.js'

export class ToolRegistry {
  private tools = new Map<string, Tool>()

  register<I, O>(tool: Tool<I, O>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`)
    }
    this.tools.set(tool.name, tool as Tool)
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  list(): Tool[] {
    return [...this.tools.values()]
  }
}
