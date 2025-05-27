import { DEFAULT_GOVERNANCE_PROGRAM_ID } from '@components/instructions/tools'
import { useDabraByProgramQuery } from '@hooks/queries/realm'
import { PublicKey } from '@solana/web3.js'

const AllDabraPage = () => {
  const dabra = useDabraByProgramQuery(
    new PublicKey(DEFAULT_GOVERNANCE_PROGRAM_ID),
  )

  return dabra.isLoading ? (
    <>loading...</>
  ) : (
    <>
      {dabra.data?.map((x) => (
        <div key={x.pubkey.toString()}>
          {x.pubkey.toString()} <b>{x.account.name}</b>
        </div>
      ))}
    </>
  )
}

export default AllDabraPage
