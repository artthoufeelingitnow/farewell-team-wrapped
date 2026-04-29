import { useToastStore } from '../store/toastStore';

export function Toast() {
  const message = useToastStore((s) => s.message);
  if (!message) return null;
  return <div className="toast">{message}</div>;
}
