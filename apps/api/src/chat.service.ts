import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { SocialService, Viewer } from './social.service';
import { MessageDto } from './dto';
import { validateFile, Upload, attachmentJson, claimAttachments } from './media';
@Injectable()
export class ChatService {
  private connections = new Map<string, { count: number; seen: number }>();
  constructor(@Inject(SocialService) private social: SocialService) {}
  online(id: string) {
    const p = this.connections.get(id);
    return !!p && p.count > 0 && Date.now() - p.seen < 65000;
  }
  connect(id: string) {
    const old = this.connections.get(id);
    this.connections.set(id, { count: (old?.count || 0) + 1, seen: Date.now() });
    if (!old?.count) this.social.events.emit('feed', { type: 'presence.changed' });
  }
  pulse(id: string) {
    const p = this.connections.get(id);
    if (p) p.seen = Date.now();
  }
  disconnect(id: string) {
    const p = this.connections.get(id);
    if (p && --p.count <= 0) {
      this.connections.delete(id);
      this.social.events.emit('feed', { type: 'presence.changed' });
    }
  }
  async upload(user: Viewer, file: Upload | undefined) {
    const valid = validateFile(file);
    const f = file!;
    return this.social.transaction(async (c) => {
      // A single short lock makes shared and per-user quotas safe under concurrent uploads.
      await c.query(`SELECT pg_advisory_xact_lock(62483921)`);
      await c.query(
        `DELETE FROM attachments WHERE post_id IS NULL AND message_id IS NULL AND created_at<now()-interval '1 hour'`,
      );
      const {
        rows: [quota],
      } = await c.query(
        `SELECT COALESCE(sum(size),0)::bigint AS total,COALESCE(sum(size) FILTER(WHERE owner_id=$1),0)::bigint AS own FROM attachments`,
        [user.id],
      );
      if (
        Number(quota.own) + f.size > 20 * 1024 * 1024 ||
        Number(quota.total) + f.size > 100 * 1024 * 1024
      )
        throw new PayloadTooLargeException(
          'Espacio de adjuntos lleno (20 MB por usuario / 100 MB compartidos).',
        );
      const {
        rows: [a],
      } = await c.query(
        `INSERT INTO attachments(owner_id,name,mime,size,data) VALUES($1,$2,$3,$4,$5) RETURNING id,name,mime,size`,
        [user.id, valid.name, valid.mime, f.size, f.buffer],
      );
      return a;
    });
  }
  async attachment(id: string, user: Viewer | null) {
    // Select metadata first: do not fetch private bytes before checking authorization.
    const [a] = await this.social.query(
      `SELECT a.id,a.owner_id,a.post_id,a.message_id,a.name,a.mime,a.size,m.sender_id,m.recipient_id FROM attachments a LEFT JOIN messages m ON m.id=a.message_id WHERE a.id=$1`,
      [id],
    );
    if (!a) throw new NotFoundException('El archivo no existe.');
    if (!a.post_id && (!user || ![a.owner_id, a.sender_id, a.recipient_id].includes(user.id)))
      throw new NotFoundException('El archivo no existe.');
    const [data] = await this.social.query(`SELECT data FROM attachments WHERE id=$1`, [id]);
    return { ...a, data: data.data };
  }
  async discard(user: Viewer, id: string) {
    await this.social.query(
      `DELETE FROM attachments WHERE id=$1 AND owner_id=$2 AND post_id IS NULL AND message_id IS NULL`,
      [id, user.id],
    );
  }
  async contacts(user: Viewer) {
    const rows = await this.social.query(
      `SELECT u.id,u.username,u.display_name AS "displayName",latest.body AS "lastMessage",latest.created_at AS "lastAt",(SELECT count(*)::int FROM messages m WHERE m.sender_id=u.id AND m.recipient_id=$1 AND m.read_at IS NULL) AS unread FROM users u LEFT JOIN LATERAL (SELECT body,created_at FROM messages WHERE (sender_id=$1 AND recipient_id=u.id) OR (sender_id=u.id AND recipient_id=$1) ORDER BY created_at DESC,id DESC LIMIT 1) latest ON true WHERE u.id<>$1 ORDER BY latest.created_at DESC NULLS LAST,u.display_name LIMIT 100`,
      [user.id],
    );
    return rows.map((u) => ({ ...u, online: this.online(u.id) }));
  }
  async history(user: Viewer, other: string, before?: string) {
    const [person] = await this.social.query(
      `SELECT id,username,display_name AS "displayName" FROM users WHERE id=$1`,
      [other],
    );
    if (!person) throw new NotFoundException('El usuario no existe.');
    let cursor: null | { created_at: string; id: string } = null;
    if (before) {
      [cursor] = await this.social.query(
        `SELECT id,created_at::text AS created_at FROM messages WHERE id=$1 AND ((sender_id=$2 AND recipient_id=$3) OR (sender_id=$3 AND recipient_id=$2))`,
        [before, user.id, other],
      );
      if (!cursor) throw new NotFoundException('El mensaje no existe.');
    }
    const rows = await this.social.query(
      `SELECT m.id,m.sender_id AS "senderId",m.recipient_id AS "recipientId",m.body,m.created_at AS "createdAt",m.read_at AS "readAt",COALESCE((SELECT json_agg(${attachmentJson('a')}) FROM attachments a WHERE a.message_id=m.id),'[]') AS attachments FROM messages m WHERE ((m.sender_id=$1 AND m.recipient_id=$2) OR (m.sender_id=$2 AND m.recipient_id=$1)) AND ($3::timestamptz IS NULL OR (m.created_at,m.id)<($3::timestamptz,$4::uuid)) ORDER BY m.created_at DESC,m.id DESC LIMIT 51`,
      [user.id, other, cursor?.created_at || null, cursor?.id || null],
    );
    return {
      person: { ...person, online: this.online(other) },
      items: rows.slice(0, 50).reverse(),
      hasMore: rows.length > 50,
    };
  }
  async send(user: Viewer, other: string, dto: MessageDto) {
    if (other === user.id) throw new BadRequestException('Elige otra persona para conversar.');
    const id = await this.social.transaction(async (c) => {
      const {
        rows: [u],
      } = await c.query(`SELECT id FROM users WHERE id=$1 FOR KEY SHARE`, [other]);
      if (!u) throw new NotFoundException('El usuario no existe.');
      const {
        rows: [m],
      } = await c.query(
        `INSERT INTO messages(sender_id,recipient_id,body) VALUES($1,$2,$3) RETURNING id`,
        [user.id, other, dto.body],
      );
      await claimAttachments(c, user.id, dto.attachmentIds || [], 'message_id', m.id);
      return m.id;
    });
    for (const recipient of [user.id, other])
      this.social.events.emit(`user:${recipient}`, {
        type: 'messages.changed',
        peerId: recipient === user.id ? other : user.id,
      });
    return { id };
  }
  async read(user: Viewer, other: string) {
    const rows = await this.social.query(
      `UPDATE messages SET read_at=now() WHERE sender_id=$1 AND recipient_id=$2 AND read_at IS NULL RETURNING id`,
      [other, user.id],
    );
    if (rows.length)
      for (const id of [user.id, other])
        this.social.events.emit(`user:${id}`, {
          type: 'messages.changed',
          peerId: id === user.id ? other : user.id,
        });
    return { ok: true };
  }
}
