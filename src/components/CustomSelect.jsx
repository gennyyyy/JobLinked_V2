function CustomSelect({ value, onChange, options, className = '', disabled = false }) {
  return (
    <div className="relative inline-block w-full">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        style={{ colorScheme: 'light' }}
        className={`w-full appearance-none pl-2.5 pr-7 py-1 text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 text-gray-900 rounded-md focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 cursor-pointer transition-colors ${className} ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled} className="bg-white text-gray-900">
            {option.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
      </svg>
    </div>
  );
}

export default CustomSelect;
