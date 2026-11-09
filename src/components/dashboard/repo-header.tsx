import { ExternalLinkIcon, GitBranchIcon, PackageIcon, ScaleIcon, StarIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import type { RepoStats } from '@/lib/types';
import { cn, formatCompact, timeAgo } from '@/lib/utils';
import { Dot } from './parts';

export function RepoHeader({ stats }: { stats: RepoStats }) {
  const { repo, npm } = stats;
  return (
    <section className="flex flex-wrap items-start gap-5 py-7">
      <img src={repo.ownerAvatarUrl} alt="" className="size-14 rounded-full border" />
      <div className="min-w-64 flex-1">
        <div className="flex flex-wrap items-center gap-2.5 text-[22px]">
          <span>
            <a href={`https://github.com/${repo.owner}`} className="text-link hover:underline">
              {repo.owner}
            </a>
            <span className="text-muted-foreground"> / </span>
            <a href={repo.url} className="font-semibold text-link hover:underline">
              {repo.name}
            </a>
          </span>
          <Badge variant="outline" className="text-muted-foreground">
            {repo.isPrivate ? 'Private' : 'Public'}
          </Badge>
          {repo.isFork && <Badge variant="outline" className="text-muted-foreground">Fork</Badge>}
          {repo.isArchived && <Badge variant="outline" className="border-chart-3 text-chart-3">Archived</Badge>}
        </div>
        {repo.description && <p className="mt-1.5 text-muted-foreground">{repo.description}</p>}
        {repo.topics.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {repo.topics.map((t) => (
              <span key={t} className="rounded-full bg-link/15 px-2.5 py-0.5 text-xs font-medium text-link">
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
          {repo.primaryLanguage && (
            <span className="flex items-center gap-1.5">
              <Dot color={repo.primaryLanguage.color} />
              {repo.primaryLanguage.name}
            </span>
          )}
          {repo.license && (
            <span className="flex items-center gap-1.5">
              <ScaleIcon className="size-3.5" />
              {repo.license}
            </span>
          )}
          {npm && (
            <span className="flex items-center gap-1.5 font-mono">
              <PackageIcon className="size-3.5" />v{npm.version}
            </span>
          )}
          <span>作成 {repo.createdAt.slice(0, 10)}</span>
          <span>最終 push {timeAgo(repo.pushedAt)}</span>
          <span className="flex items-center gap-1.5 font-mono">
            <GitBranchIcon className="size-3.5" />
            {repo.defaultBranch} @ {repo.headSha.slice(0, 7)}
          </span>
        </div>
      </div>
      <div className="flex gap-2">
        <a href={`${repo.url}/stargazers`} className={cn(buttonVariants({ variant: 'outline' }), 'gap-1.5')}>
          <StarIcon /> Star
          <span className="rounded-full bg-muted px-1.5 text-xs">{formatCompact(repo.stars)}</span>
        </a>
        <a href={repo.url} className={cn(buttonVariants({ variant: 'outline' }), 'gap-1.5')}>
          GitHub <ExternalLinkIcon />
        </a>
      </div>
    </section>
  );
}
