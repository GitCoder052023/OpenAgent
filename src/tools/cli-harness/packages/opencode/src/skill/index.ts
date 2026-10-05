export interface Info {
  readonly name: string
  readonly description?: string
  readonly location: string
  readonly content: string
}

export function fmt(skills: ReadonlyArray<Info>, options?: { verbose?: boolean }): string {
  if (skills.length === 0) return "<available_skills>\n</available_skills>"
  return [
    "<available_skills>",
    ...skills.flatMap((s) => [
      "  <skill>",
      `    <name>${s.name}</name>`,
      ...(s.description ? [`    <description>${s.description}</description>`] : []),
      ...(options?.verbose ? [`    <location>${s.location}</location>`] : []),
      "  </skill>",
    ]),
    "</available_skills>",
  ].join("\n")
}

export * as Skill from "./index"
