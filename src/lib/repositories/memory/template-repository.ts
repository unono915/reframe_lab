import { DAILY_TEMPLATES } from "@/data/templates";
import type { TemplateRepository } from "../types";

export function createMemoryTemplateRepository(): TemplateRepository {
  return {
    async listActiveTemplates() {
      return DAILY_TEMPLATES.filter((t) => t.active);
    },
  };
}
