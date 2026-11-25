import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../store/theme';
import { IconButton, Menu } from './ui';

/** Quick light/dark switch with a menu for the "match system" option. */
export function ThemeToggle() {
  const { preference, resolved, setPreference } = useTheme();
  const label = `Theme: ${preference === 'system' ? `System (${resolved})` : preference}`;
  return (
    <Menu
      align="right"
      width={180}
      items={[
        { label: 'Light', icon: <Sun />, onClick: () => setPreference('light'), hint: preference === 'light' ? '✓' : undefined },
        { label: 'Dark', icon: <Moon />, onClick: () => setPreference('dark'), hint: preference === 'dark' ? '✓' : undefined },
        { label: 'System', icon: <Monitor />, onClick: () => setPreference('system'), hint: preference === 'system' ? '✓' : undefined },
      ]}
      trigger={(open) => (
        <IconButton label={label} onClick={open}>
          {resolved === 'dark' ? <Moon /> : <Sun />}
        </IconButton>
      )}
    />
  );
}
