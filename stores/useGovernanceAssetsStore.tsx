import create, { State } from 'zustand'
import axios from 'axios'
import {
  getNativeTreasuryAddress,
  Governance,
  Realm,
  TOKEN_PROGRAM_ID,
  ProgramAccount,
  GovernanceAccountType,
} from '@dabra-today/spl-governance'
import {
  LAMPORTS_PER_SOL,
  ParsedAccountData,
  PublicKey,
  StakeProgram,
} from '@solana/web3.js'
import { MintInfo, u64 } from '@solana/spl-token'
import {
  AUXILIARY_TOKEN_ACCOUNTS,
  DEFAULT_NATIVE_SOL_MINT,
  DEFAULT_NFT_TREASURY_MINT,
  HIDDEN_GOVERNANCES,
  HIDDEN_TREASURES,
  WSOL_MINT,
} from '@components/instructions/tools'
import {
  AccountInfoGen,
  getMultipleAccountInfoChunked,
  MintAccount,
  parseMintAccountData,
  TokenAccount,
  TokenProgramAccount,
} from '@utils/tokens'
import { parseTokenAccountData } from '@utils/parseTokenAccountData'
import tokenPriceService from '@utils/services/tokenPrice'
import { ConnectionContext } from '@utils/connection'
import {
  AccountType,
  AccountTypeGeneric,
  AccountTypeAuxiliaryToken,
  AccountTypeMint,
  AccountTypeNFT,
  AccountTypeProgram,
  AccountTypeSol,
  AccountTypeToken,
  AssetAccount,
  GovernanceProgramAccountWithNativeTreasuryAddress,
  AccountTypeStake,
  StakeState,
  isToken2022,
} from '@utils/uiTypes/assets'
import group from '@utils/group'
import { getFilteredProgramAccounts } from '@utils/helpers'
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes'
import { AccountLayout, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token-new'

const additionalPossibleMintAccounts = {
  Mango: [
    new PublicKey('EGk8Gw7Z484mzAKb7GwCcqrZd4KwwsyU2Dv9woY6uDQu'),
    new PublicKey('8gjzxiqcU87cvRc7hFiUJgxqLSV7AQnSttfWC5fD9aim'),
    new PublicKey('G1Yc5696GcfL28uAWG6iCaKJwZd8sQzwPJTc2UacsjHN'),
    new PublicKey('oW7juZxrhaGvWw5giRp3P3qTHEZpg2t8n8aXTCpBjNK'),
  ],
}
const tokenAccountOwnerOffset = 32
const programAccountOwnerOffset = 13

interface SolAccInfo {
  governancePk: PublicKey
  acc: any
  nativeSolAddress: PublicKey
}

interface GovernanceAssetsStore extends State {
  governancesArray: ProgramAccount<Governance>[]
  governedTokenAccounts: AssetAccount[]
  assetAccounts: AssetAccount[]
  loadGovernedAccounts: boolean
  loadTokenAccounts: boolean
  loadProgramAccounts: boolean
  loadMintAccounts: boolean
  setGovernancesArray: (
    connection: ConnectionContext,
    realm: ProgramAccount<Realm>,
    governances: ProgramAccount<Governance>[],
  ) => void
  getGovernedAccounts: (
    connection: ConnectionContext,
    realm: ProgramAccount<Realm>,
  ) => Promise<void>
  refetchGovernanceAccounts: (
    connection: ConnectionContext,
    realm: ProgramAccount<Realm>,
    governancePk: PublicKey,
  ) => Promise<void>
}

const defaultState = {
  governancesArray: [],
  assetAccounts: [],
  governedTokenAccounts: [],
  loadGovernedAccounts: false,
  loadTokenAccounts: false,
  loadProgramAccounts: false,
  loadMintAccounts: false,
}

const useGovernanceAssetsStore = create<GovernanceAssetsStore>((set, _get) => ({
  ...defaultState,

  setGovernancesArray: (
    connection: ConnectionContext,
    realm: ProgramAccount<Realm>,
    governances: ProgramAccount<Governance>[],
  ) => {
    const array: ProgramAccount<Governance>[] = governances.filter(
      (gov) => !HIDDEN_GOVERNANCES.has(gov.pubkey.toString()),
    )

    set((s) => {
      s.governancesArray = array
    })

    _get().getGovernedAccounts(connection, realm)
  },

  getGovernedAccounts: async (connection, realm) => {
    set((s) => {
      s.loadGovernedAccounts = true
      s.loadTokenAccounts = true
      s.loadMintAccounts = true
      s.loadProgramAccounts = true
      s.governedTokenAccounts = []
      s.assetAccounts = []
    })

    const governancesArray = _get().governancesArray
    const accounts: AssetAccount[] = []
    const nativeAddresses = [
      ...governancesArray.map((x) => {
        const [signatoryRecordAddress] = PublicKey.findProgramAddressSync(
          [Buffer.from('native-treasury'), x.pubkey.toBuffer()],
          realm.owner,
        )
        return signatoryRecordAddress
      }),
    ]
    const governancesWithNativeTreasuryAddress = governancesArray.map(
      (x, index) => ({
        ...x,
        nativeTreasuryAddress: nativeAddresses[index],
      }),
    )
    //due to long request for mint accounts that are owned by every governance
    //we fetch
    const possibleMintAccountPks = [
      realm.account.communityMint,
      realm.account.config.councilMint,
    ].filter((x) => typeof x !== 'undefined') as PublicKey[]

    const additionalMintAccounts =
      additionalPossibleMintAccounts[realm.account.name]

    if (additionalMintAccounts) {
      possibleMintAccountPks.push(...additionalMintAccounts)
    }
    // 1 - Load token accounts behind any type of governance
    const governedTokenAccounts = await loadGovernedTokenAccounts(
      connection,
      realm,
      governancesWithNativeTreasuryAddress,
    )
    // 2 - Call to fetch token prices for every token account's mints
    await tokenPriceService.fetchTokenPrices(
      governedTokenAccounts.reduce((mints, governedTokenAccount) => {
        if (!governedTokenAccount.extensions.mint?.publicKey) {
          return mints
        }

        return [
          ...mints,
          governedTokenAccount.extensions.mint.publicKey.toBase58(),
        ]
      }, [] as string[]),
    )
    accounts.push(...governedTokenAccounts)
    const stakeAccounts = await loadStakeAccounts(
      connection,
      governedTokenAccounts.filter((x) => x.isSol),
    )
    accounts.push(...stakeAccounts)

    set((s) => {
      s.loadTokenAccounts = false
      s.governedTokenAccounts = accounts
        .filter(
          (x) =>
            x.type === AccountType.TOKEN ||
            x.type === AccountType.NFT ||
            x.type === AccountType.SOL,
        )
        .filter(filterOutHiddenAccounts)
      s.assetAccounts = accounts.filter(filterOutHiddenAccounts)
    })

    // 3 - Load accounts related to mint
    const mintAccounts = await loadMintGovernanceAccounts(
      connection,
      governancesWithNativeTreasuryAddress,
      possibleMintAccountPks,
    )
    accounts.push(...mintAccounts)
    set((s) => {
      s.loadMintAccounts = false
      s.assetAccounts = accounts.filter(filterOutHiddenAccounts)
    })

    // 4 - Load accounts related to program governances
    const programAccounts = await getProgramAssetAccounts(
      connection,
      governancesWithNativeTreasuryAddress,
    )
    accounts.push(...programAccounts)
    set((s) => {
      s.loadProgramAccounts = false
      s.assetAccounts = accounts.filter(filterOutHiddenAccounts)
    })

    // 5 - Create generic asset accounts for governance's governedAccounts that have not been handled yet
    // We do this so theses accounts may be selected
    const genericGovernances = getGenericAssetAccounts(
      governancesWithNativeTreasuryAddress.filter(
        (governance) =>
          !accounts.some((account) =>
            account.pubkey.equals(governance.account.governedAccount),
          ),
      ),
    )
    accounts.push(...genericGovernances)

    set((s) => {
      s.loadGovernedAccounts = false
      s.assetAccounts = accounts.filter(filterOutHiddenAccounts)
    })
  },
  refetchGovernanceAccounts: async (
    connection: ConnectionContext,
    realm: ProgramAccount<Realm>,
    governancePk: PublicKey,
  ) => {
    set((s) => {
      s.loadGovernedAccounts = false
    })

    const governancesArray = _get().governancesArray.filter((x) =>
      x.pubkey.equals(governancePk),
    )

    const previousAccounts = _get().assetAccounts.filter(
      (x) => !x.governance.pubkey.equals(governancePk),
    )

    const accounts = await getAccountsForGovernances(
      connection,
      realm,
      governancesArray,
    )

    set((s) => {
      s.loadGovernedAccounts = false
      s.governedTokenAccounts = [...previousAccounts, ...accounts]
        .filter(
          (x) =>
            x.type === AccountType.TOKEN ||
            x.type === AccountType.NFT ||
            x.type === AccountType.SOL,
        )
        .filter(filterOutHiddenAccounts)
      s.assetAccounts = [...previousAccounts, ...accounts].filter(
        filterOutHiddenAccounts,
      )
    })
  },
}))
export default useGovernanceAssetsStore

const getTokenAccountObj = (
  governance: GovernanceProgramAccountWithNativeTreasuryAddress,
  tokenAccount: TokenProgramAccount<TokenAccount>,
  mintAccounts: TokenProgramAccount<MintInfo>[],
): AccountTypeNFT | AccountTypeToken | null => {
  const isNftAccount =
    tokenAccount.account.mint.toBase58() === DEFAULT_NFT_TREASURY_MINT

  const mint = mintAccounts.find((x) =>
    x.publicKey.equals(tokenAccount.account.mint),
  )!

  if (isNftAccount && !isToken2022(tokenAccount.account)) {
    return new AccountTypeNFT(
      tokenAccount as TokenProgramAccount<TokenAccount>,
      mint,
      governance,
    )
  }

  if (
    mint.account.supply &&
    mint.account.supply.cmpn(1) !== 0 &&
    mint.publicKey.toBase58() !== DEFAULT_NATIVE_SOL_MINT
  ) {
    return new AccountTypeToken(
      tokenAccount as TokenProgramAccount<TokenAccount>,
      mint!,
      governance,
    )
  }

  return null
}

const getSolAccountsObj = async (
  solAccountsInfo: SolAccInfo[],
  mintAccounts: TokenProgramAccount<MintAccount>[],
  governances: GovernanceProgramAccountWithNativeTreasuryAddress[],
): Promise<AssetAccount[]> => {
  const solAccounts: AccountTypeSol[] = []

  const wsolMintAccount = mintAccounts.find(
    (x) => x.publicKey.toBase58() === WSOL_MINT,
  )! // WSOL should be here

  for (const solAccountInfo of solAccountsInfo) {
    const governance = governances.find((x) =>
      x.pubkey.equals(solAccountInfo.governancePk),
    )! // Governance should be here

    const account = getSolAccountObj(
      governance,
      wsolMintAccount,
      solAccountInfo,
    )

    if (account) {
      solAccounts.push(account)
    }
  }

  return solAccounts
}

// Return array without duplicates
const uniquePublicKey = (array: PublicKey[]): PublicKey[] => {
  return Array.from(
    array.reduce((mintsPks, publicKey) => {
      // Transform to string for Set to be able to identify duplicates
      mintsPks.add(publicKey.toBase58())

      return mintsPks
    }, new Set<string>()),
  ).map((address) => new PublicKey(address))
}

const getTokenAssetAccounts = async (
  tokenAccounts: {
    publicKey: PublicKey
    account: TokenAccount
  }[],
  governances: GovernanceProgramAccountWithNativeTreasuryAddress[],
  connection: ConnectionContext,
) => {
  const accounts: AssetAccount[] = []

  const mintsPks = uniquePublicKey(
    tokenAccounts.map((tokenAccount) => tokenAccount.account.mint),
  )

  // WSOL must be in the mintsPks array
  // WSOL is used as mint for sol accounts to calculate amounts
  if (!mintsPks.some((x) => x.toBase58() === WSOL_MINT)) {
    mintsPks.push(new PublicKey(WSOL_MINT))
  }

  const govNativeSolAddress = governances.map((x) => ({
    governanceAcc: x,
    governancePk: x.pubkey,
    nativeSolAddress: x.nativeTreasuryAddress,
  }))

  const [solAccountsInfo, mintAccounts] = await Promise.all([
    getSolAccountsInfo(connection, govNativeSolAddress),
    getMintAccountsInfo(connection, mintsPks),
  ])

  for (const tokenAccount of tokenAccounts) {
    let governance = governances.find(
      (x) => x.pubkey.toBase58() === tokenAccount.account.owner.toBase58(),
    )
    const nativeSolAddress = govNativeSolAddress.find((x) =>
      x.nativeSolAddress.equals(tokenAccount.account.owner),
    )?.nativeSolAddress

    if (!governance && nativeSolAddress) {
      governance = govNativeSolAddress.find((x) =>
        x.nativeSolAddress.equals(nativeSolAddress),
      )?.governanceAcc
    }

    if (governance) {
      const account = getTokenAccountObj(
        governance!,
        tokenAccount,
        mintAccounts,
      )
      if (account) {
        accounts.push(account)
      }
    } else if (
      [...Object.values(AUXILIARY_TOKEN_ACCOUNTS).flatMap((x) => x)].find((x) =>
        x.accounts.includes(tokenAccount.publicKey.toBase58()),
      )
    ) {
      const mint = mintAccounts.find(
        (x) => x.publicKey.toBase58() === tokenAccount.account.mint.toBase58(),
      )

      if (mint && !isToken2022(tokenAccount.account)) {
        const account = new AccountTypeAuxiliaryToken(
          tokenAccount as TokenProgramAccount<TokenAccount>,
          mint,
        )

        if (account) {
          accounts.push(account)
        }
      }
    }
  }

  const solAccounts = await getSolAccountsObj(
    solAccountsInfo,
    mintAccounts,
    governances,
  )

  return [...accounts, ...solAccounts]
}

const getMintAccounts = (
  mintGovernances: GovernanceProgramAccountWithNativeTreasuryAddress[],
  mintGovernancesMintInfo: (MintInfo & { publicKey: PublicKey })[],
) => {
  const accounts: AccountTypeMint[] = []
  mintGovernancesMintInfo.forEach((mintAccountInfo, index) => {
    const mintGovernnace = mintGovernances[index]
    if (!mintAccountInfo) {
      throw new Error(
        `Missing mintAccountInfo for: ${mintGovernnace?.pubkey.toBase58()}`,
      )
    }
    const account = new AccountTypeMint(mintGovernnace!, mintAccountInfo)
    if (account) {
      accounts.push(account)
    }
  })
  return accounts
}

const getProgramAssetAccounts = async (
  connection: ConnectionContext,
  governancesArray: GovernanceProgramAccountWithNativeTreasuryAddress[],
): Promise<AccountTypeProgram[]> => {
  const possibleOwnersPk = [
    ...governancesArray.map((x) => x.nativeTreasuryAddress),
    ...governancesArray
      .filter(
        (x) =>
          x.account.accountType === GovernanceAccountType.ProgramGovernanceV1 ||
          x.account.accountType === GovernanceAccountType.ProgramGovernanceV2,
      )
      .map((x) => x.pubkey),
  ]

  const programs = await getProgramAccountInfo(connection, possibleOwnersPk)

  return programs.map(
    (program) =>
      new AccountTypeProgram(
        governancesArray.find(
          (x) =>
            x.pubkey.equals(program.owner) ||
            x.nativeTreasuryAddress.equals(program.owner),
        )!,
        program.programId,
        program.owner,
      ),
  )
}

const getGenericAssetAccounts = (
  genericGovernances: GovernanceProgramAccountWithNativeTreasuryAddress[],
): AccountTypeGeneric[] => {
  return genericGovernances.map(
    (programGov) => new AccountTypeGeneric(programGov),
  )
}

const getSolAccountObj = (
  governance: GovernanceProgramAccountWithNativeTreasuryAddress,
  mint: TokenProgramAccount<MintInfo>,
  { acc, nativeSolAddress }: SolAccInfo,
): AccountTypeSol | null => {
  if (!acc) {
    return null
  }

  // const minRentAmount = await connection.current.getMinimumBalanceForRentExemption(
  //   0
  // )
  // > solana rent 0 --lamports
  // Rent-exempt minimum: 890880 lamports
  const minRentAmount = 890880
  const solAccount = acc as AccountInfoGen<Buffer | ParsedAccountData>

  solAccount.lamports =
    solAccount.lamports !== 0
      ? solAccount.lamports - minRentAmount
      : solAccount.lamports

  return new AccountTypeSol(mint, nativeSolAddress, solAccount, governance)
}

const filterOutHiddenAccounts = (x: AssetAccount) => {
  const pubkey = typeof x.pubkey === 'string' ? x.pubkey : x.pubkey.toBase58()
  return (
    HIDDEN_TREASURES.findIndex((x) => x === pubkey) === -1 &&
    (!x.extensions.token ||
      !x.extensions.token?.account.isFrozen ||
      x.type !== AccountType.GENERIC)
  )
}

// Return array without duplicates
const uniqueGovernedTokenAccounts = (
  assetAccounts: AssetAccount[],
): AssetAccount[] => {
  const existing = new Set<string>()
  const deduped: AssetAccount[] = []

  for (const account of assetAccounts) {
    if (!existing.has(account.pubkey.toBase58())) {
      existing.add(account.pubkey.toBase58())
      deduped.push(account)
    }
  }

  return deduped
}

const getMintAccountsInfo = async (
  { endpoint, current: { commitment } }: ConnectionContext,
  publicKeys: PublicKey[],
): Promise<TokenProgramAccount<MintAccount>[]> => {
  const { data: mintAccountsJson } = await axios.post(
    endpoint,
    publicKeys.map((pubkey) => {
      const id = pubkey.toBase58()

      return {
        jsonrpc: '2.0',
        id,
        method: 'getAccountInfo',
        params: [
          id,
          {
            commitment,
            encoding: 'base64',
          },
        ],
      }
    }),
  )

  if (!mintAccountsJson) {
    throw new Error(
      `Cannot load information about mint accounts ${publicKeys.map((x) =>
        x.toBase58(),
      )}`,
    )
  }

  return mintAccountsJson.map(
    ({
      result: {
        value: {
          data: [encodedData],
        },
      },
      id,
    }) => {
      const publicKey = new PublicKey(id)
      const data = Buffer.from(encodedData, 'base64')
      const account = parseMintAccountData(data)
      return { publicKey, account }
    },
  )
}

const getTokenAccountsInfo = async (
  { endpoint, current: { commitment } }: ConnectionContext,
  publicKeys: PublicKey[],
  programId: PublicKey,
  encoding = 'base64',
): Promise<TokenProgramAccount<TokenAccount>[]> => {
  const { data: tokenAccountsInfoJson } = await axios.post<
    unknown,
    {
      data: {
        result: {
          value: {
            account: any
            pubkey: string
          }[]
        }
      }[]
    }
  >(
    endpoint,
    publicKeys.map((publicKey) => ({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [
        publicKey,
        { programId: programId.toBase58() },
        {
          commitment,
          encoding: encoding,
        },
      ],
    })),
  )

  if (!tokenAccountsInfoJson) {
    throw new Error(
      `Cannot load information about token accounts ${publicKeys.map((x) =>
        x.toBase58(),
      )}`,
    )
  }

  if (programId.equals(TOKEN_PROGRAM_ID)) {
    return tokenAccountsInfoJson.reduce((tokenAccountsInfo, { result }) => {
      result.value.forEach(
        ({
          account: {
            data: [encodedData],
          },
          pubkey,
        }) => {
          const publicKey = new PublicKey(pubkey)
          const data = Buffer.from(encodedData, 'base64')
          const account = parseTokenAccountData(publicKey, data)
          tokenAccountsInfo.push({ publicKey, account })
        },
      )

      return tokenAccountsInfo
    }, [] as TokenProgramAccount<TokenAccount>[])
  } else {
    return tokenAccountsInfoJson.reduce((tokenAccountsInfo, { result }) => {
      result.value.forEach(({ account, pubkey }) => {
        const publicKey = new PublicKey(pubkey)
        const parsed = account.data.parsed.info
        const tokenAccount: TokenAccount = {
          address: new PublicKey(pubkey),
          mint: new PublicKey(parsed.mint),
          owner: new PublicKey(parsed.owner),
          amount: new u64(parsed.tokenAmount.amount),
          delegate: null,
          delegatedAmount: new u64(0),
          isInitialized: true,
          isFrozen: false,
          isNative: false,
          rentExemptReserve: null,
          closeAuthority: null,
          extensions: parsed.extensions,
          isToken2022: true,
        }
        tokenAccountsInfo.push({ publicKey, account: tokenAccount })
      })

      return tokenAccountsInfo
    }, [] as TokenProgramAccount<TokenAccount>[])
  }
}

const getSolAccountsInfo = async (
  connection: ConnectionContext,
  publicKeys: { governancePk: PublicKey; nativeSolAddress: PublicKey }[],
): Promise<SolAccInfo[]> => {
  const { data: solAccountsJson } = await axios.post<
    unknown,
    {
      data: {
        result: {
          value: null | {
            data: [string, 'base64']
          }
        }
      }[]
    }
  >(
    connection.endpoint,
    publicKeys.map((x) => ({
      jsonrpc: '2.0',
      id: 1,
      method: 'getAccountInfo',
      params: [
        x.nativeSolAddress.toBase58(),
        {
          commitment: connection.current.commitment,
          encoding: 'jsonParsed',
        },
      ],
    })),
  )

  if (!solAccountsJson.length) {
    return []
  }

  return (
    solAccountsJson
      .flatMap(({ result: { value } }, index: number) => {
        return {
          acc: value,
          ...publicKeys[index],
        }
      })
      // Remove null values
      .filter(({ acc }) => acc)
  )
}

const loadMintGovernanceAccounts = async (
  connection: ConnectionContext,
  governances: GovernanceProgramAccountWithNativeTreasuryAddress[],
  possibleMintAccountPks: PublicKey[],
) => {
  const nativeAccountAddresses = governances.map((x) => x.nativeTreasuryAddress)
  const possibleMintAccounts = await getMultipleAccountInfoChunked(
    connection.current,
    possibleMintAccountPks,
  )
  const mintGovernances: GovernanceProgramAccountWithNativeTreasuryAddress[] =
    []
  const mintAccounts: (MintInfo & { publicKey: PublicKey })[] = []
  for (const index in possibleMintAccounts) {
    const possibleMintAccount = possibleMintAccounts[index]
    const pk = possibleMintAccountPks[index]
    if (possibleMintAccount) {
      const data = Buffer.from(possibleMintAccount.data)
      const parsedMintInfo = parseMintAccountData(data) as MintInfo
      const ownerGovernance = governances.find(
        (g) =>
          parsedMintInfo?.mintAuthority &&
          g.pubkey.equals(parsedMintInfo.mintAuthority),
      )
      const solAccountPk = nativeAccountAddresses.find(
        (x) =>
          parsedMintInfo?.mintAuthority &&
          x.equals(parsedMintInfo.mintAuthority),
      )
      if (ownerGovernance || solAccountPk) {
        mintGovernances.push(
          solAccountPk
            ? governances[
                nativeAccountAddresses.findIndex((x) => x.equals(solAccountPk))
              ]
            : ownerGovernance!,
        )
        mintAccounts.push({ ...parsedMintInfo, publicKey: pk })
      }
    }
  }
  return getMintAccounts(mintGovernances, mintAccounts)
}

const loadGovernedTokenAccounts = async (
  connection: ConnectionContext,
  realm: ProgramAccount<Realm>,
  governancesArray: GovernanceProgramAccountWithNativeTreasuryAddress[],
): Promise<AssetAccount[]> => {
  console.log('loadGovernedTokenAccounts has been called')
  const auxiliaryTokenAccounts: (typeof AUXILIARY_TOKEN_ACCOUNTS)[keyof typeof AUXILIARY_TOKEN_ACCOUNTS] =
    AUXILIARY_TOKEN_ACCOUNTS[realm.account.name]?.length
      ? AUXILIARY_TOKEN_ACCOUNTS[realm.account.name]
      : []

  const tokenAccountOwners = uniquePublicKey([
    ...governancesArray.map((x) => x.nativeTreasuryAddress),
    ...auxiliaryTokenAccounts.map((x) => new PublicKey(x.owner)),
  ])

  const tokenAccountsInfo = (
    await Promise.all(
      // Load infos in batch, cannot load 9999 accounts within one request
      group(tokenAccountOwners, 100).map((group) =>
        getTokenAccountsInfo(connection, group, TOKEN_PROGRAM_ID),
      ),
    )
  )
    .flat()
    .filter((x) => !x.account.amount.isZero())

  const token2022AccountsInfo = (
    await Promise.all(
      // Load infos in batch, cannot load 9999 accounts within one request
      group(tokenAccountOwners, 100).map((group) =>
        getTokenAccountsInfo(
          connection,
          group,
          TOKEN_2022_PROGRAM_ID,
          'jsonParsed',
        ),
      ),
    )
  ).flat()

  const governedTokenAccounts = (
    await Promise.all(
      // Load infos in batch, cannot load 9999 accounts within one request
      group([...tokenAccountsInfo, ...token2022AccountsInfo], 100).map(
        (group) => getTokenAssetAccounts(group, governancesArray, connection),
      ),
    )
  ).flat()

  // Remove potential accounts duplicate
  return uniqueGovernedTokenAccounts(governedTokenAccounts)
}

const loadStakeAccounts = async (
  connection: ConnectionContext,
  solAccounts: AssetAccount[],
) => {
  const accountsNotYetStaked = await Promise.all(
    solAccounts.map((x) =>
      getFilteredProgramAccounts(connection.current, StakeProgram.programId, [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode([1, 0, 0, 0]),
          },
        },
        {
          memcmp: {
            offset: 44,
            bytes: x.extensions.transferAddress,
          },
        },
      ]),
    ),
  )
  const accountsStaked = await Promise.all(
    solAccounts.map((x) =>
      getFilteredProgramAccounts(connection.current, StakeProgram.programId, [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode([2, 0, 0, 0]),
          },
        },
        {
          memcmp: {
            offset: 44,
            bytes: x.extensions.transferAddress,
          },
        },
      ]),
    ),
  )
  const accountsNotYetStakedMapped = accountsNotYetStaked.flatMap((x, idx) =>
    x.map((stake) => ({ ...stake, governance: solAccounts[idx].governance })),
  )
  const accountsStakedMapped = accountsStaked.flatMap((x, idx) =>
    x.map((stake) => ({ ...stake, governance: solAccounts[idx].governance })),
  )

  return [
    ...accountsNotYetStakedMapped.map(
      (x) =>
        new AccountTypeStake(
          x.governance,
          x.publicKey,
          StakeState.Inactive,
          null,
          x.accountInfo.lamports / LAMPORTS_PER_SOL,
        ),
    ),
    ...accountsStakedMapped.map(
      (x) =>
        new AccountTypeStake(
          x.governance,
          x.publicKey,
          StakeState.Active,
          PublicKey.decode(x.accountInfo.data.slice(124, 124 + 32)),
          x.accountInfo.lamports / LAMPORTS_PER_SOL,
        ),
    ),
  ]
}

const getAccountsForGovernances = async (
  connection: ConnectionContext,
  realm: ProgramAccount<Realm>,
  governancesArray: ProgramAccount<Governance>[],
): Promise<
  (AccountTypeMint | AccountTypeProgram | AssetAccount | AccountTypeGeneric)[]
> => {
  const nativeAddresses = [
    ...governancesArray.map((x) => {
      const [signatoryRecordAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from('native-treasury'), x.pubkey.toBuffer()],
        realm.owner,
      )
      return signatoryRecordAddress
    }),
  ]
  const governancesWithNativeTreasuryAddress = governancesArray.map(
    (x, index) => ({
      ...x,
      nativeTreasuryAddress: nativeAddresses[index],
    }),
  )
  //due to long request for mint accounts that are owned by every governance
  //we fetch
  const possibleMintAccountPks = [
    realm.account.communityMint,
    realm.account.config.councilMint,
  ].filter((x) => typeof x !== 'undefined') as PublicKey[]

  const additionalMintAccounts =
    additionalPossibleMintAccounts[realm.account.name]
  if (additionalMintAccounts) {
    possibleMintAccountPks.push(...additionalMintAccounts)
  }
  // 1 - Load accounts related to program governances
  // 2 - Load token accounts behind any type of governance
  // 3 - Load accounts related to mint
  const [programAccounts, governedTokenAccounts, mintAccounts] =
    await Promise.all([
      getProgramAssetAccounts(connection, governancesWithNativeTreasuryAddress),
      loadGovernedTokenAccounts(
        connection,
        realm,
        governancesWithNativeTreasuryAddress,
      ),
      loadMintGovernanceAccounts(
        connection,
        governancesWithNativeTreasuryAddress,
        possibleMintAccountPks,
      ),
    ])

  // 4 - Call to fetch token prices for every token account's mints
  await tokenPriceService.fetchTokenPrices(
    governedTokenAccounts.reduce((mints, governedTokenAccount) => {
      if (!governedTokenAccount.extensions.mint?.publicKey) {
        return mints
      }

      return [
        ...mints,
        governedTokenAccount.extensions.mint.publicKey.toBase58(),
      ]
    }, [] as string[]),
  )

  const accounts = [
    ...mintAccounts,
    ...programAccounts,
    ...governedTokenAccounts,
  ]

  // 5 - Create generic asset accounts for governance's governedAccounts that have not been handled yet
  // We do this so theses accounts may be selected
  const genericGovernances = getGenericAssetAccounts(
    governancesWithNativeTreasuryAddress.filter(
      (governance) =>
        !accounts.some((account) =>
          account.pubkey.equals(governance.account.governedAccount),
        ),
    ),
  )

  return [...accounts, ...genericGovernances]
}

// TODO BATCH ALERT
// Solution: I cant tell what this is doing. it should probably be murdered.
const getProgramAccountInfo = async (
  { endpoint, current }: ConnectionContext,
  publicKeys: PublicKey[],
): Promise<{ owner: PublicKey; programId: PublicKey }[]> => {
  let result: { owner: PublicKey; programId: PublicKey }[] = []
  try {
    const { data: executableAccountInfoJson } = await axios.post<
      unknown,
      {
        data: {
          result: {
            account: {
              data: [string, 'base64']
            }
            pubkey: string
          }[]
          id: string
        }[]
      }
    >(
      endpoint,
      publicKeys.map((publicKey) => ({
        jsonrpc: '2.0',
        id: publicKey.toBase58(),
        method: 'getProgramAccounts',
        params: [
          'BPFLoaderUpgradeab1e11111111111111111111111',
          {
            commitment: current.commitment,
            encoding: 'base64',
            filters: [
              {
                memcmp: {
                  offset: programAccountOwnerOffset,
                  bytes: publicKey.toBase58(),
                },
              },
            ],
            dataSlice: {
              offset: 0,
              length: 0,
            },
          },
        ],
      })),
    )
    if (executableAccountInfoJson && executableAccountInfoJson.length) {
      const executableDataPks = executableAccountInfoJson.reduce(
        (executableAccountInfo, { result, id }) => {
          result.forEach(({ pubkey }) => {
            const executableDataPk = new PublicKey(pubkey)
            executableAccountInfo.push({
              executableDataPk: executableDataPk,
              owner: new PublicKey(id),
            })
          })

          return executableAccountInfo
        },
        [] as { owner: PublicKey; executableDataPk: PublicKey }[],
      )
      if (executableDataPks.length) {
        const { data: programAccountInfoJson } = await axios.post<
          unknown,
          {
            data: {
              result: {
                account: {
                  data: [string, 'base64']
                }
                pubkey: string
              }[]
              id: string
            }[]
          }
        >(
          endpoint,
          executableDataPks.map((obj) => ({
            jsonrpc: '2.0',
            id: obj.owner,
            method: 'getProgramAccounts',
            params: [
              'BPFLoaderUpgradeab1e11111111111111111111111',
              {
                commitment: current.commitment,
                encoding: 'base64',
                filters: [
                  {
                    memcmp: {
                      offset: 4,
                      bytes: obj.executableDataPk.toBase58(),
                    },
                  },
                ],
                dataSlice: {
                  offset: 0,
                  length: 0,
                },
              },
            ],
          })),
        )
        if (programAccountInfoJson && programAccountInfoJson.length) {
          const programDataPks = programAccountInfoJson.reduce(
            (programAccountInfo, { result, id }) => {
              result.forEach(({ pubkey }) => {
                const programId = new PublicKey(pubkey)
                programAccountInfo.push({ programId, owner: new PublicKey(id) })
              })

              return programAccountInfo
            },
            [] as { owner: PublicKey; programId: PublicKey }[],
          )
          result = programDataPks
        }
      }
    }
  } catch (e) {
    console.log('unable to fetch programs owned by DAO', e)
  }

  return result
}
