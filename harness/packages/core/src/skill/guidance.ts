export * as SkillGuidance from "./guidance"

export interface SkillSummary {
  name: string
  description: string
}

export const render = (skills: ReadonlyArray<SkillSummary>) =>
  [
    "Skills provide specialized instructions and workflows for specific tasks.",
    "Use the skill tool to load a skill when a task matches its description.",
    ...(skills.length === 0
      ? ["No skills are currently available."]
      : [
          "<available_skills>",
          ...skills.flatMap((skill) => [
            "  <skill>",
            `    <name>${skill.name}</name>`,
            `    <description>${skill.description}</description>`,
            "  </skill>",
          ]),
          "</available_skills>",
        ]),
  ].join("\n")
