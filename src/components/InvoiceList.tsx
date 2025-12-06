import { Invoice } from '@/types/accounting';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/calculations';
import { useBusinesses } from '@/hooks/useBusinesses';
import { Pencil, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface InvoiceListProps {
  invoices: Invoice[];
  onEdit?: (invoice: Invoice) => void;
  onDelete?: (invoiceId: string) => void;
}

export function InvoiceList({ invoices, onEdit, onDelete }: InvoiceListProps) {
  const { data: businesses } = useBusinesses();

  const getBusinessName = (businessId: string) => {
    return businesses?.find(b => b.id === businessId)?.name || businessId;
  };

  if (invoices.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No hay facturas registradas</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">Fecha</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">N° Factura</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Negocio</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                {invoices[0]?.type === 'sale' ? 'Cliente' : 'Proveedor'}
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold">RUC</th>
              <th className="px-6 py-3 text-right text-sm font-semibold">Subtotal</th>
              <th className="px-6 py-3 text-right text-sm font-semibold">IGV</th>
              <th className="px-6 py-3 text-right text-sm font-semibold">Total</th>
              <th className="px-6 py-3 text-center text-sm font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 text-sm">
                  {new Date(invoice.date).toLocaleDateString('es-PE')}
                </td>
                <td className="px-6 py-4">
                  <Badge variant="outline">{invoice.invoiceNumber}</Badge>
                </td>
                <td className="px-6 py-4 text-sm">{getBusinessName(invoice.businessId)}</td>
                <td className="px-6 py-4 text-sm">{invoice.clientSupplier}</td>
                <td className="px-6 py-4 text-sm font-mono">{invoice.ruc || '-'}</td>
                <td className="px-6 py-4 text-right">
                  <span className="financial-number text-sm">{formatCurrency(invoice.subtotal)}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="financial-number text-sm text-muted-foreground">
                    {formatCurrency(invoice.igv)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span
                    className={`financial-number text-sm font-semibold ${
                      invoice.type === 'sale' ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {formatCurrency(invoice.total)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(invoice)}
                        className="h-8 w-8"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {onDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminar factura</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta accion eliminara la factura {invoice.invoiceNumber} y sus registros contables asociados. Esta accion no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => onDelete(invoice.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
