import { Navigate } from 'react-router-dom';
import { KycReview } from '../components/Kyc';
import { useWallet } from '../wallet';

/** Treasury and partner bank: identity checks (KYC) of new sign-ups. */
export default function ReviewPage() {
  const { token, account } = useWallet();
  if (account.role !== 'admin' && account.role !== 'bank') return <Navigate to="/app" replace />;
  return <KycReview token={token} account={account} />;
}
