import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBusinesses } from '@/hooks/useBusinesses';
import { useUpdateInvoice } from '@/hooks/useInvoices';
import { createInvoice } from '@/lib/accountingService';
import { calculateIGV, formatCurrency } from '@/lib/calculations';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Invoice } from '@/types/accounting';

const invoiceItemSchema = z.object({
  description: z.string().min(1, 'Descripcion requerida'),
  quantity: z.number().min(1, 'Cantidad debe ser mayor a 0'),
  unitPrice: z.number().min(0.01, 'Precio debe ser mayor a 0'),
});

const invoiceSchema = z.object({
  date: z.string().min(1, 'Fecha requerida'),
  businessId: z.string().min(1, 'Negocio requerido'),
  clientSupplier: z.string().min(1, 'Cliente/Proveedor requerido'),
  ruc: z.string().optional(),
  invoiceNumber: z.string().min(1, 'Numero de factura requerido'),
  items: z.array(invoiceItemSchema).min(1, 'Debe agregar al menos un item'),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

interface InvoiceFormProps {
  type: 'sale' | 'purchase';
  onClose: () => void;
  editInvoice?: Invoice | null;
}

export function InvoiceForm({ type, onClose, editInvoice }: InvoiceFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: businesses, isLoading: businessesLoading } = useBusinesses();
  const updateInvoice = useUpdateInvoice();
  
  const isEditing = !!editInvoice;

  const { register, handleSubmit, control, setValue, watch, reset, formState: { errors } } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      items: [{ description: '', quantity: 1, unitPrice: 0 }],
    },
  });

  useEffect(() => {
    if (editInvoice) {
      reset({
        date: editInvoice.date,
        businessId: editInvoice.businessId,
        clientSupplier: editInvoice.clientSupplier,
        ruc: editInvoice.ruc || '',
        invoiceNumber: editInvoice.invoiceNumber,
        items: [{ 
          description: 'Items de factura', 
          quantity: 1, 
          unitPrice: editInvoice.subtotal 
        }],
      });
    }
  }, [editInvoice, reset]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const items = watch('items');
  const selectedBusinessId = watch('businessId');
  
  const subtotal = items.reduce((sum, item) => {
    return sum + (item.quantity || 0) * (item.unitPrice || 0);
  }, 0);
  
  const igv = calculateIGV(subtotal);
  const total = subtotal + igv;

  const onSubmit = async (data: InvoiceFormData) => {
    setIsSubmitting(true);
    try {
      if (isEditing && editInvoice) {
        await updateInvoice.mutateAsync({
          id: editInvoice.id,
          date: data.date,
          invoice_number: data.invoiceNumber,
          client_supplier: data.clientSupplier,
          ruc: data.ruc,
          subtotal,
          igv,
          total,
        });
        toast.success('Factura actualizada correctamente');
      } else {
        await createInvoice({
          type,
          date: data.date,
          businessId: data.businessId,
          clientSupplier: data.clientSupplier,
          ruc: data.ruc,
          invoiceNumber: data.invoiceNumber,
          items: data.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          subtotal,
          igv,
          total,
        });
        toast.success('Factura registrada con asiento contable');
      }
      onClose();
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error(isEditing ? 'Error al actualizar la factura' : 'Error al registrar la factura');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <Label>Fecha</Label>
          <Input type="date" {...register('date')} />
          {errors.date && <p className="mt-1 text-sm text-destructive">{errors.date.message}</p>}
        </div>

        <div>
          <Label>Negocio</Label>
          <Select 
            value={selectedBusinessId} 
            onValueChange={(value) => setValue('businessId', value)} 
            disabled={businessesLoading || isEditing}
          >
            <SelectTrigger>
              <SelectValue placeholder={businessesLoading ? 'Cargando...' : 'Seleccionar'} />
            </SelectTrigger>
            <SelectContent>
              {businesses?.map((business) => (
                <SelectItem key={business.id} value={business.id}>
                  {business.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.businessId && <p className="mt-1 text-sm text-destructive">{errors.businessId.message}</p>}
        </div>

        <div>
          <Label>N° Factura</Label>
          <Input {...register('invoiceNumber')} placeholder="F001-00001" />
          {errors.invoiceNumber && <p className="mt-1 text-sm text-destructive">{errors.invoiceNumber.message}</p>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>{type === 'sale' ? 'Cliente' : 'Proveedor'}</Label>
          <Input {...register('clientSupplier')} />
          {errors.clientSupplier && <p className="mt-1 text-sm text-destructive">{errors.clientSupplier.message}</p>}
        </div>
        <div>
          <Label>RUC (opcional)</Label>
          <Input {...register('ruc')} placeholder="20123456789" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base">Items</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Agregar Item
          </Button>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label>Descripcion</Label>
              <Input {...register(`items.${index}.description`)} />
            </div>
            <div>
              <Label>Cantidad</Label>
              <Input type="number" {...register(`items.${index}.quantity`, { valueAsNumber: true })} />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>Precio Unit.</Label>
                <Input type="number" step="0.01" {...register(`items.${index}.unitPrice`, { valueAsNumber: true })} />
              </div>
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-6"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-secondary/30 p-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="financial-number font-medium">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">IGV (18%):</span>
            <span className="financial-number font-medium">{formatCurrency(igv)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-lg font-bold">
            <span>Total:</span>
            <span className="financial-number">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? 'Actualizar Factura' : 'Guardar Factura'}
        </Button>
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
