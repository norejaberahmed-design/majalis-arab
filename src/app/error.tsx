"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
      <h2 className="text-xl font-bold text-brand-800">حدث خطأ ما</h2>
      <p className="text-sm text-brand-500">
        عذراً، حدث خطأ غير متوقع. حاول مرة أخرى.
      </p>
      <button onClick={reset} className="btn-primary">
        إعادة المحاولة
      </button>
    </div>
  );
}
