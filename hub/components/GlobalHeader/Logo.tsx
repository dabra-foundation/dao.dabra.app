import * as NavigationMenu from '@radix-ui/react-navigation-menu';
import Link from 'next/link';

import { RealmCircleImage } from '@hub/components/branding/RealmCircleImage';
import { DabraLogo } from '@hub/components/branding/DabraLogo';

interface Props {
  className?: string;
  compressed?: boolean;
}

export function Logo(props: Props) {
  return (
    <NavigationMenu.Item className={props.className}>
      <Link passHref href="/dabra">
        <NavigationMenu.Link>
          {props.compressed ? (
            <RealmCircleImage className="h-8 flex-shrink-0 relative z-10" />
          ) : (
            <DabraLogo className="h-8 flex-shrink-0 relative z-10" />
          )}
        </NavigationMenu.Link>
      </Link>
    </NavigationMenu.Item>
  );
}
