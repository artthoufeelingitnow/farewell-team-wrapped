import { useEffect, useRef, useState } from 'react';
import type { Colleague } from '../../types';
import { sha256 } from '../../utils';

interface Props {
  colleague: Colleague;
  onUnlock: () => void;
  onCancel: () => void;
}

export function PasswordModal({ colleague, onUnlock, onCancel }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const submit = async () => {
    if (!value) return;
    const hash = await sha256(value);
    if (hash === colleague.passwordHash) {
      onUnlock();
    } else {
      setError("That password isn't right. Try again?");
      setValue('');
      setShake(true);
      setTimeout(() => setShake(false), 400);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="pw-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div
        className="pw-modal"
        style={shake ? { animation: 'shake 0.3s ease' } : undefined}
      >
        <h3>Hi, {colleague.name} 👋</h3>
        <p>Enter the password I sent you.</p>
        <input
          ref={inputRef}
          type="password"
          className="pw-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
          placeholder="••••••"
          autoComplete="off"
        />
        <div className="pw-error">{error}</div>
        <div className="pw-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void submit()}>Unlock</button>
        </div>
      </div>
    </div>
  );
}
