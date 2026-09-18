import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/spinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

export interface DetailColumn<T> {
  header: string;
  render: (row: T) => ReactNode;
}

const PAGE_SIZE = 8;

/** Recursively check whether any value in the row matches the query. */
function rowMatches(value: unknown, q: string): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((v) => rowMatches(v, q));
  }
  return String(value).toLowerCase().includes(q);
}

/**
 * Generic drill-down dialog used by the dashboard KPI cards: a searchable,
 * paginated table of the records behind a stat.
 */
export function DetailDialog<T extends { id?: string }>({
  open,
  onClose,
  title,
  loading = false,
  error = null,
  rows,
  columns,
  summary,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  loading?: boolean;
  error?: string | null;
  rows: T[];
  columns: DetailColumn<T>[];
  summary?: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setPage(1);
  }, [open, title]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => rowMatches(r, q));
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <Dialog open={open} onClose={onClose} title={title} className="max-w-4xl">
      <div className="w-full space-y-4">
        {summary}

        <div className="flex items-center justify-between gap-2">
          <Input
            placeholder="Search records…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <span className="text-xs text-muted-foreground">
            {filtered.length} record{filtered.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <LoadingState />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Search} title="No matching records" />
        ) : (
          <div className="max-h-[400px] overflow-x-auto rounded-md border">
            <Table>
              <THead>
                <TR>
                  {columns.map((c) => (
                    <TH key={c.header}>{c.header}</TH>
                  ))}
                </TR>
              </THead>
              <TBody>
                {paginated.map((row, idx) => (
                  <TR key={row.id ?? idx}>
                    {columns.map((c) => (
                      <TD key={c.header}>{c.render(row)}</TD>
                    ))}
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-xs text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
