export function TypingIndicator({ username }: { username: string | null }) {
  return (
    <p aria-live="polite" className="h-5 px-1 text-xs text-fg-subtle">
      {username && (
        <>
          <span className="font-medium text-fg-muted">@{username}</span> is typing
          <span className="ml-0.5 inline-flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="animate-blink" style={{ animationDelay: `${i * 0.2}s` }}>
                .
              </span>
            ))}
          </span>
        </>
      )}
    </p>
  );
}
