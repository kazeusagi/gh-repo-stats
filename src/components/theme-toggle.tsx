import { MoonIcon, SunIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const toggle = () => {
    const dark = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    } catch {
      // ストレージが使えない環境では保存しない
    }
  };
  return (
    <Button variant="outline" size="icon" onClick={toggle} aria-label="テーマを切り替え">
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  );
}
