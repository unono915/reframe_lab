import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { TemplateRepository } from "../types";
import { templateRowToDomain } from "./mappers";

export function createSupabaseTemplateRepository(
  client: SupabaseClient<Database>,
): TemplateRepository {
  return {
    async listActiveTemplates() {
      const { data, error } = await client
        .from("training_templates")
        .select("*")
        .eq("active", true);
      if (error) throw error;
      return (data ?? []).map(templateRowToDomain);
    },
  };
}
