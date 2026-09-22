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
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcement_interest: {
        Row: {
          announcement_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_interest_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_interest_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          codigo_descuento: string | null
          created_at: string
          created_by: string | null
          descripcion: string | null
          festival_id: string
          ganador_nombre: string | null
          ganador_user_id: string | null
          id: string
          sponsor_nombre: string | null
          target_ciudad: string | null
          target_genero: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          codigo_descuento?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          festival_id: string
          ganador_nombre?: string | null
          ganador_user_id?: string | null
          id?: string
          sponsor_nombre?: string | null
          target_ciudad?: string | null
          target_genero?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          codigo_descuento?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          festival_id?: string
          ganador_nombre?: string | null
          ganador_user_id?: string | null
          id?: string
          sponsor_nombre?: string | null
          target_ciudad?: string | null
          target_genero?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_ganador_user_id_fkey"
            columns: ["ganador_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      artists: {
        Row: {
          created_at: string
          id: string
          name: string
          normalized_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          normalized_name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          normalized_name?: string
        }
        Relationships: []
      }
      community_share_votes: {
        Row: {
          created_at: string
          share_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          share_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          share_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_share_votes_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "community_share_stats"
            referencedColumns: ["share_id"]
          },
          {
            foreignKeyName: "community_share_votes_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "community_shares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_share_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      community_shares: {
        Row: {
          caption: string | null
          ciudad: string | null
          created_at: string
          id: string
          oculto: boolean
          song_ids: string[]
          user_id: string
        }
        Insert: {
          caption?: string | null
          ciudad?: string | null
          created_at?: string
          id?: string
          oculto?: boolean
          song_ids: string[]
          user_id: string
        }
        Update: {
          caption?: string | null
          ciudad?: string | null
          created_at?: string
          id?: string
          oculto?: boolean
          song_ids?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      concert_album: {
        Row: {
          created_at: string
          festival_id: string
          foto_path: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          festival_id: string
          foto_path: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          festival_id?: string
          foto_path?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concert_album_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concert_album_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          compat_score: number | null
          contact_id: string
          created_at: string
          id: string
          responded_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          compat_score?: number | null
          contact_id: string
          created_at?: string
          id?: string
          responded_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          compat_score?: number | null
          contact_id?: string
          created_at?: string
          id?: string
          responded_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          id: string
          motivo: string
          reporter_user_id: string
          resuelto: boolean
          resuelto_at: string | null
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          motivo: string
          reporter_user_id: string
          resuelto?: boolean
          resuelto_at?: string | null
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          motivo?: string
          reporter_user_id?: string
          resuelto?: boolean
          resuelto_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      festival_comments: {
        Row: {
          created_at: string
          festival_id: string
          id: string
          oculto: boolean
          texto: string
          user_id: string
        }
        Insert: {
          created_at?: string
          festival_id: string
          id?: string
          oculto?: boolean
          texto: string
          user_id: string
        }
        Update: {
          created_at?: string
          festival_id?: string
          id?: string
          oculto?: boolean
          texto?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "festival_comments_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      festival_feedback: {
        Row: {
          comentario: string | null
          created_at: string
          festival_id: string
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          festival_id: string
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          comentario?: string | null
          created_at?: string
          festival_id?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "festival_feedback_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
      festival_lineup: {
        Row: {
          artista: string
          artist_id: string | null
          escenario: string | null
          festival_id: string
          horario: string | null
          horario_fin: string | null
          id: string
          nivel: string | null
        }
        Insert: {
          artista: string
          artist_id?: string | null
          escenario?: string | null
          festival_id: string
          horario?: string | null
          horario_fin?: string | null
          id?: string
          nivel?: string | null
        }
        Update: {
          artista?: string
          artist_id?: string | null
          escenario?: string | null
          festival_id?: string
          horario?: string | null
          horario_fin?: string | null
          id?: string
          nivel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "festival_lineup_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_lineup_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      festival_map_pins: {
        Row: {
          created_at: string
          escenario: string
          festival_id: string
          id: string
          x_pct: number
          y_pct: number
        }
        Insert: {
          created_at?: string
          escenario: string
          festival_id: string
          id?: string
          x_pct: number
          y_pct: number
        }
        Update: {
          created_at?: string
          escenario?: string
          festival_id?: string
          id?: string
          x_pct?: number
          y_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "festival_map_pins_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
        ]
      }
      festival_reactions: {
        Row: {
          created_at: string
          festival_id: string
          reaction: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          festival_id: string
          reaction: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          festival_id?: string
          reaction?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "festival_reactions_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      festival_survey_responses: {
        Row: {
          calificacion: string
          created_at: string
          festival_id: string
          updated_at: string
          user_id: string
          volveria: string
        }
        Insert: {
          calificacion: string
          created_at?: string
          festival_id: string
          updated_at?: string
          user_id: string
          volveria: string
        }
        Update: {
          calificacion?: string
          created_at?: string
          festival_id?: string
          updated_at?: string
          user_id?: string
          volveria?: string
        }
        Relationships: [
          {
            foreignKeyName: "festival_survey_responses_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_survey_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      novedades: {
        Row: {
          activa: boolean
          created_at: string
          cuerpo: string
          id: string
          pantalla: string
          publicada_en: string
          titulo: string
          vigente_hasta: string | null
        }
        Insert: {
          activa?: boolean
          created_at?: string
          cuerpo: string
          id: string
          pantalla: string
          publicada_en?: string
          titulo: string
          vigente_hasta?: string | null
        }
        Update: {
          activa?: boolean
          created_at?: string
          cuerpo?: string
          id?: string
          pantalla?: string
          publicada_en?: string
          titulo?: string
          vigente_hasta?: string | null
        }
        Relationships: []
      }
      novedades_vistas: {
        Row: {
          novedad_id: string
          user_id: string
          visto_en: string
        }
        Insert: {
          novedad_id: string
          user_id: string
          visto_en?: string
        }
        Update: {
          novedad_id?: string
          user_id?: string
          visto_en?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          city: string
          created_at: string
          id: string
          name: string
          normalized_name: string
          state: string
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          name: string
          normalized_name: string
          state: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          name?: string
          normalized_name?: string
          state?: string
        }
        Relationships: []
      }
      onboarding_progress: {
        Row: {
          alcanzado_en: string
          paso: number
          paso_nombre: string
          user_id: string
        }
        Insert: {
          alcanzado_en?: string
          paso: number
          paso_nombre: string
          user_id: string
        }
        Update: {
          alcanzado_en?: string
          paso?: number
          paso_nombre?: string
          user_id?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      ticket_clicks: {
        Row: {
          afiliado: boolean
          created_at: string
          festival_id: string | null
          id: string
          plataforma: string
          user_id: string | null
        }
        Insert: {
          afiliado?: boolean
          created_at?: string
          festival_id?: string | null
          id?: string
          plataforma: string
          user_id?: string | null
        }
        Update: {
          afiliado?: boolean
          created_at?: string
          festival_id?: string | null
          id?: string
          plataforma?: string
          user_id?: string | null
        }
        Relationships: []
      }
      festivals: {
        Row: {
          ciudad: string
          created_at: string
          estado_evento: string
          fecha_fin: string
          fecha_inicio: string
          id: string
          link_boletos: string | null
          mapa_url: string | null
          nombre: string
          tipo: string
          descuento_detalle: string | null
          descuento_vigente_hasta: string | null
          preventa_detalle: string | null
          preventa_fin: string | null
          preventa_inicio: string | null
          tipo_descuento: string | null
          venue_id: string | null
        }
        Insert: {
          ciudad: string
          created_at?: string
          estado_evento?: string
          fecha_fin: string
          fecha_inicio: string
          id?: string
          link_boletos?: string | null
          mapa_url?: string | null
          nombre: string
          tipo?: string
          descuento_detalle?: string | null
          descuento_vigente_hasta?: string | null
          preventa_detalle?: string | null
          preventa_fin?: string | null
          preventa_inicio?: string | null
          tipo_descuento?: string | null
          venue_id?: string | null
        }
        Update: {
          ciudad?: string
          created_at?: string
          estado_evento?: string
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          link_boletos?: string | null
          mapa_url?: string | null
          nombre?: string
          tipo?: string
          descuento_detalle?: string | null
          descuento_vigente_hasta?: string | null
          preventa_detalle?: string | null
          preventa_fin?: string | null
          preventa_inicio?: string | null
          tipo_descuento?: string | null
        }
        Relationships: []
      }
      mood_catalog: {
        Row: {
          emoji: string
          id: string
          label: string
          orden: number
        }
        Insert: {
          emoji: string
          id: string
          label: string
          orden?: number
        }
        Update: {
          emoji?: string
          id?: string
          label?: string
          orden?: number
        }
        Relationships: []
      }
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
            foreignKeyName: "mood_logs_mood_fkey"
            columns: ["mood"]
            isOneToOne: false
            referencedRelation: "mood_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mood_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_playlists: {
        Row: {
          artista: string
          created_at: string
          estado: string
          fuente: string
          genero: string | null
          id: string
          mood_id: string
          titulo: string
        }
        Insert: {
          artista: string
          created_at?: string
          estado?: string
          fuente: string
          genero?: string | null
          id?: string
          mood_id: string
          titulo: string
        }
        Update: {
          artista?: string
          created_at?: string
          estado?: string
          fuente?: string
          genero?: string | null
          id?: string
          mood_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mood_playlists_mood_id_fkey"
            columns: ["mood_id"]
            isOneToOne: false
            referencedRelation: "mood_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      music_profile: {
        Row: {
          arquetipo: string | null
          energia: number
          estados_interes: Json
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
          estados_interes?: Json
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
          estados_interes?: Json
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
      recommendation_cache: {
        Row: {
          artista_id: string
          artista_imagen_url: string | null
          artista_nombre: string
          fuente: string
          score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          artista_id: string
          artista_imagen_url?: string | null
          artista_nombre: string
          fuente?: string
          score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          artista_id?: string
          artista_imagen_url?: string | null
          artista_nombre?: string
          fuente?: string
          score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_cache_user_id_fkey"
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
      sponsors: {
        Row: {
          contacto: string | null
          created_at: string
          id: string
          nombre: string
          ofrece: string | null
        }
        Insert: {
          contacto?: string | null
          created_at?: string
          id?: string
          nombre: string
          ofrece?: string | null
        }
        Update: {
          contacto?: string | null
          created_at?: string
          id?: string
          nombre?: string
          ofrece?: string | null
        }
        Relationships: []
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
            foreignKeyName: "squad_playlist_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
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
      squad_tournament_votes: {
        Row: {
          artist_id: string
          created_at: string
          squad_id: string
          turn: number
          user_id: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          squad_id: string
          turn: number
          user_id: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          squad_id?: string
          turn?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_tournament_votes_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_tournament_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_tournaments: {
        Row: {
          artists: Json
          champion: Json | null
          remaining: Json
          round: number
          squad_id: string
          turn: number
          updated_at: string
          winners_this_round: Json
        }
        Insert: {
          artists: Json
          champion?: Json | null
          remaining: Json
          round?: number
          squad_id: string
          turn?: number
          updated_at?: string
          winners_this_round?: Json
        }
        Update: {
          artists?: Json
          champion?: Json | null
          remaining?: Json
          round?: number
          squad_id?: string
          turn?: number
          updated_at?: string
          winners_this_round?: Json
        }
        Relationships: [
          {
            foreignKeyName: "squad_tournaments_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: true
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      squads: {
        Row: {
          created_at: string
          festival_id: string | null
          himno_artist_id: string | null
          himno_imagen_url: string | null
          himno_nombre: string | null
          id: string
          invite_code: string
          nombre: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          festival_id?: string | null
          himno_artist_id?: string | null
          himno_imagen_url?: string | null
          himno_nombre?: string | null
          id?: string
          invite_code?: string
          nombre: string
          owner_id: string
        }
        Update: {
          created_at?: string
          festival_id?: string | null
          himno_artist_id?: string | null
          himno_imagen_url?: string | null
          himno_nombre?: string | null
          id?: string
          invite_code?: string
          nombre?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squads_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      torneo_campeon_historial: {
        Row: {
          artist_id: string
          artist_imagen_url: string | null
          artist_nombre: string
          coronado_at: string
          genero_id: string | null
          id: string
          user_id: string
        }
        Insert: {
          artist_id: string
          artist_imagen_url?: string | null
          artist_nombre: string
          coronado_at?: string
          genero_id?: string | null
          id?: string
          user_id: string
        }
        Update: {
          artist_id?: string
          artist_imagen_url?: string | null
          artist_nombre?: string
          coronado_at?: string
          genero_id?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "torneo_campeon_historial_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          meta: Json
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          meta?: Json
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          meta?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
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
    }
    Views: {
      community_share_stats: {
        Row: {
          caption: string | null
          ciudad: string | null
          created_at: string | null
          share_id: string | null
          song_ids: string[] | null
          user_id: string | null
          vote_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "community_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      delete_own_account: {
        Args: { p_anon_id: string }
        Returns: undefined
      }
      advance_squad_tournament: {
        Args: { p_squad_id: string }
        Returns: {
          artists: Json
          champion: Json | null
          remaining: Json
          round: number
          squad_id: string
          turn: number
          updated_at: string
          winners_this_round: Json
        }
        SetofOptions: {
          from: "*"
          to: "squad_tournaments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      best_contact_match: {
        Args: never
        Returns: {
          arquetipo: string
          compat_score: number
          contact_user_id: string
          nombre: string
        }[]
      }
      count_segment_audience: {
        Args: { p_ciudad: string; p_genero: string }
        Returns: number
      }
      contacts_feed: {
        Args: never
        Returns: {
          arquetipo: string
          contact_user_id: string
          generos: Json
          nombre: string
          ultimo_campeon_fecha: string
          ultimo_campeon_nombre: string
        }[]
      }
      cosine_similarity: {
        Args: { v1: number[]; v2: number[] }
        Returns: number
      }
      create_squad: {
        Args: { p_festival_id: string; p_nombre: string }
        Returns: {
          created_at: string
          festival_id: string | null
          himno_artist_id: string | null
          himno_imagen_url: string | null
          himno_nombre: string | null
          id: string
          invite_code: string
          nombre: string
          owner_id: string
        }
        SetofOptions: {
          from: "*"
          to: "squads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      energia_ciudad_avg: {
        Args: { p_ciudad: string }
        Returns: {
          muestras: number
          promedio: number
        }[]
      }
      evaluate_rare_badges: { Args: { p_user_id: string }; Returns: undefined }
      generate_recommendations_v2_for_all: { Args: never; Returns: undefined }
      generate_recommendations_v2_for_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      generate_trend_for_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      generate_trends_for_all: { Args: never; Returns: undefined }
      get_recap_anual: { Args: { p_anio: number }; Returns: Json }
      insights_arquetipo_generos: {
        Args: { p_min_usuarios?: number }
        Returns: {
          arquetipo: string
          genero: string
          usuarios: number
        }[]
      }
      insights_profile_count: { Args: never; Returns: number }
      is_squad_member: {
        Args: { p_squad_id: string; p_user_id: string }
        Returns: boolean
      }
      join_squad: {
        Args: { p_invite_code: string }
        Returns: {
          created_at: string
          festival_id: string | null
          himno_artist_id: string | null
          himno_imagen_url: string | null
          himno_nombre: string | null
          id: string
          invite_code: string
          nombre: string
          owner_id: string
        }
        SetofOptions: {
          from: "*"
          to: "squads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      music_vector: {
        Args: { p_energia: number; p_generos: Json }
        Returns: number[]
      }
      recompute_squad_compat: {
        Args: { p_squad_id: string }
        Returns: undefined
      }
      refresh_my_recommendations_v2: { Args: never; Returns: undefined }
      respond_contact_request: {
        Args: { p_accept: boolean; p_request_id: string }
        Returns: {
          compat_score: number | null
          contact_id: string
          created_at: string
          id: string
          responded_at: string | null
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "contacts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_users_by_name: {
        Args: { p_query: string }
        Returns: {
          nombre: string
          user_id: string
        }[]
      }
      select_raffle_winner: {
        Args: { p_announcement_id: string }
        Returns: {
          ganador_nombre: string
          ganador_user_id: string
        }[]
      }
      send_contact_request: {
        Args: { p_contact_id: string }
        Returns: {
          compat_score: number | null
          contact_id: string
          created_at: string
          id: string
          responded_at: string | null
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "contacts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      squad_comparison: {
        Args: { p_squad_id: string }
        Returns: {
          energia: number
          festivales_confirmados: number
          festivales_en_comun: number
          generos_count: number
          nombre: string
          user_id: string
        }[]
      }
      squad_members_with_profile: {
        Args: { p_squad_id: string }
        Returns: {
          arquetipo: string
          compat_score: number
          energia: number
          generos: Json
          joined_at: string
          user_id: string
        }[]
      }
      start_squad_tournament: {
        Args: { p_artists: Json; p_squad_id: string }
        Returns: undefined
      }
      users_share_a_squad: {
        Args: { p_user_a: string; p_user_b: string }
        Returns: boolean
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

// App-level unions the DB only enforces via CHECK constraints (or, for Mood,
// via a real table `mood_catalog` — this union exists only for client-side
// type safety/autocomplete; adding a new mood at runtime is a data row in
// `mood_catalog`, not a schema change).
export type Mood = "feliz" | "triste" | "fiestero" | "relajado" | "activo" | "peda"
export type ProfileOrigen = "quiz" | "import" | "live"
export type TrendTipo = "energia_vs_ciudad" | "dato_arquetipo" | "genero_dominante"
export type FestivalStatus = "voy" | "tal_vez" | "no_voy"
export type FestivalReactionType = "like" | "dislike"
export type AnnouncementTipo = "simple" | "rifa" | "descuento"
export type SurveyCalificacion = "genial" | "bien" | "regular" | "malo"
export type SurveyVolveria = "si" | "no" | "tal_vez"
export type RecommendationFuente = "v1_contenido" | "v2_colaborativo"
export type ContentReportType = "festival_comment" | "community_share" | "concert_photo"
export type ContentReportMotivo = "spam" | "ofensivo" | "otro"
export type MoodPlaylistFuente = "manual" | "lastfm"
export type MoodPlaylistEstado = "pendiente" | "aprobado"
export type ContactStatus = "pendiente" | "aceptado" | "rechazado"
