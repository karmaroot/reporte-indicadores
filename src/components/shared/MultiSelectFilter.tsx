import React, { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
  label: string;
  value: string;
}

interface MultiSelectFilterProps {
  placeholder: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  className?: string;
  allLabel?: string;
}

export function MultiSelectFilter({
  placeholder,
  options,
  selectedValues,
  onSelectionChange,
  className,
  allLabel = 'Todos',
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);

  const isAllSelected = selectedValues.length === 0 || selectedValues.includes('all');

  const handleToggleAll = () => {
    onSelectionChange([]);
  };

  const handleToggleOption = (value: string) => {
    if (value === 'all') {
      onSelectionChange([]);
      return;
    }

    let current = selectedValues.filter((v) => v !== 'all');
    if (current.includes(value)) {
      current = current.filter((v) => v !== value);
    } else {
      current = [...current, value];
    }

    onSelectionChange(current);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange([]);
  };

  const activeCount = isAllSelected ? 0 : selectedValues.length;

  let triggerText = placeholder;
  if (!isAllSelected && selectedValues.length > 0) {
    const firstObj = options.find((o) => o.value === selectedValues[0]);
    const firstLabel = firstObj ? firstObj.label : selectedValues[0];
    if (selectedValues.length === 1) {
      triggerText = firstLabel;
    } else {
      triggerText = `${firstLabel} (+${selectedValues.length - 1})`;
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between rounded-xl border-muted/50 bg-background/50 text-left font-normal focus:ring-primary/20 hover:bg-background/80 transition-all h-10 px-3.5',
            !isAllSelected && activeCount > 0 && 'border-primary/40 bg-primary/5 text-primary font-medium',
            className
          )}
        >
          <span className="truncate max-w-[220px] text-sm">{triggerText}</span>
          <div className="flex items-center gap-1.5 ml-2 shrink-0">
            {!isAllSelected && activeCount > 0 && (
              <>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-primary text-primary-foreground font-bold rounded-full">
                  {activeCount}
                </Badge>
                <div
                  role="button"
                  onClick={handleClear}
                  className="p-0.5 hover:bg-rose-100 dark:hover:bg-rose-950/50 hover:text-rose-600 rounded-full transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </div>
              </>
            )}
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[320px] p-2 rounded-2xl border bg-card shadow-lg z-50" align="start">
        <div className="space-y-1">
          {/* Toggle All Option */}
          <div
            onClick={handleToggleAll}
            className="flex items-center space-x-2.5 p-2 rounded-xl hover:bg-muted/60 cursor-pointer transition-colors"
          >
            <Checkbox checked={isAllSelected} onCheckedChange={handleToggleAll} id="select-all" />
            <label htmlFor="select-all" className="text-xs font-bold text-foreground cursor-pointer flex-1 select-none">
              {allLabel} ({options.length})
            </label>
          </div>

          <div className="h-px bg-border/60 my-1" />

          {/* List Options */}
          <div className="max-h-60 overflow-y-auto space-y-0.5 pr-1 custom-scrollbar">
            {options.map((opt) => {
              const checked = !isAllSelected && selectedValues.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  onClick={() => handleToggleOption(opt.value)}
                  className={cn(
                    'flex items-center space-x-2.5 p-2 rounded-xl hover:bg-muted/60 cursor-pointer transition-colors text-xs',
                    checked && 'bg-primary/5 font-semibold text-primary'
                  )}
                >
                  <Checkbox checked={checked} onCheckedChange={() => handleToggleOption(opt.value)} />
                  <span className="truncate flex-1 select-none">{opt.label}</span>
                  {checked && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
