import { useMemo, useState } from 'react'

import {
  createUnchartedRealmInfo,
  getCertifiedRealmInfos,
  RealmInfo,
} from '../../models/registry/api'

import { SearchIcon } from '@heroicons/react/outline'
import useQueryContext from '@hooks/useQueryContext'
import Button from '@components/Button'
import { notify } from '@utils/notifications'
import { useRouter } from 'next/router'
import Input from '@components/inputs/Input'

import { BsLayoutWtf, BsCheck } from 'react-icons/bs'
import useWalletOnePointOh from '@hooks/useWalletOnePointOh'
import { PublicKey } from '@solana/web3.js'
import { DEFAULT_GOVERNANCE_PROGRAM_ID } from '@components/instructions/tools'
import { useDabraByProgramQuery } from '@hooks/queries/realm'
import useLegacyConnectionContext from '@hooks/useLegacyConnectionContext'
import DabraDashboard from './components/DabraDashboard'
import { useGetAllMetadata } from '@hooks/useOnchainMetadata'

const Dabra = () => {
  const [dabra, setDabra] = useState<ReadonlyArray<RealmInfo>>([])
  const [filteredDabra, setFilteredDabra] = useState<
    ReadonlyArray<RealmInfo>
  >([])
  const [isLoadingDabra, setIsLoadingDabra] = useState(true)
  const [editingGrid, setEditingGrid] = useState(false)
  const connection = useLegacyConnectionContext()
  const wallet = useWalletOnePointOh()
  const connected = !!wallet?.connected
  const router = useRouter()
  const { fmtUrlWithCluster } = useQueryContext()
  const [searchString, setSearchString] = useState('')
  const { cluster } = router.query
  //Small hack to prevent race conditions with cluster change until we remove connection from store and move it to global dep.
  const routeHasClusterInPath = router.asPath.includes('cluster')
  const programs = useMemo(
    () => new PublicKey(DEFAULT_GOVERNANCE_PROGRAM_ID),
    [],
  )
  const { data: queryDabra } = useDabraByProgramQuery(programs)
  const metadata = useGetAllMetadata().data
  
  useMemo(async () => {
    if (
      connection &&
      ((routeHasClusterInPath && cluster) || !routeHasClusterInPath)
    ) {
      const [certifiedDabra] = await Promise.all([
        getCertifiedRealmInfos(connection),
      ])

      const certifiedSelfHostedDabra = certifiedDabra.filter(
        realm => realm.programId.toBase58() !== DEFAULT_GOVERNANCE_PROGRAM_ID
      )

      const uncharteredDabra =
        queryDabra?.map((x) => {
          const realm = certifiedDabra.find((y) => y.realmId.equals(x.pubkey))

          if (realm) {
            return {...realm, communityMint: x.account.communityMint, authority: x.account.authority}
          }

          return createUnchartedRealmInfo({
            name: x.account.name,
            programId: x.owner.toBase58(),
            address: x.pubkey.toBase58(),
            communityMint: x.account.communityMint.toBase58(),
            authority: x.account.authority?.toBase58()
          })
        }) ?? []

      const allDabra = [...certifiedSelfHostedDabra, ...uncharteredDabra]

      if (metadata) {
        const updatedDabra = allDabra.map((realm) => {
          const nativeTreasuryAddress = realm.authority ? 
            PublicKey.findProgramAddressSync(
              [
                Buffer.from('native-treasury'),
                realm.authority.toBuffer()
              ],
              realm.programId
            )[0] :
            undefined

          const metadataAccount = metadata.find(
            (m) => m.realm.toBase58() === realm.realmId.toBase58() &&
              (m.issuingAuthority.toBase58() === realm.authority?.toBase58() || 
              m.issuingAuthority.toBase58() === nativeTreasuryAddress?.toBase58())
          )
          
          if (metadataAccount) {
            return {
              ...realm,
              displayName: metadataAccount.displayName ?? realm.displayName,
              ogImage: metadataAccount.daoImage ?? realm.ogImage,
            }
          }
          return realm
        })
        setDabra(sortDaos(updatedDabra))
      }
      
      setFilteredDabra(sortDaos(allDabra))
      setIsLoadingDabra(false)
    }
  }, [connection, routeHasClusterInPath, cluster, queryDabra, metadata])

  const handleCreateRealmButtonClick = async () => {
    if (!connected) {
      try {
        if (wallet) {
          await wallet.connect()
        } else {
          throw new Error('You need to connect a wallet to continue')
        }
      } catch (error) {
        const err = error as Error
        let message = err.message

        if (err.name === 'WalletNotReadyError') {
          message = 'You must connect a wallet to create a DAO'
        }

        return notify({ message, type: 'error' })
      }
    }
    router.push(fmtUrlWithCluster(`/dabra/new`))
  }
  const sortDaos = (realmInfoData: RealmInfo[]) => {
    return realmInfoData.sort((a: RealmInfo, b: RealmInfo) => {
      return (b.sortRank ?? -0) - (a.sortRank ?? -0)
    })
  }
  const filterDaos = (v) => {
    setSearchString(v)
    if (v.length > 0) {
      const filtered = dabra.filter(
        (r) =>
          r.displayName?.toLowerCase().includes(v.toLowerCase()) ||
          r.symbol?.toLowerCase().includes(v.toLowerCase()) ||
          r.communityMint?.toBase58().toLowerCase().includes(v.toLowerCase())
      )
      setFilteredDabra(filtered)
    } else {
      setFilteredDabra(dabra)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between w-full mb-6">
        <h1 className="mb-4 sm:mb-0">DAOs</h1>
        <div className="flex space-x-4 items-center grow">
          <Input
            className="pl-8 md:ml-4 ml-2"
            value={searchString}
            type="text"
            onChange={(e) => filterDaos(e.target.value)}
            placeholder={`DAO Checker - Enter DAO name or Mint Address`}
            prefix={<SearchIcon className="w-5 h-5 text-fgd-3 md:ml-4 ml-2" />}
          />
          <div className="w-10 h-10">
            <button
              className="bg-bkg-2 default-transition flex items-center justify-center h-10 rounded-full w-10 hover:bg-bkg-3"
              onClick={() => setEditingGrid(!editingGrid)}
            >
              {editingGrid ? (
                <BsCheck className="h-6 w-6 text-fgd-1" />
              ) : (
                <BsLayoutWtf className="h-4 text-fgd-1 w-4" />
              )}
            </button>
          </div>
          {!editingGrid && (
            <Button
              className="whitespace-nowrap"
              onClick={handleCreateRealmButtonClick}
            >
              Create DAO
            </Button>
          )}
        </div>
      </div>
      <DabraDashboard
        dabra={dabra}
        filteredDabra={filteredDabra}
        isLoading={isLoadingDabra}
        editing={editingGrid}
        searching={searchString.length > 0}
        clearSearch={() => filterDaos('')}
        cluster={cluster}
      ></DabraDashboard>
    </div>
  )
}

export default Dabra
