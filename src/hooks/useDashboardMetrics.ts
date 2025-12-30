import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getDateRangeFromPeriod } from '@/lib/periodUtils';
import { CurrencyMetrics, DashboardMetricsResponse } from '@/types/accounting';

interface UseDashboardMetricsOptions {
  businessId?: string;
  period?: string;
}

export function useDashboardMetrics(options: UseDashboardMetricsOptions = {}) {
  const { businessId = 'all', period = 'current-month' } = options;
  const { startDate, endDate } = getDateRangeFromPeriod(period);

  return useQuery({
    queryKey: ['dashboard_metrics', businessId, period],
    queryFn: async (): Promise<DashboardMetricsResponse> => {
      try {
        // Fetch all transactions for the period
        let transactionsQuery = supabase
          .from('transactions')
          .select('*');

        // Only add date filters if they're not empty
        if (startDate) {
          transactionsQuery = transactionsQuery.gte('date', startDate);
        }
        if (endDate) {
          transactionsQuery = transactionsQuery.lte('date', endDate);
        }

        if (businessId !== 'all') {
          transactionsQuery = transactionsQuery.eq('business_id', businessId);
        }

        const { data: transactions, error: transactionsError } = await transactionsQuery;
        if (transactionsError) {
          console.error('Error fetching transactions:', transactionsError);
          throw transactionsError;
        }

        console.log('Fetched transactions:', transactions?.length, 'for period:', period, 'businessId:', businessId);

        // Group transactions by currency
        const groupedByCurrency = new Map<string, typeof transactions>();
        (transactions || []).forEach(transaction => {
          const currency = (transaction.currency && transaction.currency.trim()) || 'PEN'; // Default to PEN if not specified or empty
          if (!groupedByCurrency.has(currency)) {
            groupedByCurrency.set(currency, []);
          }
          groupedByCurrency.get(currency)!.push(transaction);
        });

        console.log('Grouped currencies:', Array.from(groupedByCurrency.keys()));

        // Calculate metrics for each currency
        const currencyMetrics: CurrencyMetrics[] = [];
        const availableCurrencies = Array.from(groupedByCurrency.keys()).sort();

      for (const currency of availableCurrencies) {
        const currencyTransactions = groupedByCurrency.get(currency) || [];

        const totalIncome = currencyTransactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const totalExpenses = currencyTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const netProfit = totalIncome - totalExpenses;
        const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
        const cashFlow = currencyTransactions
          .filter(t => t.type === 'transfer')
          .reduce((sum, t) => sum + Number(t.amount), 0);

        // Calculate IGV totals only for PEN currency (IGV is Peruvian tax)
        let igvCompras = 0;
        let igvVentas = 0;
        let creditoFiscalNeto = 0;

        if (currency === 'PEN') {
          try {
            const { data: igvData } = await supabase
              .rpc('calculate_igv_totals', {
                business_filter: businessId === 'all' ? null : businessId,
                start_date: startDate || null,
                end_date: endDate || null,
              });

            const igvResult = igvData?.[0] || { igv_ventas: 0, igv_compras: 0, credito_fiscal: 0 };
            igvCompras = Number(igvResult.igv_compras) || 0;
            igvVentas = Number(igvResult.igv_ventas) || 0;
            creditoFiscalNeto = Number(igvResult.credito_fiscal) || 0;
          } catch (e) {
            console.error('Error calculating IGV:', e);
          }
        }

        // Calculate monthly trend for this currency
        const monthlyTrend = await calculateMonthlyTrendByCurrency(
          businessId,
          period,
          currency
        );

        currencyMetrics.push({
          currency,
          totalIncome,
          totalExpenses,
          netProfit,
          profitMargin,
          cashFlow,
          igvCompras,
          igvVentas,
          creditoFiscalNeto,
          monthlyTrend,
        });
      }

      return {
        currencyMetrics,
        availableCurrencies,
      };
      } catch (error) {
        console.error('Error calculating dashboard metrics:', error);
        throw error;
      }
    },
  });
}

async function calculateMonthlyTrendByCurrency(
  businessId: string,
  period: string,
  currency: string
): Promise<Array<{ mes: string; ingresos: number; egresos: number }>> {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const result: Array<{ mes: string; ingresos: number; egresos: number }> = [];

  const isSpecificMonth = /^\d{4}-\d{2}$/.test(period);

  let monthsToShow: Array<{ year: number; month: number }> = [];

  if (isSpecificMonth) {
    const [year, month] = period.split('-').map(Number);
    monthsToShow = [{ year, month: month - 1 }];
  } else {
    const now = new Date();
    for (let i = 4; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthsToShow.push({ year: date.getFullYear(), month: date.getMonth() });
    }
  }

  for (const { year, month } of monthsToShow) {
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;

    let query = supabase
      .from('transactions')
      .select('type, amount')
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('currency', currency);

    if (businessId !== 'all') {
      query = query.eq('business_id', businessId);
    }

    const { data: transactions } = await query;

    const ingresos = (transactions || [])
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const egresos = (transactions || [])
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    result.push({
      mes: `${months[month]} ${year}`,
      ingresos,
      egresos,
    });
  }

  return result;
}
