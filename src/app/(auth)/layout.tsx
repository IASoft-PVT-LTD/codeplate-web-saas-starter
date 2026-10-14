import { Logo } from '@/components/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="mb-8"><Logo /></div>
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-paper p-8 shadow-sm">{children}</div>
    </div>
  );
}
