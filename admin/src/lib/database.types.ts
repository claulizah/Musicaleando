export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '13';
  };
  public: {
    Views: Record<string, never>;
    Functions: Record<string, never>;
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
        };
        Insert: Omit<Database['public']['Tables']['announcements']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
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
    };
  };
};
