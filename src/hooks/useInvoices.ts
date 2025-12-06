import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getPeriodDates } from '@/lib/periodUtils';

interface UseInvoicesOptions {
  businessId?: string;
  period?: string;
  type?: 'sale' | 'purchase';
}

export function useInvoices(options: UseInvoicesOptions = {}) {
  return useQuery({
    queryKey: ['invoices', options],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select('*')
        .order('date', { ascending: false });

      if (options.businessId && options.businessId !== 'all') {
        query = query.eq('business_id', options.businessId);
      }

      if (options.type) {
        query = query.eq('type', options.type);
      }

      if (options.period && options.period !== 'all') {
        const { startDate, endDate } = getPeriodDates(options.period);
        if (startDate) query = query.gte('date', startDate);
        if (endDate) query = query.lte('date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      // First, check if there's a transaction linked to this invoice
      const { data: linkedTransactions } = await supabase
        .from('transactions')
        .select('id')
        .eq('invoice_id', invoiceId);

      // Delete linked transactions and their accounting entries
      if (linkedTransactions && linkedTransactions.length > 0) {
        for (const transaction of linkedTransactions) {
          // Delete accounting entry lines first
          const { data: entries } = await supabase
            .from('accounting_entries')
            .select('id')
            .eq('transaction_id', transaction.id);

          if (entries) {
            for (const entry of entries) {
              await supabase
                .from('accounting_entry_lines')
                .delete()
                .eq('entry_id', entry.id);
            }
            
            await supabase
              .from('accounting_entries')
              .delete()
              .eq('transaction_id', transaction.id);
          }

          // Delete the transaction
          await supabase
            .from('transactions')
            .delete()
            .eq('id', transaction.id);
        }
      }

      // Delete accounting entries linked directly to invoice (if any)
      const { data: invoiceEntries } = await supabase
        .from('accounting_entries')
        .select('id')
        .eq('description', `Factura de ${invoiceId}`);

      if (invoiceEntries) {
        for (const entry of invoiceEntries) {
          await supabase
            .from('accounting_entry_lines')
            .delete()
            .eq('entry_id', entry.id);
        }
      }

      // Delete invoice items
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', invoiceId);

      if (itemsError) throw itemsError;

      // Delete the invoice
      const { error: invoiceError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);

      if (invoiceError) throw invoiceError;

      return invoiceId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounting_entries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_metrics'] });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoice: {
      id: string;
      date: string;
      invoice_number: string;
      client_supplier: string;
      ruc?: string;
      subtotal: number;
      igv: number;
      total: number;
    }) => {
      const { id, ...updateData } = invoice;

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_metrics'] });
    },
  });
}
