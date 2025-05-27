import { PublicKey } from '@solana/web3.js';

import * as common from '../common';
import cx from '@hub/lib/cx';
import { formatNumber } from '@hub/lib/formatNumber';

interface Props {
  className?: string;
  dabra: PublicKey[];
}

export function NumDabra(props: Props) {
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
      <common.Label>Number of Dabra</common.Label>
      <common.Value>
        {formatNumber(props.dabra.length, undefined, {
          maximumFractionDigits: 0,
        })}
      </common.Value>
    </section>
  );
}
