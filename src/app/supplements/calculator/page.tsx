import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { SupplementsCalculator } from '@/components/supplements/supplements-calculator';
import { getCurrentUser } from '@/lib/auth';

export const metadata = { title: 'حاسبة المكملات الذكية' };

export default async function SupplementsCalculatorPage() {
  const user = await getCurrentUser();
  return (
    <>
      <Navbar isLoggedIn={!!user} user={user} />
      <main className="water-bg min-h-[70vh]">
        <div className="container-app py-12">
          <SupplementsCalculator />
        </div>
      </main>
      <Footer />
    </>
  );
}
