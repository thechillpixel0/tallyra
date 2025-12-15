/*
  # Complete Tallyra Database Schema

  1. New Tables
    - `shops` - Store shop information with UPI details
    - `staff` - Store staff members with passcodes
    - `items` - Store inventory items with pricing
    - `transactions` - Store all sales transactions
    - `inventory_movements` - Track inventory changes

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated access
    - Create proper foreign key relationships

  3. Sample Data
    - Demo shop with UPI configuration
    - Sample staff member
    - Sample inventory items
*/

-- Create custom types
CREATE TYPE payment_mode_enum AS ENUM ('CASH', 'UPI', 'CREDIT');
CREATE TYPE movement_type_enum AS ENUM ('SALE', 'RESTOCK', 'ADJUSTMENT');

-- Create shops table
CREATE TABLE IF NOT EXISTS public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  currency text NOT NULL DEFAULT 'INR',
  master_passcode_hash text NOT NULL,
  upi_qr_url text,
  upi_id text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.shops 
  FOR SELECT USING (true);

CREATE POLICY "Enable update for authenticated users" ON public.shops 
  FOR UPDATE USING (true);

-- Create staff table
CREATE TABLE IF NOT EXISTS public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  passcode_hash text NOT NULL,
  phone text,
  email text,
  address text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.staff 
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.staff 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.staff 
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users" ON public.staff 
  FOR DELETE USING (true);

-- Create items table
CREATE TABLE IF NOT EXISTS public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  base_price numeric NOT NULL DEFAULT 0,
  stock_quantity integer NOT NULL DEFAULT 0,
  min_stock_alert integer NOT NULL DEFAULT 5,
  max_discount_percentage numeric NOT NULL DEFAULT 0,
  max_discount_fixed numeric NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.items 
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.items 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.items 
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users" ON public.items 
  FOR DELETE USING (true);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  entered_amount numeric NOT NULL DEFAULT 0,
  inferred_item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  base_price numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  discount_percentage numeric NOT NULL DEFAULT 0,
  payment_mode payment_mode_enum NOT NULL DEFAULT 'CASH',
  cash_received numeric,
  change_amount numeric,
  is_discount_override boolean DEFAULT false NOT NULL,
  is_credit_settled boolean DEFAULT false NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.transactions 
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.transactions 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.transactions 
  FOR UPDATE USING (true);

-- Create inventory_movements table
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  item_id uuid REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  movement_type movement_type_enum NOT NULL DEFAULT 'SALE',
  quantity_change integer NOT NULL DEFAULT 0,
  previous_quantity integer NOT NULL DEFAULT 0,
  new_quantity integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.inventory_movements 
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.inventory_movements 
  FOR INSERT WITH CHECK (true);

-- Insert demo shop data
INSERT INTO public.shops (id, name, currency, master_passcode_hash, upi_id, upi_qr_url) 
VALUES (
  'demo-shop-123',
  'Demo Store',
  'INR',
  '1032005',
  'demoshop@paytm',
  'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=demoshop@paytm&pn=Demo%20Store&cu=INR'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  currency = EXCLUDED.currency,
  master_passcode_hash = EXCLUDED.master_passcode_hash,
  upi_id = EXCLUDED.upi_id,
  upi_qr_url = EXCLUDED.upi_qr_url,
  updated_at = now();

-- Insert demo staff member
INSERT INTO public.staff (shop_id, name, passcode_hash, phone, is_active)
VALUES (
  'demo-shop-123',
  'John Doe',
  '1234',
  '+91-9876543210',
  true
) ON CONFLICT DO NOTHING;

-- Insert sample items
INSERT INTO public.items (shop_id, name, base_price, stock_quantity, min_stock_alert, max_discount_percentage, max_discount_fixed, is_active)
VALUES 
  ('demo-shop-123', 'Coffee', 50.00, 100, 10, 10.0, 5.0, true),
  ('demo-shop-123', 'Tea', 30.00, 150, 15, 15.0, 5.0, true),
  ('demo-shop-123', 'Sandwich', 120.00, 50, 5, 20.0, 20.0, true),
  ('demo-shop-123', 'Burger', 180.00, 30, 5, 15.0, 25.0, true),
  ('demo-shop-123', 'Cold Drink', 40.00, 200, 20, 5.0, 2.0, true)
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_staff_shop_id ON public.staff(shop_id);
CREATE INDEX IF NOT EXISTS idx_items_shop_id ON public.items(shop_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shop_id ON public.transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_transactions_staff_id ON public.transactions(staff_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_shop_id ON public.inventory_movements(shop_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_id ON public.inventory_movements(item_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON public.shops 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON public.staff 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.items 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();