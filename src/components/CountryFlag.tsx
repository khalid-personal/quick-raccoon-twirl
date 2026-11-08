import React from 'react';

interface CountryFlagProps {
  country?: string;
  className?: string;
}

const codesByName: Record<string, string> = {
  ethiopia: 'ET',
  'saudi arabia': 'SA',
  'united arab emirates': 'AE',
  uae: 'AE',
  kuwait: 'KW',
  qatar: 'QA',
  oman: 'OM',
  bahrain: 'BH',
  jordan: 'JO',
  lebanon: 'LB',
  yemen: 'YE',
  'south sudan': 'SS',
  sudan: 'SD',
  kenya: 'KE',
  'united states': 'US',
  'united kingdom': 'GB',
};

const flagEmoji = (code: string): string => String.fromCodePoint(...[...code.toUpperCase()].map(letter => 127397 + letter.charCodeAt(0)));

const CountryFlag: React.FC<CountryFlagProps> = ({ country = '', className }) => {
  const normalized = country.trim();
  const code = /^[a-z]{2}$/i.test(normalized) ? normalized.toUpperCase() : codesByName[normalized.toLowerCase()];
  return <span aria-label={`${normalized || 'Unknown'} flag`} role="img" className={className}>{code ? flagEmoji(code) : '🌐'}</span>;
};

export default CountryFlag;
