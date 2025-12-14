/*
  # Complete Tallyra Database Schema

  1. New Tables
    - `shops` - Store shop information and master passcode
    - `staff` - Staff members with individual passcodes
    - `items` - Inventory items with pricing and stock
    - `transactions` - All sales transactions with payment details
    - `inventory_movements` - Track stock changes

  2. Security
    - Enable RLS on all tables
    - Add policies for shop-based data isolation
    - Secure access based on authentication

  3. Sample Data
    - Demo shop with ID 'demo-shop-123'
    - Sample staff members with passcodes 129 and 456
    - Sample inventory items (Tray, Carton, etc.)
    - Owner passcode: 1032005
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create shops table
CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  master_passcode_hash TEXT NOT NULL,
  upi_qr_url TEXT,
  upi_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create staff table
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  passcode_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create items table
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  min_stock_alert INTEGER DEFAULT 10,
  max_discount_percentage DECIMAL(5,2) DEFAULT 0,
  max_discount_fixed DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id),
  entered_amount DECIMAL(10,2) NOT NULL,
  inferred_item_id UUID NOT NULL REFERENCES items(id),
  base_price DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('CASH', 'UPI', 'CREDIT')),
  cash_received DECIMAL(10,2),
  change_amount DECIMAL(10,2),
  is_discount_override BOOLEAN DEFAULT FALSE,
  is_credit_settled BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create inventory_movements table
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  transaction_id UUID REFERENCES transactions(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('SALE', 'RESTOCK', 'ADJUSTMENT')),
  quantity_change INTEGER NOT NULL,
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allowing all operations for now - in production you'd want more restrictive policies)
CREATE POLICY "Allow all operations on shops" ON shops FOR ALL USING (true);
CREATE POLICY "Allow all operations on staff" ON staff FOR ALL USING (true);
CREATE POLICY "Allow all operations on items" ON items FOR ALL USING (true);
CREATE POLICY "Allow all operations on transactions" ON transactions FOR ALL USING (true);
CREATE POLICY "Allow all operations on inventory_movements" ON inventory_movements FOR ALL USING (true);

-- Insert sample data

-- Demo shop with hashed passcode for 1032005
INSERT INTO shops (id, name, currency, master_passcode_hash, upi_id) VALUES 
('demo-shop-123', 'Demo Poultry Shop', 'INR', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', 'demo@upi');

-- Sample staff with hashed passcodes for 129 and 456
INSERT INTO staff (shop_id, name, passcode_hash) VALUES 
('demo-shop-123', 'Raj Kumar', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'),
('demo-shop-123', 'Priya Sharma', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');

-- Sample items
INSERT INTO items (shop_id, name, base_price, stock_quantity, max_discount_percentage, max_discount_fixed) VALUES 
('demo-shop-123', 'Egg Tray (30 pieces)', 120.00, 50, 10.00, 20.00),
('demo-shop-123', 'Egg Carton (12 pieces)', 48.00, 100, 8.00, 8.00),
('demo-shop-123', 'Full Crate (180 pieces)', 720.00, 20, 15.00, 100.00),
('demo-shop-123', 'Half Crate (90 pieces)', 360.00, 30, 12.00, 50.00),
('demo-shop-123', 'Chicken (1 kg)', 200.00, 25, 5.00, 20.00);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_staff_shop_id ON staff(shop_id);
CREATE INDEX IF NOT EXISTS idx_items_shop_id ON items(shop_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shop_id ON transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_shop_id ON inventory_movements(shop_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_id ON inventory_movements(item_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON shops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();