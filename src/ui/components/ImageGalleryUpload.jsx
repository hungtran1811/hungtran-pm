import { useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { uploadImage } from '../../services/cloudinary.service.js';
import { useToast } from './Toast.jsx';
import { Button } from './Button.jsx';
import { getErrorMessage } from '../../lib/firestore.js';

export function ImageGalleryUpload({ label = 'Ảnh minh họa', value = [], onChange, max = 12 }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const images = Array.isArray(value) ? value.filter((img) => img?.secureUrl) : [];

  const handleFiles = async (e) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    const remaining = max - images.length;
    if (remaining <= 0) {
      toast.error(`Tối đa ${max} ảnh minh họa.`);
      return;
    }
    setUploading(true);
    try {
      const toUpload = files.slice(0, remaining);
      const uploaded = await Promise.all(toUpload.map((file) => uploadImage(file)));
      onChange([
        ...images,
        ...uploaded.map((img, i) => ({ ...img, order: images.length + i + 1 })),
      ]);
      toast.success(`Đã thêm ${uploaded.length} ảnh.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeAt = (index) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div>
      <span className="label-base">{label}</span>
      <p className="mb-2 text-xs text-slate-500">
        Ảnh phụ hiển thị dưới banner trong bài giảng ({images.length}/{max}).
      </p>
      {images.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {images.map((img, i) => (
            <div
              key={img.secureUrl || i}
              className="group relative overflow-hidden rounded-lg ring-1 ring-slate-200 dark:ring-slate-700"
            >
              <img
                src={img.secureUrl}
                alt={img.alt || `Ảnh ${i + 1}`}
                className="aspect-video w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute right-1.5 top-1.5 rounded-md bg-black/60 p-1 text-white opacity-100 transition hover:bg-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                aria-label="Xoá ảnh"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        className="hidden"
      />
      <Button
        size="sm"
        variant="secondary"
        loading={uploading}
        disabled={images.length >= max}
        onClick={() => inputRef.current?.click()}
      >
        <Plus className="h-4 w-4" />
        Thêm ảnh minh họa
      </Button>
    </div>
  );
}
