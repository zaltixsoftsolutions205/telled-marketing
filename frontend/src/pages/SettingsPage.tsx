import { useRef, useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { settingsApi } from '@/api/settings';
import { useLogoStore } from '@/store/logoStore';

export default function SettingsPage() {
  const logoUrl = useLogoStore((s) => s.logoUrl);
  const setLogoUrl = useLogoStore((s) => s.setLogoUrl);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // uploadLogo returns full URL and also updates the store automatically
      await settingsApi.uploadLogo(file);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      showToast('Logo uploaded successfully', true);
    } catch {
      showToast('Failed to upload logo', false);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await settingsApi.deleteLogo();
      setLogoUrl(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      showToast('Logo removed', true);
    } catch {
      showToast('Failed to remove logo', false);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="page-header">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage company branding and application settings</p>
      </div>

      {toast && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${toast.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {toast.msg}
        </div>
      )}

      <div className="card">
        <h2 className="text-base font-semibold text-gray-800 mb-1">Company Logo</h2>
        <p className="text-sm text-gray-500 mb-5">This logo appears in the sidebar and on generated documents (PDFs, emails).</p>

        {/* Current logo / placeholder */}
        <div
          className="border-2 border-dashed border-violet-200 rounded-xl p-6 text-center hover:border-violet-400 transition-colors cursor-pointer bg-violet-50/40 mb-4"
          onClick={() => fileRef.current?.click()}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-20 w-auto object-contain mx-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : preview ? (
            <img src={preview} alt="Preview" className="h-20 w-auto object-contain mx-auto" />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload size={28} className="text-violet-400" />
              <p className="text-sm font-semibold text-violet-700">Add your logo here</p>
              <p className="text-xs text-gray-400">Click to upload PNG, JPG, SVG, or WebP — max 10 MB</p>
            </div>
          )}
          {(logoUrl || preview) && (
            <p className="text-xs text-violet-500 mt-3">{preview ? 'Image selected — click Upload to save' : 'Click to replace logo'}</p>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex flex-wrap gap-2">
          {preview && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="btn-primary flex items-center gap-2"
            >
              <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload Logo'}
            </button>
          )}
          {logoUrl && (
            <button
              onClick={handleRemove}
              disabled={removing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} /> {removing ? 'Removing…' : 'Remove Logo'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
