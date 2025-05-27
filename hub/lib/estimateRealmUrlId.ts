import type { PublicKey } from '@solana/web3.js';

import dabra from 'public/dabra/mainnet-beta.json';

export function estimateRealmUrlId(realm: PublicKey) {
  for (const jsonRealm of dabra) {
    if (jsonRealm.realmId === realm.toBase58() && jsonRealm.symbol) {
      return jsonRealm.symbol;
    }
  }

  return realm.toBase58();
}
