import { Navigate } from 'react-router-dom';
import { KycReview } from '../components/Kyc';
import { MonitoringReview } from '../components/Monitoring';
import { useWallet } from '../wallet';

/** Treasury and partner bank: transaction monitoring (held payments, frozen wallets) and identity checks (KYC). */
export default function ReviewPage() {
  const { token, account } = useWallet();
  if (account.role !== 'admin' && account.role !== 'bank') return <Navigate to="/app" replace />;
  return (
    <>
      <MonitoringReview token={token} account={account} />
      <KycReview token={token} account={account} />
    </>
  );
}
