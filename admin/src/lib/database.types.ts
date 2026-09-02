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
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['festivals']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
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
    };
  };
};
