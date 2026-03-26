interface BrowserFrameProps {
  children: React.ReactNode;
  url?: string;
}

export function BrowserFrame({
  children,
  url = "sideroom.link",
}: BrowserFrameProps) {
  return (
    <div className="rounded-xl overflow-hidden border border-dotted border-current/20">
      {/* Title bar — outline only */}
      <div className="flex items-center px-3 py-1.5 border-b border-dotted border-current/20">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full border border-current/30  bg-white/10" />
          <div className="w-2.5 h-2.5 rounded-full border border-current/30 bg-white/10" />
          <div className="w-2.5 h-2.5 rounded-full border border-current/30  bg-white/10" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="px-5 py-0.5 rounded-full font-pixel font-semibold bg-white/5 border border-current/20 text-current/60 text-[11px] tracking-wide">
            {url}
          </div>
        </div>
        <div className="w-[44px]" />
      </div>
      {/* Content */}
      <div className="aspect-video">{children}</div>
    </div>
  );
}
