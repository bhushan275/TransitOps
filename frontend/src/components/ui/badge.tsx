import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      tone: {
        default: 'border-transparent bg-primary/10 text-primary',
        neutral: 'border-transparent bg-muted text-muted-foreground',
        success: 'border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        warning: 'border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400',
        danger: 'border-transparent bg-red-500/15 text-red-600 dark:text-red-400',
        info: 'border-transparent bg-sky-500/15 text-sky-600 dark:text-sky-400',
        purple: 'border-transparent bg-violet-500/15 text-violet-600 dark:text-violet-400',
      },
    },
    defaultVariants: { tone: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
