import React from 'react';
import { WORLD_COUNTRIES } from '@/lib/countries';

interface SearchableCountrySelectProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  allowNone?: boolean;
  disabled?: boolean;
  className?: string;
}

const SearchableCountrySelect: React.FC<SearchableCountrySelectProps> = ({ value, onChange, placeholder = 'Select country', allowNone = false, disabled = false, className }) => <select
  aria-label={placeholder}
  className={`h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ${className ?? ''}`}
  value={value ?? ''}
  disabled={disabled}
  onChange={event => onChange(event.target.value || undefined)}
>
  <option value="">{allowNone ? 'No country' : placeholder}</option>
  {WORLD_COUNTRIES.map(country => <option key={country.code} value={country.code}>{country.code} · {country.name}</option>)}
</select>;

export default SearchableCountrySelect;
