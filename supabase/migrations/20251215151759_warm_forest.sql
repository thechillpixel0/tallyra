-- Complete database setup for Tallyra POS System
-- Run this script in your Supabase SQL Editor

-- Create shops table
CREATE TABLE IF NOT EXISTS public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  currency text NOT NULL DEFAULT 'Rs.',
  master_passcode_hash text NOT NULL,
  upi_qr_url text,
  upi_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create staff table
CREATE TABLE IF NOT EXISTS public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  passcode_hash text NOT NULL,
  phone text,
  email text,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create items table
CREATE TABLE IF NOT EXISTS public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  base_price numeric NOT NULL,
  stock_quantity integer NOT NULL DEFAULT 0,
  min_stock_alert integer NOT NULL DEFAULT 0,
  max_discount_percentage numeric NOT NULL DEFAULT 0,
  max_discount_fixed numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  entered_amount numeric NOT NULL,
  inferred_item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  base_price numeric NOT NULL,
  discount_amount numeric NOT NULL DEFAULT 0,
  discount_percentage numeric NOT NULL DEFAULT 0,
  payment_mode text NOT NULL CHECK (payment_mode IN ('CASH', 'UPI', 'CREDIT')),
  cash_received numeric,
  change_amount numeric,
  is_discount_override boolean NOT NULL DEFAULT false,
  is_credit_settled boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create inventory_movements table
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  item_id uuid REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('SALE', 'RESTOCK', 'ADJUSTMENT')),
  quantity_change integer NOT NULL,
  previous_quantity integer NOT NULL,
  new_quantity integer NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public access (adjust as needed for your security requirements)
CREATE POLICY "Allow all operations on shops" ON public.shops FOR ALL USING (true);
CREATE POLICY "Allow all operations on staff" ON public.staff FOR ALL USING (true);
CREATE POLICY "Allow all operations on items" ON public.items FOR ALL USING (true);
CREATE POLICY "Allow all operations on transactions" ON public.transactions FOR ALL USING (true);
CREATE POLICY "Allow all operations on inventory_movements" ON public.inventory_movements FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_staff_shop_id ON public.staff(shop_id);
CREATE INDEX IF NOT EXISTS idx_items_shop_id ON public.items(shop_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shop_id ON public.transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_transactions_staff_id ON public.transactions(staff_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_shop_id ON public.inventory_movements(shop_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_id ON public.inventory_movements(item_id);

-- Insert sample data
INSERT INTO public.shops (id, name, currency, master_passcode_hash, upi_id) 
VALUES (
  'demo-shop-123'::uuid, 
  'Demo Shop', 
  'Rs.', 
  'master123', 
  'demoshop@upi'
) ON CONFLICT (id) DO NOTHING;

-- Insert sample staff
INSERT INTO public.staff (shop_id, name, passcode_hash, phone, is_active)
VALUES (
  'demo-shop-123'::uuid,
  'John Doe',
  'staff123',
  '+1234567890',
  true
) ON CONFLICT DO NOTHING;

-- Insert sample items
INSERT INTO public.items (shop_id, name, base_price, stock_quantity, min_stock_alert, max_discount_percentage, max_discount_fixed, is_active)
VALUES 
  ('demo-shop-123'::uuid, 'Coffee', 50.00, 100, 10, 10.0, 5.0, true),
  ('demo-shop-123'::uuid, 'Tea', 30.00, 150, 15, 15.0, 5.0, true),
  ('demo-shop-123'::uuid, 'Sandwich', 120.00, 50, 5, 20.0, 20.0, true),
  ('demo-shop-123'::uuid, 'Burger', 180.00, 30, 5, 15.0, 25.0, true),
  ('demo-shop-123'::uuid, 'Cold Drink', 40.00, 80, 10, 10.0, 5.0, true)
ON CONFLICT DO NOTHING;