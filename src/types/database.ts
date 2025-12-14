// Database Types for Tallyra
export interface Database {
  public: {
    Tables: {
      shops: {
        Row: {
          id: string;
          name: string;
          logo_url?: string;
          currency: string;
          master_passcode_hash: string;
          upi_qr_url?: string;
          upi_id?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['shops']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['shops']['Insert']>;
      };
      staff: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          passcode_hash: string;
          phone?: string;
          email?: string;
          address?: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['staff']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['staff']['Insert']>;
      };
      items: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          base_price: number;
          stock_quantity: number;
          min_stock_alert: number;
          max_discount_percentage: number;
          max_discount_fixed: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['items']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['items']['Insert']>;
      };
      transactions: {
        Row: {
          id: string;
          shop_id: string;
          staff_id: string; // This should be UUID but keeping as string for compatibility
          entered_amount: number;
          inferred_item_id: string; // This should be UUID but keeping as string for compatibility
          base_price: number;
          discount_amount: number;
          discount_percentage: number;
          payment_mode: 'CASH' | 'UPI' | 'CREDIT';
          cash_received?: number;
          change_amount?: number;
          is_discount_override: boolean;
          is_credit_settled: boolean;
          notes?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>;
      };
      inventory_movements: {
        Row: {
          id: string;
          shop_id: string;
          item_id: string;
          transaction_id?: string;
          movement_type: 'SALE' | 'RESTOCK' | 'ADJUSTMENT';
          quantity_change: number;
          previous_quantity: number;
          new_quantity: number;
          notes?: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['inventory_movements']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['inventory_movements']['Insert']>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

export type Shop = Database['public']['Tables']['shops']['Row'];
export type Staff = Database['public']['Tables']['staff']['Row'];
export type Item = Database['public']['Tables']['items']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type InventoryMovement = Database['public']['Tables']['inventory_movements']['Row'];

export interface TransactionWithDetails extends Transaction {
  inferred_item: Item;
  staff: Staff;
}

export interface DailySalesReport {
  date: string;
  total_sales: number;
  cash_sales: number;
  upi_sales: number;
  credit_sales: number;
  total_transactions: number;
  total_discounts: number;
  staff_performance: Array<{
    staff_id: string;
    staff_name: string;
    transaction_count: number;
    total_amount: number;
  }>;
}