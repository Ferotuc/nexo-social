'use client';
import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import {
  Paperclip,
  Smile,
  X,
  FileText,
  Download,
  Send,
  MessageCircle,
  Search,
  ArrowLeft,
  LoaderCircle,
} from 'lucide-react';
import type { User, Attachment, Contact, Message, History } from '../lib/types';
import { api } from '../lib/client';
const emojis = [
  '😀',
  '😊',
  '😂',
  '🥰',
  '😎',
  '🤔',
  '🥳',
  '❤️',
  '👍',
  '👏',
  '🙌',
  '🔥',
  '✨',
  '🎉',
  '💙',
  '🌐',
  '🚀',
  '📚',
  '💻',
  '✅',
];
export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="emoji-control">
      <button
        type="button"
        className="icon-button"
        aria-label="Agregar emoji"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Smile size={20} />
      </button>
      {open && (
        <div className="emoji-picker" role="group" aria-label="Emojis">
          {emojis.map((e) => (
            <button
              type="button"
              key={e}
              aria-label={`Insertar ${e}`}
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export function Attachments({ items = [] }: { items?: Attachment[] }) {
  return (
    <div className="attachment-list">
      {items.map((a) => (
        <div
          className={`attachment ${a.mime.startsWith('image/') ? 'image-attachment' : ''}`}
          key={a.id}
        >
          {a.mime.startsWith('image/') ? (
            <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer">
              <img src={`/api/attachments/${a.id}`} alt={a.name} loading="lazy" />
            </a>
          ) : (
            <a href={`/api/attachments/${a.id}`} download={a.name}>
              <FileText size={23} />
              <span>
                {a.name}
                <small>{Math.ceil(a.size / 1024)} KB · Descargar</small>
              </span>
              <Download size={17} />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
export function RichComposer({
  onSend,
  onError,
  inputRef,
  placeholder = 'Escribe un mensaje…',
  label = 'Enviar',
  post = false,
}: {
  onSend: (body: string, attachmentIds: string[]) => Promise<void>;
  onError: (message: string) => void;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  placeholder?: string;
  label?: string;
  post?: boolean;
}) {
  const [body, setBody] = useState(''),
    [files, setFiles] = useState<Attachment[]>([]),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  async function upload(list: FileList | null) {
    if (!list) return;
    setUploading(true);
    try {
      let current = files.length;
      for (const f of Array.from(list)) {
        if (current >= 3) throw new Error('Máximo 3 adjuntos por envío.');
        if (f.size > 2097152) throw new Error('Cada archivo debe pesar como máximo 2 MB.');
        const data = new FormData();
        data.append('file', f);
        const a = await api<Attachment>('/attachments', { method: 'POST', body: data });
        setFiles((old) => [...old, a]);
        current++;
      }
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }
  async function remove(a: Attachment) {
    try {
      await api(`/attachments/${a.id}`, { method: 'DELETE' });
      setFiles((old) => old.filter((f) => f.id !== a.id));
    } catch (e) {
      onError((e as Error).message);
    }
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim() && !files.length) return;
    setBusy(true);
    try {
      await onSend(
        body.trim() ||
          (files.some((f) => f.mime.startsWith('image/'))
            ? '📷 Imagen compartida'
            : '📎 Archivo compartido'),
        files.map((f) => f.id),
      );
      setBody('');
      setFiles([]);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className={`rich-composer ${post ? 'composer' : ''}`}
      id={post ? 'compose' : undefined}
      onSubmit={send}
    >
      <textarea
        ref={inputRef}
        aria-label={post ? 'Escribe tu publicación' : 'Escribe un mensaje privado'}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        placeholder={placeholder}
        rows={post ? 3 : 2}
        disabled={busy}
      />
      {!!files.length && (
        <div className="pending-files">
          {files.map((a) => (
            <div key={a.id}>
              <span>
                {a.mime.startsWith('image/') ? '🖼️' : '📄'} {a.name}
              </span>
              <button
                type="button"
                className="icon-button"
                disabled={busy || uploading}
                aria-label={`Quitar ${a.name}`}
                onClick={() => void remove(a)}
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="rich-toolbar">
        <div>
          <EmojiPicker onPick={(e) => setBody((old) => (old + e).slice(0, 2000))} />
          <button
            className="icon-button"
            type="button"
            aria-label="Adjuntar imagen o archivo"
            disabled={busy || uploading || files.length >= 3}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <LoaderCircle className="spin" size={19} /> : <Paperclip size={20} />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.pdf,.txt"
            multiple
            hidden
            onChange={(e) => void upload(e.target.files)}
          />
          <small>
            {uploading ? 'Subiendo…' : post ? 'Para toda la comunidad' : 'Solo ustedes dos'}
          </small>
        </div>
        <button
          className="button primary"
          disabled={busy || uploading || (!body.trim() && !files.length)}
        >
          {busy ? 'Enviando…' : label}
          <Send size={16} />
        </button>
      </div>
      <p className="attachment-help">Imágenes, PDF o TXT · hasta 3 archivos de 2 MB</p>
    </form>
  );
}
export function ChatPanel({ me, onError }: { me: User; onError: (message: string) => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]),
    [peer, setPeer] = useState(''),
    [history, setHistory] = useState<History | null>(null),
    [filter, setFilter] = useState(''),
    [loading, setLoading] = useState(false),
    [failed, setFailed] = useState(false);
  const tail = useRef<HTMLDivElement>(null),
    version = useRef(0);
  useEffect(() => {
    const id = new URL(window.location.href).searchParams.get('user');
    if (id) setPeer(id);
  }, []);
  const refresh = useCallback(async () => {
    const request = ++version.current;
    try {
      const people = await api<Contact[]>('/chat/contacts');
      if (request !== version.current) return;
      setContacts(people);
      setFailed(false);
      if (peer) {
        const next = await api<History>(`/chat/${peer}/messages`);
        if (request !== version.current) return;
        setHistory((old) => {
          if (old?.person.id !== peer) return next;
          const older = old.items.filter((m) => !next.items.some((n) => n.id === m.id));
          return { ...next, items: [...older, ...next.items], hasMore: old.hasMore };
        });
        if (document.visibilityState === 'visible')
          await api(`/chat/${peer}/read`, { method: 'PATCH' });
      }
    } catch (e) {
      if (request === version.current) {
        setFailed(true);
        onError((e as Error).message);
      }
    }
  }, [peer, onError]);
  useEffect(() => {
    setHistory(null);
    void refresh();
    const update = () => void refresh();
    window.addEventListener('nexo:messages', update);
    window.addEventListener('nexo:presence', update);
    document.addEventListener('visibilitychange', update);
    const timer = setInterval(update, 30000);
    return () => {
      version.current++;
      clearInterval(timer);
      window.removeEventListener('nexo:messages', update);
      window.removeEventListener('nexo:presence', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [refresh]);
  useEffect(() => {
    tail.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [history?.items.at(-1)?.id, peer]);
  async function older() {
    if (!history?.items[0]) return;
    setLoading(true);
    try {
      const previous = await api<History>(`/chat/${peer}/messages?before=${history.items[0].id}`);
      setHistory((old) =>
        old?.person.id === previous.person.id
          ? {
              ...old,
              items: [
                ...previous.items.filter((m) => !old.items.some((n) => n.id === m.id)),
                ...old.items,
              ],
              hasMore: previous.hasMore,
            }
          : old,
      );
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  function choose(id: string) {
    setPeer(id);
    window.history.replaceState(null, '', `/messages?user=${id}`);
  }
  return (
    <section className={`chat-layout ${peer ? 'has-peer' : ''}`} aria-label="Mensajes privados">
      <aside className="chat-contacts">
        <h2>Conversaciones</h2>
        <label className="chat-search">
          <Search size={17} />
          <input
            aria-label="Buscar contacto"
            placeholder="Busca una persona…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
        <p className="muted chat-hint">Conversa ahora o deja un mensaje para después.</p>
        {contacts
          .filter((c) =>
            `${c.displayName} ${c.username}`.toLowerCase().includes(filter.toLowerCase()),
          )
          .map((c) => (
            <button
              className={`chat-contact ${peer === c.id ? 'selected' : ''}`}
              key={c.id}
              onClick={() => choose(c.id)}
            >
              <span className={`presence-dot ${c.online ? 'online' : ''}`} />
              <span>
                <strong>{c.displayName}</strong>
                <small>{c.online ? 'En línea' : c.lastMessage || 'Sin conexión'}</small>
              </span>
              {c.unread > 0 && <b className="badge">{c.unread}</b>}
            </button>
          ))}
        {!contacts.length && (
          <p className="muted">
            {failed
              ? 'No se cargaron los contactos.'
              : 'Aún no hay otras personas. Invita a alguien a registrarse.'}
          </p>
        )}
        {failed && (
          <button className="button outline" onClick={() => void refresh()}>
            Reintentar
          </button>
        )}
      </aside>
      <div className="chat-conversation">
        {peer && history ? (
          <>
            <header className="chat-heading">
              <button
                className="icon-button chat-back"
                aria-label="Volver a contactos"
                onClick={() => {
                  setPeer('');
                  window.history.replaceState(null, '', '/messages');
                }}
              >
                <ArrowLeft size={18} />
              </button>
              <span className={`presence-dot ${history.person.online ? 'online' : ''}`} />
              <div>
                <strong>{history.person.displayName}</strong>
                <small>
                  {history.person.online
                    ? 'En línea'
                    : 'Sin conexión · recibirá tu mensaje al volver'}
                </small>
              </div>
            </header>
            <div className="chat-history" aria-label="Historial de mensajes">
              {history.hasMore && (
                <button className="text-button" disabled={loading} onClick={() => void older()}>
                  Cargar mensajes anteriores
                </button>
              )}
              {!history.items.length && (
                <p className="chat-empty">Saluda a {history.person.displayName.split(' ')[0]} 👋</p>
              )}
              {history.items.map((m) => (
                <article
                  key={m.id}
                  className={`message-bubble ${m.senderId === me.id ? 'own' : ''}`}
                >
                  <p>{m.body}</p>
                  <Attachments items={m.attachments} />
                  <small>
                    {new Date(m.createdAt).toLocaleTimeString('es-GT', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {m.senderId === me.id && (m.readAt ? ' · Leído' : ' · Enviado')}
                  </small>
                </article>
              ))}
              <div ref={tail} />
            </div>
            <RichComposer
              key={peer}
              onError={onError}
              onSend={async (body, attachmentIds) => {
                await api(`/chat/${peer}/messages`, {
                  method: 'POST',
                  body: JSON.stringify({ body, attachmentIds }),
                });
                await refresh();
              }}
            />
          </>
        ) : (
          <div className="chat-empty">
            <MessageCircle size={38} />
            <h2>{peer ? 'Abriendo conversación…' : 'Tu espacio para conversar'}</h2>
            <p>Elige una persona para enviarle un mensaje privado.</p>
            <p className="muted">El punto verde indica una conexión activa a Nexo.</p>
            {failed && (
              <button className="button outline" onClick={() => void refresh()}>
                Reintentar
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
