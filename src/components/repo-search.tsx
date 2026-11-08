import { useRouter } from '@void/react';
import { SearchIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** "owner/repo" や GitHub の URL から owner と repo を取り出す */
export function parseRepo(input: string) {
  const m = input
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '')
    .replace(/\.git$/, '')
    .match(/^([\w.-]+)\/([\w.-]+)/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

export function RepoSearch({ defaultValue = '', size = 'default' }: { defaultValue?: string; size?: 'default' | 'lg' }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setValue(defaultValue), [defaultValue]);

  // ⌘K / Ctrl+K で入力欄にフォーカス
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseRepo(value);
    setInvalid(!parsed);
    if (parsed) router.visit({ pathname: '/:owner/:repo', params: parsed });
  };

  const lg = size === 'lg';
  return (
    <form onSubmit={submit} className="flex w-full min-w-0 items-center gap-2">
      <label
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 rounded-md border bg-muted px-2.5 transition-shadow',
          'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30',
          invalid && 'border-destructive',
          lg ? 'h-11' : 'h-9',
        )}
      >
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setInvalid(false);
          }}
          placeholder="owner/repo または GitHub の URL"
          aria-label="リポジトリ"
          aria-invalid={invalid}
          className={cn('min-w-0 flex-1 bg-transparent font-mono outline-none placeholder:font-sans placeholder:text-muted-foreground', lg ? 'text-base' : 'text-sm')}
        />
        <kbd className="hidden rounded border px-1.5 font-mono text-[11px] text-muted-foreground sm:inline">⌘K</kbd>
      </label>
      <Button type="submit" size={lg ? 'lg' : 'default'} className={cn('bg-primary text-primary-foreground hover:bg-primary/90', lg && 'h-11 px-5')}>
        解析
      </Button>
    </form>
  );
}
