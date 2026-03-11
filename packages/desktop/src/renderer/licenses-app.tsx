import { useEffect, useRef, useState } from 'react';
import { applyTheme } from './lib/theme';
import licensesData from './licenses-data.json';

type LicenseEntry = {
  name: string;
  version: string;
  license: string;
  author: string;
  homepage: string;
};

const packages = licensesData as LicenseEntry[];

const licenseTypes = Array.from(new Set(packages.map((p) => p.license))).sort();

function LicenseSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const options = ['', ...licenseTypes];
  const label = value || 'All licenses';

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="flex items-center gap-1 rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring whitespace-nowrap"
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <svg className="ml-1 h-3 w-3 opacity-50" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 min-w-full rounded border bg-background shadow-md">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-muted whitespace-nowrap ${opt === value ? 'font-medium' : ''}`}
              onClick={() => { onChange(opt); setOpen(false); }}
            >
              {opt || 'All licenses'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function LicensesApp(): React.JSX.Element {
  const [filter, setFilter] = useState('');
  const [licenseFilter, setLicenseFilter] = useState('');

  useEffect(() => {
    void window.curraint.getSettings().then((s) => applyTheme(s.theme));
  }, []);

  const lowerFilter = filter.toLowerCase();
  const visible = packages.filter((p) => {
    const matchesText =
      !lowerFilter ||
      p.name.toLowerCase().includes(lowerFilter) ||
      p.author.toLowerCase().includes(lowerFilter);
    const matchesLicense = !licenseFilter || p.license === licenseFilter;
    return matchesText && matchesLicense;
  });

  return (
    <div className="flex flex-col h-screen bg-background text-foreground text-sm">
      {/* Header */}
      <div className="shrink-0 border-b px-4 py-3">
        <p className="font-medium">Third-Party Licenses</p>
        <p className="text-xs text-muted-foreground mt-0.5">{packages.length} packages</p>
      </div>

      {/* Filters */}
      <div className="shrink-0 flex gap-2 px-4 py-2 border-b">
        <input
          className="flex-1 rounded border bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Filter by name or author…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <LicenseSelect value={licenseFilter} onChange={setLicenseFilter} />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-background border-b">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Package</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground w-20">Version</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground w-28">License</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Author</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((pkg) => (
              <tr key={`${pkg.name}@${pkg.version}`} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-4 py-1.5 font-mono">
                  {pkg.homepage ? (
                    <button
                      className="text-left underline opacity-80 hover:opacity-100 cursor-pointer bg-transparent border-0 p-0 font-mono text-xs"
                      onClick={() => void window.curraint.openExternal(pkg.homepage)}
                    >
                      {pkg.name}
                    </button>
                  ) : (
                    pkg.name
                  )}
                </td>
                <td className="px-4 py-1.5 text-muted-foreground">{pkg.version}</td>
                <td className="px-4 py-1.5">
                  <span className="rounded px-1.5 py-0.5 bg-muted text-muted-foreground font-mono">
                    {pkg.license}
                  </span>
                </td>
                <td className="px-4 py-1.5 text-muted-foreground">{pkg.author}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No packages match your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
