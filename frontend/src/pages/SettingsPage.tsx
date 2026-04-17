import { useRef, useState } from 'react';
import { Upload, Trash2, Image } from 'lucide-react';
import { settingsApi, resolveLogoUrl } from '@/api/settings';
import { useLogoStore } from '@/store/logoStore';

export default function SettingsPage() {
  const logoUrl = useLogoStore((s) => s.logoUrl);
  const setLogoUrl = useLogoStore((s) => s.setLogoUrl);
  const resolvedLogo = resolveLogoUrl(logoUrl);

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
      const url = await settingsApi.uploadLogo(file);
      setLogoUrl(url);
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

        {/* Current logo */}
        <div className="flex items-center gap-5 mb-6">
          <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden flex-shrink-0">
            {resolvedLogo ? (
              <img src={resolvedLogo} alt="Logo" className="w-full h-full object-contain p-2" />
            ) : preview ? (
              <img src={preview} alt="Preview" className="w-full h-full object-contain p-2" />
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Image size={28} className="text-gray-300" />
                <span className="text-xs text-gray-400">No logo</span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-3">
              {resolvedLogo ? 'Logo is currently set.' : 'No logo uploaded yet. Upload a PNG, JPG, SVG, or WebP image.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {resolvedLogo && (
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

        {/* Upload area */}
        <div
          className="border-2 border-dashed border-violet-200 rounded-xl p-6 text-center hover:border-violet-400 transition-colors cursor-pointer bg-violet-50/40"
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={24} className="mx-auto text-violet-400 mb-2" />
          <p className="text-sm font-medium text-violet-700">Click to choose a logo image</p>
          <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG, WebP — max 10 MB</p>
          {preview && (
            <p className="text-xs text-emerald-600 mt-2 font-medium">Image selected — click Upload to save</p>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {preview && (
          <div className="flex items-center gap-3 mt-4">
            <img src={preview} alt="Preview" className="h-16 w-16 object-contain rounded-xl border border-gray-200 bg-gray-50 p-1" />
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-2">Preview — ready to upload</p>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="btn-primary flex items-center gap-2"
              >
                <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload Logo'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
