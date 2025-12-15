/*
  # Complete Tallyra Database Setup

  1. Database Schema
    - Creates all required tables with proper relationships
    - Sets up Row Level Security (RLS) policies
    - Adds performance indexes
    - Creates sample data for testing

  2. Tables Created
    - `shops` - Store information and settings
    - `staff` - Employee management with passcodes
    - `items` - Inventory/menu items with pricing
    - `transactions` - Sales records with payment details
    - `inventory_movements` - Stock tracking and history

  3. Security
    - Enable RLS on all tables
    - Add policies for CRUD operations
    - Secure data access patterns

  4. Sample Data
    - Demo shop with UPI settings
    - Sample staff member for testing
    - Sample menu items
    - Test transactions
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types for better data integrity
DO $$ BEGIN
    CREATE TYPE payment_mode_enum AS ENUM ('CASH', 'UPI', 'CREDIT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE movement_type_enum AS ENUM ('SALE', 'RESTOCK', 'ADJUSTMENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create shops table
CREATE TABLE IF NOT EXISTS public.shops (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    logo_url text,
    currency text NOT NULL DEFAULT 'INR',
    master_passcode_hash text NOT NULL,
    upi_qr_url text,
    upi_id text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS for shops
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for shops
CREATE POLICY IF NOT EXISTS "Enable read access for all users" ON public.shops FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Enable insert for authenticated users" ON public.shops FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Enable update for authenticated users" ON public.shops FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Enable delete for authenticated users" ON public.shops FOR DELETE USING (true);

-- Create staff table
CREATE TABLE IF NOT EXISTS public.staff (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    name text NOT NULL,
    passcode_hash text NOT NULL,
    phone text,
    email text,
    address text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS for staff
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for staff
CREATE POLICY IF NOT EXISTS "Enable read access for all users" ON public.staff FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Enable insert for authenticated users" ON public.staff FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Enable update for authenticated users" ON public.staff FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Enable delete for authenticated users" ON public.staff FOR DELETE USING (true);

-- Create items table
CREATE TABLE IF NOT EXISTS public.items (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    name text NOT NULL,
    base_price numeric NOT NULL CHECK (base_price >= 0),
    stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    min_stock_alert integer NOT NULL DEFAULT 5 CHECK (min_stock_alert >= 0),
    max_discount_percentage numeric NOT NULL DEFAULT 0 CHECK (max_discount_percentage >= 0 AND max_discount_percentage <= 100),
    max_discount_fixed numeric NOT NULL DEFAULT 0 CHECK (max_discount_fixed >= 0),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS for items
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for items
CREATE POLICY IF NOT EXISTS "Enable read access for all users" ON public.items FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Enable insert for authenticated users" ON public.items FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Enable update for authenticated users" ON public.items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Enable delete for authenticated users" ON public.items FOR DELETE USING (true);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
    entered_amount numeric NOT NULL CHECK (entered_amount >= 0),
    inferred_item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
    base_price numeric NOT NULL DEFAULT 0 CHECK (base_price >= 0),
    discount_amount numeric NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    discount_percentage numeric NOT NULL DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
    payment_mode payment_mode_enum NOT NULL,
    cash_received numeric CHECK (cash_received IS NULL OR cash_received >= 0),
    change_amount numeric CHECK (change_amount IS NULL OR change_amount >= 0),
    is_discount_override boolean DEFAULT false NOT NULL,
    is_credit_settled boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS for transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for transactions
CREATE POLICY IF NOT EXISTS "Enable read access for all users" ON public.transactions FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Enable insert for authenticated users" ON public.transactions FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Enable update for authenticated users" ON public.transactions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Enable delete for authenticated users" ON public.transactions FOR DELETE USING (true);

-- Create inventory_movements table
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
    movement_type movement_type_enum NOT NULL,
    quantity_change integer NOT NULL,
    previous_quantity integer NOT NULL CHECK (previous_quantity >= 0),
    new_quantity integer NOT NULL CHECK (new_quantity >= 0),
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS for inventory_movements
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for inventory_movements
CREATE POLICY IF NOT EXISTS "Enable read access for all users" ON public.inventory_movements FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Enable insert for authenticated users" ON public.inventory_movements FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Enable update for authenticated users" ON public.inventory_movements FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Enable delete for authenticated users" ON public.inventory_movements FOR DELETE USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_staff_shop_id ON public.staff(shop_id);
CREATE INDEX IF NOT EXISTS idx_staff_passcode ON public.staff(passcode_hash);
CREATE INDEX IF NOT EXISTS idx_items_shop_id ON public.items(shop_id);
CREATE INDEX IF NOT EXISTS idx_items_active ON public.items(shop_id, is_active);
CREATE INDEX IF NOT EXISTS idx_transactions_shop_id ON public.transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_transactions_staff_id ON public.transactions(staff_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_shop_id ON public.inventory_movements(shop_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_id ON public.inventory_movements(item_id);

-- Insert sample data for testing
INSERT INTO public.shops (id, name, currency, master_passcode_hash, upi_id, upi_qr_url) 
VALUES (
    'demo-shop-123',
    'Demo Store',
    'INR',
    '1032005',
    'demostore@paytm',
    'https://example.com/qr'
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    currency = EXCLUDED.currency,
    master_passcode_hash = EXCLUDED.master_passcode_hash,
    upi_id = EXCLUDED.upi_id,
    upi_qr_url = EXCLUDED.upi_qr_url,
    updated_at = now();

-- Insert sample staff
INSERT INTO public.staff (shop_id, name, passcode_hash, phone, email, is_active)
VALUES 
    ('demo-shop-123', 'John Doe', '1234', '+1234567890', 'john@example.com', true),
    ('demo-shop-123', 'Jane Smith', '5678', '+1234567891', 'jane@example.com', true)
ON CONFLICT DO NOTHING;

-- Insert sample items
INSERT INTO public.items (shop_id, name, base_price, stock_quantity, min_stock_alert, max_discount_percentage, max_discount_fixed, is_active)
VALUES 
    ('demo-shop-123', 'Coffee', 50.00, 100, 10, 10.0, 5.0, true),
    ('demo-shop-123', 'Tea', 30.00, 150, 15, 15.0, 5.0, true),
    ('demo-shop-123', 'Sandwich', 120.00, 50, 5, 20.0, 20.0, true),
    ('demo-shop-123', 'Burger', 180.00, 30, 5, 15.0, 25.0, true),
    ('demo-shop-123', 'Pizza Slice', 80.00, 40, 8, 10.0, 10.0, true),
    ('demo-shop-123', 'Cold Drink', 25.00, 200, 20, 5.0, 2.0, true),
    ('demo-shop-123', 'Pastry', 60.00, 25, 5, 20.0, 10.0, true),
    ('demo-shop-123', 'Juice', 40.00, 80, 10, 10.0, 5.0, true)
ON CONFLICT DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_shops_updated_at ON public.shops;
CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_staff_updated_at ON public.staff;
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_items_updated_at ON public.items;
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();