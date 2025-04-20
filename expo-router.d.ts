declare module 'expo-router' {
  import * as React from 'react';
  export function Redirect(props: { href: string }): React.ReactElement;
  export { Stack, Tabs, useRouter, useSegments, usePathname, useLocalSearchParams } from 'expo-router/build';
}
