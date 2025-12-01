-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types
CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'income', 'expense');
CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer');

-- Table: businesses
CREATE TABLE IF NOT EXISTS public.businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: transaction_categories
CREATE TABLE IF NOT EXISTS public.transaction_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type transaction_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date DATE NOT NULL,
  type transaction_type NOT NULL,
  business_id TEXT NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES public.transaction_categories(id),
  amount DECIMAL(15, 2) NOT NULL,
  description TEXT,
  reference TEXT,
  from_account TEXT,
  to_account TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  type TEXT NOT NULL CHECK (type IN ('sale', 'purchase')),
  date DATE NOT NULL,
  business_id TEXT NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  client_supplier TEXT NOT NULL,
  ruc TEXT,
  subtotal DECIMAL(15, 2) NOT NULL,
  igv DECIMAL(15, 2) NOT NULL,
  total DECIMAL(15, 2) NOT NULL,
  invoice_number TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: invoice_items
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(15, 2) NOT NULL,
  total DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: accounting_entries
CREATE TABLE IF NOT EXISTS public.accounting_entries (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date DATE NOT NULL,
  transaction_id TEXT,
  description TEXT NOT NULL,
  business_id TEXT NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: accounting_entry_lines
CREATE TABLE IF NOT EXISTS public.accounting_entry_lines (
  id SERIAL PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES public.accounting_entries(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  debit DECIMAL(15, 2) DEFAULT 0,
  credit DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_business ON public.transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_invoices_business ON public.invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(date);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_business ON public.accounting_entries(business_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_date ON public.accounting_entries(date);

-- Enable Row Level Security
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entry_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Allow all for now - you can restrict later with authentication)
CREATE POLICY "Allow all operations on businesses" ON public.businesses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on transaction_categories" ON public.transaction_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on invoice_items" ON public.invoice_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on accounting_entries" ON public.accounting_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on accounting_entry_lines" ON public.accounting_entry_lines FOR ALL USING (true) WITH CHECK (true);

-- Insert initial data: businesses
INSERT INTO public.businesses (id, name, color) VALUES
  ('negocio1', 'Negocio Principal', 'hsl(195 85% 35%)'),
  ('negocio2', 'Sucursal Norte', 'hsl(160 75% 45%)'),
  ('negocio3', 'Sucursal Sur', 'hsl(38 92% 50%)')
ON CONFLICT (id) DO NOTHING;

-- Insert initial data: transaction categories
INSERT INTO public.transaction_categories (id, name, type) VALUES
  (1, 'Venta de productos', 'income'),
  (2, 'Venta de servicios', 'income'),
  (3, 'Delivery', 'income'),
  (4, 'Ingresos por comisiones', 'income'),
  (5, 'Ingresos extraordinarios', 'income'),
  (6, 'Devoluciones de gastos', 'income'),
  (7, 'Ingresos financieros (intereses)', 'income'),
  (8, 'Compra de mercadería', 'expense'),
  (9, 'Servicios básicos: Luz', 'expense'),
  (10, 'Servicios básicos: Agua', 'expense'),
  (11, 'Internet y telefonía', 'expense'),
  (12, 'Alquiler local/oficina', 'expense'),
  (13, 'Sueldos y salarios', 'expense'),
  (14, 'Honorarios profesionales', 'expense'),
  (15, 'Publicidad y marketing', 'expense'),
  (16, 'Transporte y movilidad', 'expense'),
  (17, 'Gastos bancarios', 'expense'),
  (18, 'Impuestos y tributos', 'expense'),
  (19, 'Mantenimiento', 'expense'),
  (20, 'Equipos y suministros', 'expense'),
  (21, 'Papelería y útiles', 'expense'),
  (22, 'Seguros', 'expense'),
  (23, 'Capacitación', 'expense'),
  (24, 'Otros gastos operativos', 'expense')
ON CONFLICT (id) DO NOTHING;

-- Helper function to calculate IGV totals
CREATE OR REPLACE FUNCTION calculate_igv_totals(business_filter TEXT DEFAULT NULL, start_date DATE DEFAULT NULL, end_date DATE DEFAULT NULL)
RETURNS TABLE(
  igv_ventas DECIMAL,
  igv_compras DECIMAL,
  credito_fiscal DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN i.type = 'sale' THEN i.igv ELSE 0 END), 0) as igv_ventas,
    COALESCE(SUM(CASE WHEN i.type = 'purchase' THEN i.igv ELSE 0 END), 0) as igv_compras,
    COALESCE(SUM(CASE WHEN i.type = 'sale' THEN i.igv ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN i.type = 'purchase' THEN i.igv ELSE 0 END), 0) as credito_fiscal
  FROM public.invoices i
  WHERE
    (business_filter IS NULL OR i.business_id = business_filter)
    AND (start_date IS NULL OR i.date >= start_date)
    AND (end_date IS NULL OR i.date <= end_date);
END;
$$ LANGUAGE plpgsql;

-- Helper function to get account balance
CREATE OR REPLACE FUNCTION get_account_balance(account_filter TEXT, business_filter TEXT DEFAULT NULL, start_date DATE DEFAULT NULL, end_date DATE DEFAULT NULL)
RETURNS DECIMAL AS $$
DECLARE
  balance DECIMAL;
BEGIN
  SELECT
    COALESCE(SUM(ael.debit), 0) - COALESCE(SUM(ael.credit), 0)
  INTO balance
  FROM public.accounting_entry_lines ael
  JOIN public.accounting_entries ae ON ael.entry_id = ae.id
  WHERE
    ael.account_code = account_filter
    AND (business_filter IS NULL OR ae.business_id = business_filter)
    AND (start_date IS NULL OR ae.date >= start_date)
    AND (end_date IS NULL OR ae.date <= end_date);
  
  RETURN COALESCE(balance, 0);
END;
$$ LANGUAGE plpgsql;