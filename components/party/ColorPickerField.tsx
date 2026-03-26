"use client";

interface ColorPickerFieldProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  presets: string[];
}

export default function ColorPickerField({
  label,
  value,
  onChange,
  presets,
}: ColorPickerFieldProps) {
  const isCustom = !presets.includes(value);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-text-primary">{label}</label>
      <div className="flex items-center gap-2 flex-wrap">
        {presets.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className="w-7 h-7 rounded-full border-2 transition-all shrink-0"
            style={{
              backgroundColor: color,
              borderColor: value === color ? "white" : "transparent",
              boxShadow: value === color ? "0 0 0 2px rgba(255,255,255,0.3)" : "none",
            }}
          />
        ))}
        <label
          className="w-7 h-7 rounded-full border-2 transition-all
                     flex items-center justify-center cursor-pointer shrink-0
                     overflow-hidden relative"
          style={{
            backgroundColor: isCustom ? value : "transparent",
            borderColor: isCustom ? "white" : "transparent",
            boxShadow: isCustom ? "0 0 0 2px rgba(255,255,255,0.3)" : "none",
            borderStyle: isCustom ? "solid" : "dashed",
            ...(isCustom ? {} : { borderWidth: "1px", borderColor: "rgb(82 82 91)" }),
          }}
          title="Custom color"
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <span className={`text-xs pointer-events-none ${isCustom ? "text-white/80" : "text-text-tertiary"}`}>+</span>
        </label>
      </div>
    </div>
  );
}
