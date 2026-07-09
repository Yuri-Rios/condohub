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
    <div className="mb-4">
      <label className="mb-1 block font-medium text-gray-700">
        {label}
      </label>

      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-gray-300 bg-white p-3 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}