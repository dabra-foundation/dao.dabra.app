import { RealmInfo } from '@models/registry/api'
import React, { useMemo } from 'react'
import DabraGrid from './DabraGrid'

export default function DabraDashboard({
  dabra,
  filteredDabra,
  isLoading,
  editing,
  searching,
  clearSearch,
  cluster,
}: {
  dabra: readonly RealmInfo[]
  filteredDabra: readonly RealmInfo[]
  isLoading: boolean
  editing: boolean
  searching: boolean
  clearSearch: () => void
  cluster: string | string[] | undefined
}) {
  const certifiedDabra = useMemo(
    () => dabra?.filter((r) => r.isCertified),
    [dabra],
  )

  const unchartedDabra = useMemo(
    () => dabra?.filter((r) => !r.isCertified),
    [dabra],
  )

  return isLoading ? (
    <div className="grid grid-flow-row grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      <div className="col-span-1 rounded-lg animate-pulse bg-bkg-2 h-44" />
      <div className="col-span-1 rounded-lg animate-pulse bg-bkg-2 h-44" />
      <div className="col-span-1 rounded-lg animate-pulse bg-bkg-2 h-44" />
      <div className="col-span-1 rounded-lg animate-pulse bg-bkg-2 h-44" />
      <div className="col-span-1 rounded-lg animate-pulse bg-bkg-2 h-44" />
      <div className="col-span-1 rounded-lg animate-pulse bg-bkg-2 h-44" />
      <div className="col-span-1 rounded-lg animate-pulse bg-bkg-2 h-44" />
      <div className="col-span-1 rounded-lg animate-pulse bg-bkg-2 h-44" />
      <div className="col-span-1 rounded-lg animate-pulse bg-bkg-2 h-44" />
      <div className="col-span-1 rounded-lg animate-pulse bg-bkg-2 h-44" />
    </div>
  ) : (
    <DabraGrid
      certifiedDabra={certifiedDabra}
      unchartedDabra={unchartedDabra}
      filteredDabra={filteredDabra}
      editing={editing}
      searching={searching}
      clearSearch={clearSearch}
      cluster={cluster}
    />
  )
}
