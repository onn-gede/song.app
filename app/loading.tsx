export default function Loading() {
  return (
    <main
      className="app-boot-screen"
      role="status"
      aria-live="polite"
      style={{ backgroundColor: "#f5f7f1", color: "#173e2c" }}
    >
      <div className="app-boot-mark">♫</div>
      <strong>
        SongApp<span>.</span>
      </strong>
      <small>Se pregătește aplicația…</small>
      <i />
    </main>
  );
}
