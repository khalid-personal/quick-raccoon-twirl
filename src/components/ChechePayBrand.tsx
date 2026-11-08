import logo from '@/assets/cheche-pay-logo.svg';

export default function ChechePayBrand({ label = 'Hosted checkout' }: { label?: string }) {
  return <div className="chechepay-theme chechepay-brand flex flex-wrap items-center gap-3 rounded-md border-b-2 border-[var(--chechepay-pink)] bg-white px-3 py-2 text-[var(--chechepay-navy)]">
    <img src={logo} alt="ChechePay logo" className="h-20 w-40 shrink-0 object-contain" width={160} height={80} />
    <p className="min-w-0 text-xs text-[#5b6886]">{label}</p>
  </div>;
}