type TextareaProps = {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
};

export default function Textarea({
  label,
  placeholder,
  value,
  onChange,
}: TextareaProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <textarea
        rows={5}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}
