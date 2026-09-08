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
      festivals: {
        Row: {
          id: string;
          nombre: string;
          ciudad: string;
          fecha_inicio: string;
          fecha_fin: string;
          link_boletos: string | null;
          mapa_url: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['festivals']['Row'], 'id' | 'created_at' | 'mapa_url'> & {
          id?: string;
          created_at?: string;
          mapa_url?: string | null;
        };
        Update: Partial<Database['public']['Tables']['festivals']['Row']>;
        Relationships: [];
      };
      festival_lineup: {
        Row: {
          id: string;
          festival_id: string;
          artista: string;
          escenario: string | null;
          horario: string | null;
        };
        Insert: Omit<Database['public']['Tables']['festival_lineup']['Row'], 'id'> & {
          id?: string;
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
        ];
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
        };
        Insert: Omit<
          Database['public']['Tables']['announcements']['Row'],
          'id' | 'created_at' | 'ganador_user_id' | 'ganador_nombre'
        > & {
          id?: string;
          created_at?: string;
          ganador_user_id?: string | null;
          ganador_nombre?: string | null;
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
