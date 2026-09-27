export * as InstructionContext from "./instruction-context"

export interface InstructionFile {
  path: string
  content: string
}

export function render(files: ReadonlyArray<InstructionFile>): string {
  return files.map((file) => `Instructions from: ${file.path}\n${file.content}`).join("\n\n")
}
