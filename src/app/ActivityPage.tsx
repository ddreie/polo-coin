import Activity from '../components/Activity';
import { useWallet } from '../wallet';

export default function ActivityPage() {
  const { account, txs } = useWallet();
  return <Activity account={account} txs={txs} />;
}
