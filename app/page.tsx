// app/page.tsx
import MarketDashboard from '@/components/MarketDashboard';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 selection:bg-emerald-100">
      <MarketDashboard />
    </main>
  );
}
