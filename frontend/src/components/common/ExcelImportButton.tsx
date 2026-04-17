// src/components/common/ExcelImportButton.tsx
import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, CheckCircle, FileSpreadsheet, X } from 'lucide-react';

interface Props {
  /** Display name for the entity (e.g. "Contacts") */
  entityName: string;
  /** Called with parsed rows; must return { imported: number } */
  onImport: (rows: Array<Record<string, string>>) => Promise<{ imported: number }>;
  /** Optional: expected column hint shown in modal */
  columnHint?: string;
  /** Roles that can import (undefined = anyone) */
  disabled?: boolean;
  /** Button label override */
  label?: string;
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────

function parseExcel(buffer: ArrayBuffer): Array<Record<string, string>> {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  return json.map(row => {
    const out: Record<string, string> = {};
    for (const key of Object.keys(row)) {
      out[key.trim()] = String(row[key] ?? '').trim();
    }
    return out;
  });
}

function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ''; });
    return row;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExcelImportButton({ entityName, onImport, columnHint, disabled, label }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen]           = useState(false);
  const [rows, setRows]           = useState<Array<Record<string, string>>>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone]           = useState<number | null>(null);
  const [error, setError]         = useState('');

  const openModal = () => {
    setRows([]); setDone(null); setError('');
    setOpen(true);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDone(null); setError('');
    const reader = new FileReader();
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.onload = ev => setRows(parseExcel(ev.target?.result as ArrayBuffer));
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = ev => setRows(parseCSV(ev.target?.result as string));
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true); setError('');
    try {
      const result = await onImport(rows);
      setDone(result.imported);
      setRows([]);
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const close = () => { setOpen(false); setRows([]); setDone(null); setError(''); };

  if (!open) {
    return (
      <>
        <button
          onClick={openModal}
          disabled={disabled}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <Upload size={14} />
          <span className="hidden sm:inline">{label ?? `Import Excel`}</span>
          <span className="sm:hidden">Import</span>
        </button>
      </>
    );
  }

  return (
    <>
      {/* Modal overlay */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={20} className="text-violet-600" />
              <h2 className="font-bold text-lg text-gray-900">Import {entityName} — Excel / CSV</h2>
            </div>
            <button onClick={close} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Success state */}
            {done !== null ? (
              <div className="text-center py-8 space-y-3">
                <CheckCircle size={48} className="mx-auto text-emerald-500" />
                <p className="text-xl font-bold text-gray-900">{done} {entityName} imported!</p>
                <button onClick={close} className="btn-primary px-8">Done</button>
              </div>
            ) : (
              <>
                {/* Column hint */}
                {columnHint && (
                  <div className="p-3 bg-violet-50 rounded-xl text-sm text-violet-700">
                    <span className="font-semibold">Expected columns: </span>{columnHint}
                  </div>
                )}

                {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">{error}</div>}

                {/* File input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Excel (.xlsx, .xls) or CSV file
                  </label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt"
                    className="input-field w-full"
                    onChange={handleFile}
                  />
                </div>

                {/* Preview */}
                {rows.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                      <span className="text-emerald-600 font-bold">{rows.length} rows</span> detected — preview (first 5):
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="text-xs w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            {Object.keys(rows[0]).map(h => (
                              <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.slice(0, 5).map((row, i) => (
                            <tr key={i} className="border-t border-gray-100">
                              {Object.values(row).map((v, j) => (
                                <td key={j} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{v || <span className="text-gray-300">—</span>}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={close} className="btn-secondary">Cancel</button>
                  <button
                    onClick={handleImport}
                    disabled={!rows.length || importing}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Upload size={14} />
                    {importing ? 'Importing…' : `Import ${rows.length || ''} ${entityName}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
