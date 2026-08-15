/**
 * Supabase MCP `generate_typescript_types`로 생성. 수동 편집 금지 — 마이그레이션을
 * 추가하면 이 파일을 다시 생성한다. 단일 소스는 여전히 `domain/types.ts`이고, 이 파일은
 * 그 결과물이 실제 DB 스키마와 일치하는지 컴파일 타임에 검증하는 용도다.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      ai_feedbacks: {
        Row: {
          created_at: string;
          dimensions: Json;
          id: string;
          improvement_focus: string;
          is_stale: boolean;
          model: string;
          next_question: string;
          problem_definition_version_id: string;
          prompt_version: string;
          provider: string;
          schema_version: string;
          session_id: string;
          strength: string;
          unverified_assumption: string;
        };
        Insert: {
          created_at?: string;
          dimensions: Json;
          id?: string;
          improvement_focus: string;
          is_stale?: boolean;
          model: string;
          next_question: string;
          problem_definition_version_id: string;
          prompt_version: string;
          provider: string;
          schema_version: string;
          session_id: string;
          strength: string;
          unverified_assumption: string;
        };
        Update: {
          created_at?: string;
          dimensions?: Json;
          id?: string;
          improvement_focus?: string;
          is_stale?: boolean;
          model?: string;
          next_question?: string;
          problem_definition_version_id?: string;
          prompt_version?: string;
          provider?: string;
          schema_version?: string;
          session_id?: string;
          strength?: string;
          unverified_assumption?: string;
        };
        Relationships: [];
      };
      coach_interactions: {
        Row: {
          action: string;
          created_at: string;
          error_code: string | null;
          hint_level: number;
          id: string;
          is_stale: boolean;
          latency_ms: number;
          model: string;
          prompt_version: string;
          provider: string;
          schema_version: string;
          session_id: string;
          stage: string;
          status: string;
          validated_output: Json;
        };
        Insert: {
          action: string;
          created_at?: string;
          error_code?: string | null;
          hint_level?: number;
          id?: string;
          is_stale?: boolean;
          latency_ms: number;
          model: string;
          prompt_version: string;
          provider: string;
          schema_version: string;
          session_id: string;
          stage: string;
          status: string;
          validated_output: Json;
        };
        Update: {
          action?: string;
          created_at?: string;
          error_code?: string | null;
          hint_level?: number;
          id?: string;
          is_stale?: boolean;
          latency_ms?: number;
          model?: string;
          prompt_version?: string;
          provider?: string;
          schema_version?: string;
          session_id?: string;
          stage?: string;
          status?: string;
          validated_output?: Json;
        };
        Relationships: [];
      };
      observation_items: {
        Row: {
          author_type: string;
          id: string;
          item_order: number;
          observation_id: string;
          text: string;
          type: string;
          user_confirmed: boolean;
        };
        Insert: {
          author_type: string;
          id?: string;
          item_order?: number;
          observation_id: string;
          text: string;
          type: string;
          user_confirmed?: boolean;
        };
        Update: {
          author_type?: string;
          id?: string;
          item_order?: number;
          observation_id?: string;
          text?: string;
          type?: string;
          user_confirmed?: boolean;
        };
        Relationships: [];
      };
      observations: {
        Row: {
          context_when: string | null;
          context_where: string | null;
          created_at: string;
          id: string;
          raw_text: string;
          session_id: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          context_when?: string | null;
          context_where?: string | null;
          created_at?: string;
          id?: string;
          raw_text?: string;
          session_id: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          context_when?: string | null;
          context_where?: string | null;
          created_at?: string;
          id?: string;
          raw_text?: string;
          session_id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      perspectives: {
        Row: {
          author_type: string;
          content: string;
          created_at: string;
          id: string;
          lens_type: string;
          perspective_order: number;
          session_id: string;
          updated_at: string;
        };
        Insert: {
          author_type: string;
          content: string;
          created_at?: string;
          id?: string;
          lens_type: string;
          perspective_order?: number;
          session_id: string;
          updated_at?: string;
        };
        Update: {
          author_type?: string;
          content?: string;
          created_at?: string;
          id?: string;
          lens_type?: string;
          perspective_order?: number;
          session_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      problem_definition_versions: {
        Row: {
          author_type: string;
          based_on_feedback_id: string | null;
          change_reason: string | null;
          created_at: string;
          id: string;
          session_id: string;
          text: string;
          version_number: number;
        };
        Insert: {
          author_type: string;
          based_on_feedback_id?: string | null;
          change_reason?: string | null;
          created_at?: string;
          id?: string;
          session_id: string;
          text: string;
          version_number: number;
        };
        Update: {
          author_type?: string;
          based_on_feedback_id?: string | null;
          change_reason?: string | null;
          created_at?: string;
          id?: string;
          session_id?: string;
          text?: string;
          version_number?: number;
        };
        Relationships: [];
      };
      questions: {
        Row: {
          author_type: string;
          hint_level_used: number;
          id: string;
          is_priority: boolean;
          lens_type: string | null;
          priority_reason: string | null;
          question_order: number;
          session_id: string;
          text: string;
        };
        Insert: {
          author_type: string;
          hint_level_used?: number;
          id?: string;
          is_priority?: boolean;
          lens_type?: string | null;
          priority_reason?: string | null;
          question_order?: number;
          session_id: string;
          text: string;
        };
        Update: {
          author_type?: string;
          hint_level_used?: number;
          id?: string;
          is_priority?: boolean;
          lens_type?: string | null;
          priority_reason?: string | null;
          question_order?: number;
          session_id?: string;
          text?: string;
        };
        Relationships: [];
      };
      reframes: {
        Row: {
          author_type: string;
          id: string;
          lens_type: string | null;
          reframe_order: number;
          selected_elements: string[] | null;
          session_id: string;
          text: string;
        };
        Insert: {
          author_type: string;
          id?: string;
          lens_type?: string | null;
          reframe_order?: number;
          selected_elements?: string[] | null;
          session_id: string;
          text: string;
        };
        Update: {
          author_type?: string;
          id?: string;
          lens_type?: string | null;
          reframe_order?: number;
          selected_elements?: string[] | null;
          session_id?: string;
          text?: string;
        };
        Relationships: [];
      };
      session_events: {
        Row: {
          created_at: string;
          event_type: string;
          id: string;
          metadata: Json | null;
          session_id: string;
          stage: string;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          id?: string;
          metadata?: Json | null;
          session_id: string;
          stage: string;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: Json | null;
          session_id?: string;
          stage?: string;
        };
        Relationships: [];
      };
      stage_responses: {
        Row: {
          author_type: string;
          content: string;
          created_at: string;
          hint_level_used: number;
          id: string;
          is_draft: boolean;
          is_stale: boolean;
          prompt_key: string;
          session_id: string;
          stage: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          author_type: string;
          content?: string;
          created_at?: string;
          hint_level_used?: number;
          id?: string;
          is_draft?: boolean;
          is_stale?: boolean;
          prompt_key: string;
          session_id: string;
          stage: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          author_type?: string;
          content?: string;
          created_at?: string;
          hint_level_used?: number;
          id?: string;
          is_draft?: boolean;
          is_stale?: boolean;
          prompt_key?: string;
          session_id?: string;
          stage?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      training_sessions: {
        Row: {
          abandoned_at: string | null;
          ai_call_count: number;
          client_generated_id: string;
          completed_at: string | null;
          created_at: string;
          current_stage: string;
          id: string;
          last_active_at: string;
          last_active_stage: string | null;
          origin_session_id: string | null;
          started_at: string;
          state_version: number;
          status: string;
          template_id: string;
          timezone: string;
          training_date: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          abandoned_at?: string | null;
          ai_call_count?: number;
          client_generated_id: string;
          completed_at?: string | null;
          created_at?: string;
          current_stage: string;
          id?: string;
          last_active_at?: string;
          last_active_stage?: string | null;
          origin_session_id?: string | null;
          started_at?: string;
          state_version?: number;
          status: string;
          template_id: string;
          timezone: string;
          training_date: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          abandoned_at?: string | null;
          ai_call_count?: number;
          client_generated_id?: string;
          completed_at?: string | null;
          created_at?: string;
          current_stage?: string;
          id?: string;
          last_active_at?: string;
          last_active_stage?: string | null;
          origin_session_id?: string | null;
          started_at?: string;
          state_version?: number;
          status?: string;
          template_id?: string;
          timezone?: string;
          training_date?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      training_templates: {
        Row: {
          active: boolean;
          difficulty: number;
          id: string;
          lens_type: string;
          prompt: string;
          title: string;
          version: number;
        };
        Insert: {
          active?: boolean;
          difficulty: number;
          id: string;
          lens_type: string;
          prompt: string;
          title: string;
          version?: number;
        };
        Update: {
          active?: boolean;
          difficulty?: number;
          id?: string;
          lens_type?: string;
          prompt?: string;
          title?: string;
          version?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      save_training_session_snapshot: {
        Args: {
          p_ai_feedbacks: Json;
          p_coach_interactions: Json;
          p_observation: Json;
          p_observation_items: Json;
          p_perspectives: Json;
          p_problem_definition_versions: Json;
          p_questions: Json;
          p_reframes: Json;
          p_session: Json;
          p_stage_responses: Json;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
