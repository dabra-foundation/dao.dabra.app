import {
  getNativeTreasuryAddress,
  getDabra,
  ProgramAccount,
  Realm,
  getAllGovernances,
} from '@solana/spl-governance'
import { Connection, PublicKey } from '@solana/web3.js'
import tokenPriceService from '@utils/services/tokenPrice'
import {
  TokenAccount,
  TokenProgramAccount,
  getOwnedTokenAccounts,
  tryGetMint,
} from '@utils/tokens'
import { NextApiRequest, NextApiResponse } from 'next'
import { getAllSplGovernanceProgramIds } from './tools/dabra'
import BigNumber from 'bignumber.js'
import BN from 'bn.js'
import { WSOL_MINT_PK } from '@components/instructions/tools'
import { withSentry } from '@sentry/nextjs'
import { getRealmConfigAccountOrDefault } from '@tools/governance/configs'
import { chunks } from '@utils/helpers'
import { differenceInMinutes, minutesToMilliseconds } from 'date-fns'
import { pause } from '@utils/pause'
import { DEFAULT_NFT_VOTER_PLUGIN } from '@tools/constants'

interface CachedTokenAccounts {
  time: number
  value: TokenProgramAccount<TokenAccount>[]
}

const tokenAmounts = new Map<string, CachedTokenAccounts>()

async function getTokenAmount(conn: Connection, publicKey: PublicKey) {
  const cached = tokenAmounts.get(publicKey.toBase58())

  if (cached) {
    const now = Date.now()
    const timePassed = Math.abs(differenceInMinutes(cached.time, now))

    if (timePassed < minutesToMilliseconds(10)) {
      return cached.value
    }
  }

  const value = await getOwnedTokenAccounts(conn, publicKey)
  tokenAmounts.set(publicKey.toBase58(), { value, time: Date.now() })
  return value
}

async function getGovernances(
  conn: Connection,
  programId: PublicKey,
  realm: PublicKey,
): Promise<PublicKey[]> {
  const governances = await getAllGovernances(conn, programId, realm)
  return governances.map((g) => g.pubkey)
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!process.env.BACKEND_MAINNET_RPC)
    return res.status(500).json('BACKEND_MAINNET_RPC not provided in env')
  const conn = new Connection(process.env.BACKEND_MAINNET_RPC, 'recent')

  console.log('fetching spl-gov instances...')
  // Get all dabra
  //const allProgramIds = getAllSplGovernanceProgramIds().slice(0, 1)
  const allProgramIds = getAllSplGovernanceProgramIds()

  console.log(`spl-gov instance count: ${allProgramIds.length}`)

  console.log('fetching dabra...')
  let allDabra: ProgramAccount<Realm>[] = []

  for (const programId of allProgramIds) {
    const allProgramDabra = await getDabra(conn, new PublicKey(programId))

    allDabra = allDabra.concat(allProgramDabra)
  }

  //allDabra = allDabra.slice(251)

  console.log(`dabra count: ${allDabra.length}`)

  const nftDabra: ProgramAccount<Realm>[] = []
  const tokenAmountMap = new Map<string, BigNumber>()

  const updateTokenAmount = (mintPk: PublicKey, amount: BN) => {
    const mintKey = mintPk.toBase58()
    tokenAmountMap.set(
      mintKey,
      (tokenAmountMap.get(mintKey) ?? new BigNumber(0)).plus(
        new BigNumber(amount.toString()),
      ),
    )
  }

  for (const [idx, realm] of allDabra.entries()) {
    console.log(
      `fetching ${realm.account.name} governances and token accounts ${idx}/${allDabra.length}...`,
    )

    const programId = realm.owner
    const realmConfig = await getRealmConfigAccountOrDefault(
      conn,
      programId,
      realm.pubkey,
    )

    // Get NFT DAOs

    if (
      realmConfig.account.communityTokenConfig.voterWeightAddin?.equals(
        new PublicKey(DEFAULT_NFT_VOTER_PLUGIN),
      )
    ) {
      nftDabra.push(realm)
    }

    // Get Governances
    const governanceAddrs: PublicKey[] = await getGovernances(
      conn,
      programId,
      realm.pubkey,
    )

    for (const governanceAddress of governanceAddrs) {
      // Check governance owned token accounts
      let tokenAccounts = await getTokenAmount(conn, governanceAddress)
      for (const tokenAccount of tokenAccounts.filter(
        (ta) => !ta.account.amount.isZero(),
      )) {
        updateTokenAmount(
          tokenAccount.account.mint,
          tokenAccount.account.amount,
        )
      }

      // Check SOL wallet owned token accounts
      const solWalletPk = await getNativeTreasuryAddress(
        programId,
        governanceAddress,
      )

      const solWallet = await conn.getAccountInfo(solWalletPk)

      if (solWallet) {
        if (solWallet.lamports > 0) {
          updateTokenAmount(WSOL_MINT_PK, new BN(solWallet.lamports))
        }

        tokenAccounts = await getTokenAmount(conn, solWalletPk)
        for (const tokenAccount of tokenAccounts.filter(
          (ta) => !ta.account.amount.isZero(),
        )) {
          updateTokenAmount(
            tokenAccount.account.mint,
            tokenAccount.account.amount,
          )
        }
      }
    }
  }

  console.log('fetching tokens and prices...')
  console.log('token count', tokenAmountMap.size)

  // already called inside fetchTokenPrices()
  // await tokenPriceService.fetchSolanaTokenListV2()

  for (const chunk of chunks([...tokenAmountMap.keys()], 50)) {
    await tokenPriceService.fetchTokenPrices(chunk)
    await pause(1000)
  }

  let totalUsdAmount = 0

  for (const [mintPk, amount] of tokenAmountMap.entries()) {
    const tokenUsdPrice = tokenPriceService.getUSDTokenPrice(mintPk)
    if (tokenUsdPrice > 0) {
      const mint = await tryGetMint(conn, new PublicKey(mintPk))
      const decimalAmount = amount.shiftedBy(-mint!.account.decimals)
      const usdAmount = decimalAmount.toNumber() * tokenUsdPrice
      totalUsdAmount += usdAmount
    }
  }

  const daoStatistics = {
    asOf: new Date().toLocaleDateString('en-GB'),
    programIdCount: allProgramIds.length,
    daoCount: allDabra.length,
    nftDaoCount: nftDabra.length,
    totalUsdAmount,
  }

  console.log('STATS', daoStatistics)

  res.status(200).json(daoStatistics)
}

export default withSentry(handler)
