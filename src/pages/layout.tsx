import '@/styles/globals.css';
import { Link, useParams } from '@void/react';
import { RepoSearch } from '@/components/repo-search';
import { ThemeToggle } from '@/components/theme-toggle';
import { TooltipProvider } from '@/components/ui/tooltip';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { owner, repo } = useParams<{ owner?: string; repo?: string }>();
  return (
    <TooltipProvider>
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
            <span className="grid size-6 place-items-center rounded-md bg-foreground font-mono text-xs font-bold text-background">rs</span>
            <span className="hidden sm:inline">repo-stats</span>
          </Link>
          {owner && repo && (
            <div className="max-w-xl min-w-0 flex-1">
              <RepoSearch defaultValue={`${owner}/${repo}`} />
            </div>
          )}
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>
      {children}
    </TooltipProvider>
  );
}
