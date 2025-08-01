export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          id: string
          name: string
          email: string
          password: string
          role: string
          is_active: boolean
          last_login: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          password: string
          role?: string
          is_active?: boolean
          last_login?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          password?: string
          role?: string
          is_active?: boolean
          last_login?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ambassador_applications: {
        Row: {
          age: number
          city: string
          created_at: string
          full_name: string
          id: string
          motivation: string | null
          phone_number: string
          social_link: string | null
          status: string | null
        }
        Insert: {
          age: number
          city: string
          created_at?: string
          full_name: string
          id?: string
          motivation?: string | null
          phone_number: string
          social_link?: string | null
          status?: string | null
        }
        Update: {
          age?: number
          city?: string
          created_at?: string
          full_name?: string
          id?: string
          motivation?: string | null
          phone_number?: string
          social_link?: string | null
          status?: string | null
        }
        Relationships: []
      }
      ambassadors: {
        Row: {
          id: string
          full_name: string
          phone: string
          email: string | null
          city: string
          password: string
          status: string
          commission_rate: number
          approved_by: string | null
          approved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name: string
          phone: string
          email?: string | null
          city: string
          password: string
          status?: string
          commission_rate?: number
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          phone?: string
          email?: string | null
          city?: string
          password?: string
          status?: string
          commission_rate?: number
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          id: string
          ambassador_id: string
          event_id: string
          full_name: string
          phone: string
          email: string | null
          age: number | null
          standard_tickets: number
          vip_tickets: number
          total_amount: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          ambassador_id: string
          event_id: string
          full_name: string
          phone: string
          email?: string | null
          age?: number | null
          standard_tickets?: number
          vip_tickets?: number
          total_amount: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          ambassador_id?: string
          event_id?: string
          full_name?: string
          phone?: string
          email?: string | null
          age?: number | null
          standard_tickets?: number
          vip_tickets?: number
          total_amount?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ambassadors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          }
        ]
      }
      ambassador_events: {
        Row: {
          ambassador_id: string
          event_id: string
          assigned_at: string
        }
        Insert: {
          ambassador_id: string
          event_id: string
          assigned_at?: string
        }
        Update: {
          ambassador_id?: string
          event_id?: string
          assigned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_events_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ambassadors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassador_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          }
        ]
      }
      ambassador_performance: {
        Row: {
          id: string
          ambassador_id: string
          event_id: string
          sales_count: number
          revenue_generated: number
          commission_earned: number
          rank: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          ambassador_id: string
          event_id: string
          sales_count?: number
          revenue_generated?: number
          commission_earned?: number
          rank?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          ambassador_id?: string
          event_id?: string
          sales_count?: number
          revenue_generated?: number
          commission_earned?: number
          rank?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_performance_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ambassadors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassador_performance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          }
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          status: string | null
          subject: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          status?: string | null
          subject: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          status?: string | null
          subject?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          city: string
          created_at: string
          date: string
          description: string | null
          featured: boolean | null
          id: string
          name: string
          poster_url: string | null
          ticket_link: string | null
          updated_at: string
          venue: string
          whatsapp_link: string | null
        }
        Insert: {
          city: string
          created_at?: string
          date: string
          description?: string | null
          featured?: boolean | null
          id?: string
          name: string
          poster_url?: string | null
          ticket_link?: string | null
          updated_at?: string
          venue: string
          whatsapp_link?: string | null
        }
        Update: {
          city?: string
          created_at?: string
          date?: string
          description?: string | null
          featured?: boolean | null
          id?: string
          name?: string
          poster_url?: string | null
          ticket_link?: string | null
          updated_at?: string
          venue?: string
          whatsapp_link?: string | null
        }
        Relationships: []
      }

      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          language: string | null
          subscribed_at: string
        }
        Insert: {
          email: string
          id?: string
          language?: string | null
          subscribed_at?: string
        }
        Update: {
          email?: string
          id?: string
          language?: string | null
          subscribed_at?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          content: Json
          id: string
          key: string
          updated_at: string
        }
        Insert: {
          content: Json
          id?: string
          key: string
          updated_at?: string
        }
        Update: {
          content?: Json
          id?: string
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      sponsors: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          website_url: string | null
          is_global: boolean | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          website_url?: string | null
          is_global?: boolean | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          website_url?: string | null
          is_global?: boolean | null
        }
        Relationships: []
      },
      event_sponsors: {
        Row: {
          id: string;
          event_id: string;
          sponsor_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          sponsor_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          sponsor_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_sponsors_event_id_fkey",
            columns: ["event_id"],
            isOneToOne: false,
            referencedRelation: "events",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_sponsors_sponsor_id_fkey",
            columns: ["sponsor_id"],
            isOneToOne: false,
            referencedRelation: "sponsors",
            referencedColumns: ["id"]
          }
        ];
      },
      team_members: {
        Row: {
          id: string;
          name: string;
          role: string;
          photo_url: string | null;
          bio: string | null;
          social_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          role: string;
          photo_url?: string | null;
          bio?: string | null;
          social_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          role?: string;
          photo_url?: string | null;
          bio?: string | null;
          social_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      },
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
