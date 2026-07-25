type InputProps = {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
};

export default function Input({
  label,
  placeholder,
  value,
  onChange,
}: InputProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}
