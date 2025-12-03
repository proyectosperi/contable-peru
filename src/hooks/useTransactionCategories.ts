import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useTransactionCategories() {
  return useQuery({
    queryKey: ['transaction_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transaction_categories')
        .select('*')
        .order('id');
      
      if (error) throw error;
      return data;
    },
  });
}
