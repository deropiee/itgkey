import KeystaticApp from './keystatic';
import { CmsSessionBeacon } from '../CmsSessionBeacon';

export default function RootLayout() {
  return (
    <>
      <CmsSessionBeacon />
      <KeystaticApp />
    </>
  );
}
