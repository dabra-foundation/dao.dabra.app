import { PublicKey } from '@solana/web3.js';

import * as common from '../common';
import { LoadingDots } from '@hub/components/LoadingDots';
import cx from '@hub/lib/cx';
import { formatNumber } from '@hub/lib/formatNumber';

interface Props {
  className?: string;
  fetching?: boolean;
  dabra: PublicKey[];
}

export function NumNFTDabraprops: Props) {
  return (
    <section
      className={cx(
        'h-0',
        'mt-0',
        'opacity-0',
        'overflow-hidden',
        'transition-all',
        !!props.dabra.length && 'h-auto',
        !!props.dabra.length && 'mt-16',
        !!props.dabra.length && 'opacity-100',
        props.className,
      )}
    >
      <div className="flex items-baseline">
        <common.Label>Number of NFT Dabra/common.Label>
        {props.fetching && (
          <LoadingDots
            className="text-xs ml-1 text-neutral-400"
            style="pulse"
          />
        )}
      </div>
      <common.Value>
        {formatNumber(props.dabra.length, undefined, {
          maximumFractionDigits: 0,
        })}
      </common.Value>
    </section>
  );
}
