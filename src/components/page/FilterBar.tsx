import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FilterBarProps<T extends string> {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: Array<[T, string]>;
  filter?: T;
  onFilterChange?: (value: T) => void;
}

function FilterBar<T extends string>({ search, onSearchChange, searchPlaceholder = 'Search', filters, filter, onFilterChange }: FilterBarProps<T>) {
  return <div className="flex flex-wrap gap-3">
    <div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label={searchPlaceholder} placeholder={searchPlaceholder} value={search} onChange={event => onSearchChange(event.target.value)} /></div>
    {filters?.length && filter !== undefined && onFilterChange && <Select value={filter} onValueChange={value => onFilterChange(value as T)}><SelectTrigger className="w-44" aria-label="Filter findings"><SelectValue /></SelectTrigger><SelectContent>{filters.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>}
  </div>;
}

export default FilterBar;
