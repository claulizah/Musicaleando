export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '13';
  };
  public: {
    Views: Record<string, never>;
    Functions: {
      select_raffle_winner: {
        Args: { p_announcement_id: string };
        Returns: { ganador_user_id: string; ganador_nombre: string }[];
      };
      insights_arquetipo_generos: {
        Args: { p_min_usuarios?: number };
        Returns: { arquetipo: string; genero: string; usuarios: number }[];
      };
      insights_profile_count: {
        Args: Record<string, never>;
        Returns: number;
      };
      count_segment_audience: {
        Args: { p_festival_id: string; p_ciudad: string | null; p_genero: string | null };
        Returns: number;
      };
      admin_metrics: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      admin_onboarding_funnel: {
        Args: Record<string, never>;
        Returns: unknown;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Tables: {
      users: {
        Row: { id: string; nombre: string | null; ciudad: string | null; is_admin: boolean };
        Insert: Partial<Database['public']['Tables']['users']['Row']> & { id: string };
        Update: Partial<Database['public']['Tables']['users']['Row']>;
        Relationships: [];
      };
      site_deploys: {
        Row: { id: string; triggered_at: string; triggered_by: string };
        Insert: Omit<Database['public']['Tables']['site_deploys']['Row'], 'id' | 'triggered_at'> & {
          id?: string;
          triggered_at?: string;
        };
        Update: Partial<Database['public']['Tables']['site_deploys']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'site_deploys_triggered_by_fkey';
            columns: ['triggered_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      admin_actions_log: {
        Row: {
          id: string;
          admin_id: string;
          action: string;
          target_type: string;
          target_id: string;
          is_bulk: boolean;
          detail: Record<string, unknown>;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['admin_actions_log']['Row'], 'id' | 'created_at' | 'is_bulk' | 'detail'> & {
          id?: string;
          created_at?: string;
          is_bulk?: boolean;
          detail?: Record<string, unknown>;
        };
        Update: Partial<Database['public']['Tables']['admin_actions_log']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'admin_actions_log_admin_id_fkey';
            columns: ['admin_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      festivals: {
        Row: {
          id: string;
          nombre: string;
          ciudad: string;
          tipo: string;
          fecha_inicio: string;
          fecha_fin: string;
          link_boletos: string | null;
          mapa_url: string | null;
          created_at: string;
          estado_evento: string;
          descuento_detalle: string | null;
          descuento_vigente_hasta: string | null;
          preventa_detalle: string | null;
          preventa_fin: string | null;
          preventa_inicio: string | null;
          tipo_descuento: string | null;
        };
        Insert: Omit<
          Database['public']['Tables']['festivals']['Row'],
          'id' | 'created_at' | 'mapa_url' | 'tipo' | 'estado_evento' | 'descuento_detalle' | 'descuento_vigente_hasta' | 'preventa_detalle' | 'preventa_fin' | 'preventa_inicio' | 'tipo_descuento'
        > & {
          id?: string;
          created_at?: string;
          mapa_url?: string | null;
          tipo?: string;
          estado_evento?: string;
          descuento_detalle?: string | null;
          descuento_vigente_hasta?: string | null;
          preventa_detalle?: string | null;
          preventa_fin?: string | null;
          preventa_inicio?: string | null;
          tipo_descuento?: string | null;
        };
        Update: Partial<Database['public']['Tables']['festivals']['Row']>;
        Relationships: [];
      };
      app_config: {
        Row: {
          key: string;
          value: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['app_config']['Row']>;
        Relationships: [];
      };
      novedades: {
        Row: {
          id: string;
          pantalla: string;
          titulo: string;
          cuerpo: string;
          publicada_en: string;
          vigente_hasta: string | null;
          activa: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          pantalla: string;
          titulo: string;
          cuerpo: string;
          publicada_en?: string;
          vigente_hasta?: string | null;
          activa?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['novedades']['Row']>;
        Relationships: [];
      };
      ticket_clicks: {
        Row: {
          id: string;
          festival_id: string | null;
          user_id: string | null;
          plataforma: string;
          afiliado: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          festival_id?: string | null;
          user_id?: string | null;
          plataforma: string;
          afiliado?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['ticket_clicks']['Row']>;
        Relationships: [];
      };
      festival_lineup: {
        Row: {
          id: string;
          festival_id: string;
          artista: string;
          escenario: string | null;
          horario: string | null;
          horario_fin: string | null;
          nivel: string | null;
          artist_id: string | null;
        };
        Insert: Omit<Database['public']['Tables']['festival_lineup']['Row'], 'id' | 'artist_id' | 'horario_fin' | 'nivel'> & {
          id?: string;
          artist_id?: string | null;
          horario_fin?: string | null;
          nivel?: string | null;
        };
        Update: Partial<Database['public']['Tables']['festival_lineup']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'festival_lineup_festival_id_fkey';
            columns: ['festival_id'];
            isOneToOne: false;
            referencedRelation: 'festivals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'festival_lineup_artist_id_fkey';
            columns: ['artist_id'];
            isOneToOne: false;
            referencedRelation: 'artists';
            referencedColumns: ['id'];
          },
        ];
      };
      artists: {
        Row: {
          id: string;
          name: string;
          normalized_name: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['artists']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['artists']['Row']>;
        Relationships: [];
      };
      sponsors: {
        Row: {
          id: string;
          nombre: string;
          contacto: string | null;
          ofrece: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['sponsors']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['sponsors']['Row']>;
        Relationships: [];
      };
      festival_map_pins: {
        Row: {
          id: string;
          festival_id: string;
          escenario: string;
          x_pct: number;
          y_pct: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['festival_map_pins']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['festival_map_pins']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'festival_map_pins_festival_id_fkey';
            columns: ['festival_id'];
            isOneToOne: false;
            referencedRelation: 'festivals';
            referencedColumns: ['id'];
          },
        ];
      };
      announcements: {
        Row: {
          id: string;
          festival_id: string;
          tipo: string;
          titulo: string;
          descripcion: string | null;
          sponsor_nombre: string | null;
          codigo_descuento: string | null;
          created_by: string | null;
          created_at: string;
          ganador_user_id: string | null;
          ganador_nombre: string | null;
          target_ciudad: string | null;
          target_genero: string | null;
        };
        Insert: Omit<
          Database['public']['Tables']['announcements']['Row'],
          'id' | 'created_at' | 'ganador_user_id' | 'ganador_nombre' | 'target_ciudad' | 'target_genero'
        > & {
          id?: string;
          created_at?: string;
          ganador_user_id?: string | null;
          ganador_nombre?: string | null;
          target_ciudad?: string | null;
          target_genero?: string | null;
        };
        Update: Partial<Database['public']['Tables']['announcements']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'announcements_festival_id_fkey';
            columns: ['festival_id'];
            isOneToOne: false;
            referencedRelation: 'festivals';
            referencedColumns: ['id'];
          },
        ];
      };
      announcement_interest: {
        Row: { announcement_id: string; user_id: string; created_at: string };
        Insert: Partial<Database['public']['Tables']['announcement_interest']['Row']>;
        Update: Partial<Database['public']['Tables']['announcement_interest']['Row']>;
        Relationships: [];
      };
      content_reports: {
        Row: {
          id: string;
          content_type: string;
          content_id: string;
          reporter_user_id: string;
          motivo: string;
          created_at: string;
          resuelto: boolean;
          resuelto_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['content_reports']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['content_reports']['Row']>;
        Relationships: [];
      };
      festival_comments: {
        Row: {
          id: string;
          festival_id: string;
          user_id: string;
          texto: string;
          created_at: string;
          oculto: boolean;
        };
        Insert: Omit<Database['public']['Tables']['festival_comments']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['festival_comments']['Row']>;
        Relationships: [];
      };
      community_shares: {
        Row: {
          id: string;
          user_id: string;
          song_ids: string[];
          caption: string | null;
          ciudad: string | null;
          created_at: string;
          oculto: boolean;
        };
        Insert: Omit<Database['public']['Tables']['community_shares']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['community_shares']['Row']>;
        Relationships: [];
      };
      songs: {
        Row: { id: string; titulo: string; artista: string; genero: string; mood: string; orden: number };
        Insert: Partial<Database['public']['Tables']['songs']['Row']>;
        Update: Partial<Database['public']['Tables']['songs']['Row']>;
        Relationships: [];
      };
      festival_lineup_candidates: {
        Row: {
          id: string;
          festival_id: string;
          batch_id: string;
          dia_label: string | null;
          escenario: string | null;
          artista: string;
          hora_inicio: string | null;
          hora_fin: string | null;
          confianza: string;
          nota: string | null;
          nivel: string | null;
          estado: string;
          created_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['festival_lineup_candidates']['Row'],
          'id' | 'created_at' | 'estado' | 'nivel'
        > & {
          id?: string;
          created_at?: string;
          estado?: string;
          nivel?: string | null;
        };
        Update: Partial<Database['public']['Tables']['festival_lineup_candidates']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'festival_lineup_candidates_festival_id_fkey';
            columns: ['festival_id'];
            isOneToOne: false;
            referencedRelation: 'festivals';
            referencedColumns: ['id'];
          },
        ];
      };
      event_candidates: {
        Row: {
          id: string;
          source: string;
          source_id: string;
          nombre: string;
          tipo: string | null;
          ciudad: string | null;
          venue: string | null;
          fecha_inicio: string | null;
          fecha_fin: string | null;
          // Ticketmaster rows are a flat string[] (artist names only); rows
          // sourced from a poster image are richer objects with
          // escenario/horario when the image had them — both shapes coexist
          // since this is a jsonb column with no DB-level constraint on it.
          lineup: (string | { artista: string; escenario: string | null; horario: string | null })[];
          price_min: number | null;
          price_max: number | null;
          price_currency: string | null;
          link_boletos: string | null;
          raw_payload: Record<string, unknown>;
          completo: boolean;
          estado: string;
          possible_duplicate_of: string | null;
          festival_id: string | null;
          created_at: string;
          updated_at: string;
          last_seen_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['event_candidates']['Row'],
          'id' | 'created_at' | 'updated_at' | 'last_seen_at' | 'estado' | 'completo' | 'tipo'
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string;
          estado?: string;
          completo?: boolean;
          tipo?: string | null;
        };
        Update: Partial<Database['public']['Tables']['event_candidates']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'event_candidates_possible_duplicate_of_fkey';
            columns: ['possible_duplicate_of'];
            isOneToOne: false;
            referencedRelation: 'festivals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_candidates_festival_id_fkey';
            columns: ['festival_id'];
            isOneToOne: false;
            referencedRelation: 'festivals';
            referencedColumns: ['id'];
          },
        ];
      };
      mood_catalog: {
        Row: { id: string; label: string; emoji: string; orden: number };
        Insert: Database['public']['Tables']['mood_catalog']['Row'];
        Update: Partial<Database['public']['Tables']['mood_catalog']['Row']>;
        Relationships: [];
      };
      mood_playlists: {
        Row: {
          id: string;
          mood_id: string;
          titulo: string;
          artista: string;
          genero: string | null;
          fuente: string;
          estado: string;
          created_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['mood_playlists']['Row'],
          'id' | 'created_at' | 'estado' | 'genero'
        > & {
          id?: string;
          created_at?: string;
          estado?: string;
          genero?: string | null;
        };
        Update: Partial<Database['public']['Tables']['mood_playlists']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'mood_playlists_mood_id_fkey';
            columns: ['mood_id'];
            isOneToOne: false;
            referencedRelation: 'mood_catalog';
            referencedColumns: ['id'];
          },
        ];
      };
      concert_album: {
        Row: {
          id: string;
          user_id: string;
          festival_id: string;
          foto_path: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['concert_album']['Row']>;
        Update: Partial<Database['public']['Tables']['concert_album']['Row']>;
        Relationships: [];
      };
    };
  };
};
