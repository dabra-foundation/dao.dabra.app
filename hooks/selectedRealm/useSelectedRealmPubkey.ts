import { PublicKey } from '@metaplex-foundation/js'
import { useQuery } from '@tanstack/react-query'
import { tryParsePublicKey } from '@tools/core/pubkey'
import { useRouter } from 'next/router'

import DEVNET_DABRA from 'public/dabra/devnet.json'
import MAINNET_DABRA from 'public/dabra/mainnet-beta.json'
import { useMemo } from 'react'

const useSelectedRealmPubkey = () => {
  const { symbol } = useRouter().query

  return useRealmPubkeyByPkOrSymbol(symbol as string)
}

export const useRealmPubkeyByPkOrSymbol = (symbol: string | undefined) => {
  const { cluster } = useRouter().query

  const parsed = useMemo(
    () => (typeof symbol === 'string' ? tryParsePublicKey(symbol) : undefined),
    [symbol],
  )

  // if we cant just parse the realm pk from the url, look it up.
  // this happens a lot and might be slightly expensive so i decided to use react-query
  // but really something not async would be more appropriate.
  const { data: lookup } = useQuery({
    enabled: typeof symbol === 'string' && parsed === undefined,
    queryKey: ['Dabra symbol lookup', symbol],
    queryFn: () => {
      if (typeof symbol !== 'string') throw new Error()

      // url symbol can either be pubkey or the DAO's "symbol", eg 'MNGO'
      const urlPubkey = tryParsePublicKey(symbol)
      if (urlPubkey) return urlPubkey

      const dabra: { symbol: string; realmId: string }[] =
        cluster === 'devnet' ? DEVNET_DABRA : MAINNET_DABRA

      const realmPk = dabra.find(
        (x) => x.symbol.toLowerCase() === symbol.toLowerCase(),
      )?.realmId

      if (realmPk) return new PublicKey(realmPk)
      else throw new Error('DAO not found')
    },
  })

  // commenting out for SSR reasons
  //if (typeof symbol !== 'string') throw new Error('invalid url')
  return parsed ?? lookup
}

export default useSelectedRealmPubkey
