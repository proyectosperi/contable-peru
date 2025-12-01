-- Fix search_path for calculate_igv_totals function
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
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix search_path for get_account_balance function
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
$$ LANGUAGE plpgsql SET search_path = public;