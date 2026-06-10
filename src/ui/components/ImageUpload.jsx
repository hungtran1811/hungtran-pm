import { useRef, useState } from 'react';
import { uploadImage } from '../../services/cloudinary.service.js';
import { useToast } from './Toast.jsx';
import { Button } from './Button.jsx';
import { getErrorMessage } from '../../lib/firestore.js';

export function ImageUpload({ label, value, onChange }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const previewUrl = typeof value === 'string' ? value : value?.secureUrl || '';

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const image = await uploadImage(file);
      onChange(image);
      toast.success('Đã tải ảnh lên.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <span className="label-base">{label}</span>
      <div className="flex items-center gap-3">
        {previewUrl ? (
          <img src={previewUrl} alt={label} className="h-16 w-24 rounded-lg object-cover" />
        ) : (
          <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400 dark:border-slate-700">
            Chưa có
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} loading={uploading}>
            {value ? 'Đổi ảnh' : 'Tải ảnh lên'}
          </Button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs text-red-500 hover:underline"
            >
              Xoá ảnh
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
