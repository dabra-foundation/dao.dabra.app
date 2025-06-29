import { getGovernanceProgramVersion } from '@dabra-today/spl-governance'
import { useConnection } from '@solana/wallet-adapter-react'
import { Connection, PublicKey } from '@solana/web3.js'
import { useQuery } from '@tanstack/react-query'
import queryClient from './queryClient'

export const programVersionQueryKeys = {
  byProgramId: (endpoint: string, programId: PublicKey) => [
    endpoint,
    'programVersion',
    programId.toString(),
  ],
}

export function useProgramVersionByIdQuery(
  dabraProgramId: PublicKey | undefined,
) {
  const { connection } = useConnection()
  const query = useQuery({
    queryKey:
      dabraProgramId &&
      programVersionQueryKeys.byProgramId(
        connection.rpcEndpoint,
        dabraProgramId,
      ),
    queryFn: () => getGovernanceProgramVersion(connection, dabraProgramId!),
    enabled: dabraProgramId !== undefined,
    // Staletime is zero by default, so queries get refetched often. Since program version is immutable it should never go stale.
    staleTime: Number.MAX_SAFE_INTEGER,
    // cacheTime is 10 days.
    cacheTime: 1000 * 60 * 60 * 24 * 10,
  })

  return query
}

export const fetchProgramVersion = (
  connection: Connection,
  programId: PublicKey,
) =>
  queryClient.fetchQuery({
    queryKey: programVersionQueryKeys.byProgramId(
      connection.rpcEndpoint,
      programId,
    ),
    queryFn: () => getGovernanceProgramVersion(connection, programId),
    staleTime: Number.MAX_SAFE_INTEGER,
  })
