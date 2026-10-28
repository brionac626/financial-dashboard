import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog?.showModal();
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog?.close(); document.body.style.overflow = before; if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" aria-label="關閉視窗" onClick={onClose}><X size={20} /></button></div>
    {children}
  </dialog>;
}
