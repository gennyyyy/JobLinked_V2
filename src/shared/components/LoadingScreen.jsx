export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 font-mono text-[11px] tracking-[0.2em] text-gray-400 uppercase">Loading database…</p>
      </div>
    </div>
  );
}
