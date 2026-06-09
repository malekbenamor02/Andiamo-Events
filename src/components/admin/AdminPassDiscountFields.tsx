/**
 * Shared admin UI for uniform vs per-pass discount entry (presale + event promo).
 */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EventPass } from '@/pages/admin/types';
import type { PassDiscountDraft } from '@/lib/eventPromo/discountDraft';

export type AdminPassDiscountFieldsProps = {
  language: 'en' | 'fr';
  passes: EventPass[];
  passesLoading?: boolean;
  discountMode: 'uniform' | 'per_pass';
  onDiscountModeChange: (mode: 'uniform' | 'per_pass') => void;
  uniformType: 'percent' | 'fixed';
  uniformValue: string;
  onUniformTypeChange: (type: 'percent' | 'fixed') => void;
  onUniformValueChange: (value: string) => void;
  perPass: Record<string, PassDiscountDraft>;
  onPerPassChange: (
    passId: string,
    patch: Partial<PassDiscountDraft>
  ) => void;
  /** compact = edit panel (smaller controls) */
  variant?: 'create' | 'edit';
  idPrefix?: string;
};

export function AdminPassDiscountFields({
  language,
  passes,
  passesLoading,
  discountMode,
  onDiscountModeChange,
  uniformType,
  uniformValue,
  onUniformTypeChange,
  onUniformValueChange,
  perPass,
  onPerPassChange,
  variant = 'create',
  idPrefix = 'discount',
}: AdminPassDiscountFieldsProps) {
  const isEn = language === 'en';
  const isEdit = variant === 'edit';

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {isEdit ? (
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {isEn ? 'Edit discounts' : 'Modifier les remises'}
          </p>
        ) : null}
        <Select
          value={discountMode}
          onValueChange={(v) => onDiscountModeChange(v as 'uniform' | 'per_pass')}
        >
          <SelectTrigger className={isEdit ? 'h-8 text-xs' : 'h-10 text-sm'}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="uniform">
              {isEn ? 'Same discount for all passes' : 'Même remise pour tous les passes'}
            </SelectItem>
            <SelectItem value="per_pass">
              {isEn ? 'Different per pass' : 'Différent par pass'}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {discountMode === 'uniform' ? (
        <div className="flex rounded-md border border-input bg-background shadow-sm overflow-hidden">
          <Select
            value={uniformType}
            onValueChange={(v) => onUniformTypeChange(v as 'percent' | 'fixed')}
          >
            <SelectTrigger
              className={
                isEdit
                  ? 'h-8 w-[42%] min-w-[5.5rem] shrink-0 rounded-none border-0 border-r border-input bg-transparent shadow-none focus:ring-0 focus:ring-offset-0'
                  : 'h-10 w-[42%] min-w-[7.5rem] shrink-0 rounded-none border-0 border-r border-input bg-transparent shadow-none focus:ring-0 focus:ring-offset-0'
              }
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">% </SelectItem>
              <SelectItem value="fixed">TND</SelectItem>
            </SelectContent>
          </Select>
          <Input
            id={`${idPrefix}-uniform-value`}
            type="number"
            min={isEdit ? 0 : 0.01}
            step="0.01"
            className={
              isEdit
                ? 'h-8 flex-1 min-w-0 rounded-none border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-xs'
                : 'h-10 flex-1 min-w-0 rounded-none border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0'
            }
            placeholder={
              uniformType === 'percent'
                ? isEn
                  ? 'Amount e.g. 10 (= 10% off)'
                  : 'Montant ex. 10 (= 10 %)'
                : isEn
                  ? 'Amount e.g. 15 (= 15 TND off each pass)'
                  : 'Montant ex. 15 (= 15 TND par pass)'
            }
            value={uniformValue}
            onChange={(e) => onUniformValueChange(e.target.value)}
          />
        </div>
      ) : (
        <div
          className={
            isEdit
              ? 'space-y-1.5 max-h-48 overflow-y-auto'
              : 'space-y-1.5 rounded-md border border-border/50 p-2 max-h-48 overflow-y-auto'
          }
        >
          {passesLoading ? (
            <p className={isEdit ? 'text-[10px] text-muted-foreground' : 'text-xs text-muted-foreground'}>
              {isEn ? 'Loading passes…' : 'Chargement des passes…'}
            </p>
          ) : passes.length === 0 ? (
            <p className={isEdit ? 'text-[10px] text-muted-foreground' : 'text-xs text-muted-foreground'}>
              {isEn ? 'Add passes to this event first.' : 'Ajoutez d’abord des passes à l’événement.'}
            </p>
          ) : (
            passes.map((pass) => {
              const row = perPass[pass.id!] ?? {
                discount_type: 'percent' as const,
                discount_value: '',
              };
              return (
                <div
                  key={pass.id}
                  className={
                    isEdit
                      ? 'grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] gap-1.5 items-center'
                      : 'grid grid-cols-[minmax(0,1fr)_4.5rem_5rem] gap-1.5 items-center'
                  }
                >
                  <span
                    className={
                      isEdit
                        ? 'truncate text-[10px] text-foreground'
                        : 'truncate text-xs'
                    }
                  >
                    {pass.name}
                  </span>
                  <Select
                    value={row.discount_type}
                    onValueChange={(v) =>
                      onPerPassChange(pass.id!, { discount_type: v as 'percent' | 'fixed' })
                    }
                  >
                    <SelectTrigger className={isEdit ? 'h-7 text-[10px] px-1' : 'h-8 text-xs px-1'}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">%</SelectItem>
                      <SelectItem value="fixed">TND</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className={isEdit ? 'h-7 text-[10px] px-1' : 'h-8 text-xs px-2'}
                    placeholder="0"
                    value={row.discount_value}
                    onChange={(e) =>
                      onPerPassChange(pass.id!, { discount_value: e.target.value })
                    }
                  />
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
