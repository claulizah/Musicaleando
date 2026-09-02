// Mirrors the Supabase project schema (ijwyykfuyeaahvxmaild).
// Regenerate with the Supabase MCP `generate_typescript_types` tool after schema changes.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      mood_logs: {
        Row: {
          fecha: string
          id: string
          mood: string
          user_id: string
        }
        Insert: {
          fecha?: string
          id?: string
          mood: string
          user_id: string
        }
        Update: {
          fecha?: string
          id?: string
          mood?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mood_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      music_profile: {
        Row: {
          arquetipo: string | null
          energia: number
          flavor: Json
          generos: Json
          guilty_pleasures: Json
          origen: string
          social: string
          updated_at: string
          user_id: string
        }
        Insert: {
          arquetipo?: string | null
          energia?: number
          flavor?: Json
          generos?: Json
          guilty_pleasures?: Json
          origen?: string
          social?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          arquetipo?: string | null
          energia?: number
          flavor?: Json
          generos?: Json
          guilty_pleasures?: Json
          origen?: string
          social?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "music_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          ciudad: string | null
          fecha_registro: string
          id: string
          is_admin: boolean
          nombre: string | null
        }
        Insert: {
          ciudad?: string | null
          fecha_registro?: string
          id: string
          is_admin?: boolean
          nombre?: string | null
        }
        Update: {
          ciudad?: string | null
          fecha_registro?: string
          id?: string
          is_admin?: boolean
          nombre?: string | null
        }
        Relationships: []
      }
      trends: {
        Row: {
          fecha: string
          id: string
          payload: Json
          tipo: string
          user_id: string
        }
        Insert: {
          fecha?: string
          id?: string
          payload?: Json
          tipo: string
          user_id: string
        }
        Update: {
          fecha?: string
          id?: string
          payload?: Json
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trends_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          artista: string
          genero: string
          id: string
          mood: string
          orden: number
          titulo: string
        }
        Insert: {
          artista: string
          genero: string
          id?: string
          mood: string
          orden?: number
          titulo: string
        }
        Update: {
          artista?: string
          genero?: string
          id?: string
          mood?: string
          orden?: number
          titulo?: string
        }
        Relationships: []
      }
      squads: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          nombre: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string
          nombre: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          nombre?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_members: {
        Row: {
          compat_score: number
          joined_at: string
          squad_id: string
          user_id: string
        }
        Insert: {
          compat_score?: number
          joined_at?: string
          squad_id: string
          user_id: string
        }
        Update: {
          compat_score?: number
          joined_at?: string
          squad_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_members_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      festivals: {
        Row: {
          ciudad: string
          created_at: string
          fecha_fin: string
          fecha_inicio: string
          id: string
          link_boletos: string | null
          nombre: string
        }
        Insert: {
          ciudad: string
          created_at?: string
          fecha_fin: string
          fecha_inicio: string
          id?: string
          link_boletos?: string | null
          nombre: string
        }
        Update: {
          ciudad?: string
          created_at?: string
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          link_boletos?: string | null
          nombre?: string
        }
        Relationships: []
      }
      festival_lineup: {
        Row: {
          artista: string
          escenario: string | null
          festival_id: string
          horario: string | null
          id: string
        }
        Insert: {
          artista: string
          escenario?: string | null
          festival_id: string
          horario?: string | null
          id?: string
        }
        Update: {
          artista?: string
          escenario?: string | null
          festival_id?: string
          horario?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "festival_lineup_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
        ]
      }
      festival_intent: {
        Row: {
          festival_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          festival_id: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          festival_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "festival_intent_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_intent_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_playlist: {
        Row: {
          added_at: string
          added_by: string
          id: string
          song_id: string
          squad_id: string
        }
        Insert: {
          added_at?: string
          added_by: string
          id?: string
          song_id: string
          squad_id: string
        }
        Update: {
          added_at?: string
          added_by?: string
          id?: string
          song_id?: string
          squad_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_playlist_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_playlist_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_squad: {
        Args: { p_nombre: string }
        Returns: Database["public"]["Tables"]["squads"]["Row"]
      }
      join_squad: {
        Args: { p_invite_code: string }
        Returns: Database["public"]["Tables"]["squads"]["Row"]
      }
      generate_trend_for_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]

export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]

// App-level unions the DB only enforces via CHECK constraints.
export type Mood = "fiesta" | "chill" | "electronica"
export type ProfileOrigen = "quiz" | "import" | "live"
export type TrendTipo = "energia_vs_ciudad" | "dato_arquetipo" | "genero_dominante"
export type FestivalStatus = "voy" | "tal_vez" | "no_voy"
