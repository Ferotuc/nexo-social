import { Injectable, UnauthorizedException, ConflictException, NotFoundException, ForbiddenException, BadRequestException, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { EventEmitter } from 'node:events';
import type { Request } from 'express';
import { settings } from './config';
import { hashPassword, verifyPassword, tokenHash, newToken } from './security';
import { RegisterDto, ProfileDto, FeedQuery } from './dto';

export type Viewer={id:string;username:string;displayName:string;bio:string;email?:string;createdAt:string};
const publicFields=`u.id,u.username,u.display_name AS "displayName",u.bio,u.created_at AS "createdAt"`;
@Injectable()
export class SocialService implements OnModuleDestroy {
  readonly pool=new Pool({connectionString:settings.databaseUrl,max:10,connectionTimeoutMillis:10000});
  readonly events=new EventEmitter();
  constructor(){this.events.setMaxListeners(500);this.pool.on('error',e=>console.error('PostgreSQL:',e.message));}
  async onModuleDestroy(){await this.pool.end();}
  async query(sql:string,params:unknown[]=[]){return (await this.pool.query(sql,params)).rows;}
  async transaction<T>(work:(client:PoolClient)=>Promise<T>){const c=await this.pool.connect();try{await c.query('BEGIN');const data=await work(c);await c.query('COMMIT');return data;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
  async viewer(req:Request,required=true):Promise<Viewer|null>{
    const token=req.cookies?.nexo_session;
    const user=typeof token==='string'?(await this.query(`SELECT ${publicFields},u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`,[tokenHash(token)]))[0]:null;
    if(!user&&required)throw new UnauthorizedException('Inicia sesión para continuar.');return user||null;
  }
  async requireViewer(req:Request){return (await this.viewer(req))!;}
  async session(userId:string){const token=newToken();await this.query(`DELETE FROM sessions WHERE expires_at<now()`);await this.query(`INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '7 days')`,[userId,tokenHash(token)]);return token;}
  async register(dto:RegisterDto){
    const hash=await hashPassword(dto.password);
    try{const [u]=await this.query(`INSERT INTO users(username,email,password_hash,display_name) VALUES($1,$2,$3,$4) RETURNING id,username,email,display_name AS "displayName",bio,created_at AS "createdAt"`,[dto.username,dto.email,hash,dto.displayName]);return {user:u,token:await this.session(u.id)};}
    catch(e:any){if(e.code==='23505')throw new ConflictException('El correo o nombre de usuario ya está registrado.');throw e;}
  }
  async login(email:string,password:string){
    const [u]=await this.query(`SELECT ${publicFields},u.email,u.password_hash FROM users u WHERE email=$1`,[email]);
    const fallback='scrypt:00000000000000000000000000000000:'+ '0'.repeat(128);
    const valid=await verifyPassword(password,u?.password_hash||fallback);
    if(!u||!valid)throw new UnauthorizedException('Correo o contraseña incorrectos.');
    delete u.password_hash;return {user:u,token:await this.session(u.id)};
  }
  async logout(req:Request){const token=req.cookies?.nexo_session;if(typeof token==='string')await this.query(`DELETE FROM sessions WHERE token_hash=$1`,[tokenHash(token)]);}
  async profile(username:string,viewerId:string|null){
    const [u]=await this.query(`SELECT ${publicFields},
      (SELECT count(*)::int FROM posts WHERE author_id=u.id) AS "postsCount",
      (SELECT count(*)::int FROM follows WHERE following_id=u.id) AS "followersCount",
      (SELECT count(*)::int FROM follows WHERE follower_id=u.id) AS "followingCount",
      EXISTS(SELECT 1 FROM follows WHERE follower_id=$2 AND following_id=u.id) AS "isFollowing"
      FROM users u WHERE u.username=$1`,[username,viewerId]);
    if(!u)throw new NotFoundException('El perfil no existe.');return u;
  }
  async users(viewerId:string|null,q=''){return this.query(`SELECT ${publicFields},EXISTS(SELECT 1 FROM follows WHERE follower_id=$1 AND following_id=u.id) AS "isFollowing",(SELECT count(*)::int FROM follows WHERE following_id=u.id) AS "followersCount" FROM users u WHERE ($1::uuid IS NULL OR u.id<>$1) AND (u.username ILIKE $2 OR u.display_name ILIKE $2) ORDER BY "followersCount" DESC,u.created_at DESC LIMIT 12`,[viewerId,`%${q.replace(/[%_\\]/g,'\\$&')}%`]);}
  async updateProfile(user:Viewer,dto:ProfileDto){await this.query(`UPDATE users SET display_name=COALESCE($2,display_name),bio=COALESCE($3,bio) WHERE id=$1`,[user.id,dto.displayName??null,dto.bio??null]);return this.profile(user.username,user.id);}
  private postSelect=`SELECT p.id,p.body,p.created_at AS "createdAt",json_build_object('id',u.id,'username',u.username,'displayName',u.display_name) AS author,
    (SELECT count(*)::int FROM likes WHERE post_id=p.id) AS "likesCount",
    (SELECT count(*)::int FROM comments WHERE post_id=p.id) AS "commentsCount",
    EXISTS(SELECT 1 FROM likes WHERE post_id=p.id AND user_id=$1) AS liked
    FROM posts p JOIN users u ON u.id=p.author_id`;
  async feed(viewerId:string|null,q:FeedQuery){
    if(q.feed==='following'&&!viewerId)throw new UnauthorizedException('Inicia sesión para ver a quienes sigues.');
    const rows=await this.query(`${this.postSelect} WHERE ($2::text IS NULL OR u.username=$2) AND ($3::text <> 'following' OR p.author_id=$1 OR EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$1 AND f.following_id=p.author_id)) ORDER BY p.created_at DESC,p.id DESC LIMIT 16 OFFSET $4`,[viewerId,q.username||null,q.feed||'general',(q.page-1)*15]);
    return {items:rows.slice(0,15),page:q.page,hasMore:rows.length>15};
  }
  async post(id:string,viewerId:string|null){const [p]=await this.query(`${this.postSelect} WHERE p.id=$2`,[viewerId,id]);if(!p)throw new NotFoundException('La publicación no existe.');return p;}
  async createPost(user:Viewer,body:string){const [p]=await this.query(`INSERT INTO posts(author_id,body) VALUES($1,$2) RETURNING id`,[user.id,body]);this.events.emit('feed',{type:'feed.changed',postId:p.id});return this.post(p.id,user.id);}
  async deletePost(user:Viewer,id:string){const p=await this.post(id,user.id);if(p.author.id!==user.id)throw new ForbiddenException('Solo puedes eliminar tus publicaciones.');await this.query(`DELETE FROM posts WHERE id=$1 AND author_id=$2`,[id,user.id]);this.events.emit('feed',{type:'feed.changed',postId:id});}
  private async notification(c:PoolClient,recipientId:string,actorId:string,type:string,postId:string|null){
    if(recipientId===actorId)return;
    await c.query(`INSERT INTO notifications(recipient_id,actor_id,type,post_id) VALUES($1,$2,$3,$4)`,[recipientId,actorId,type,postId]);
  }
  private changed(recipientId:string,actorId:string,postId?:string){if(recipientId!==actorId)this.events.emit(`user:${recipientId}`,{type:'notifications.changed'});if(postId)this.events.emit('feed',{type:'post.changed',postId});}
  async like(user:Viewer,id:string,enabled:boolean){
    const recipient=await this.transaction(async c=>{
      const {rows:[p]}=await c.query(`SELECT author_id FROM posts WHERE id=$1 FOR KEY SHARE`,[id]);if(!p)throw new NotFoundException('La publicación no existe.');
      if(enabled){const result=await c.query(`INSERT INTO likes(user_id,post_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING user_id`,[user.id,id]);if(result.rowCount)await this.notification(c,p.author_id,user.id,'like',id);}
      else await c.query(`DELETE FROM likes WHERE user_id=$1 AND post_id=$2`,[user.id,id]);return p.author_id;
    });this.changed(recipient,user.id,id);return this.post(id,user.id);
  }
  async follow(user:Viewer,id:string,enabled:boolean){
    if(id===user.id)throw new BadRequestException('No puedes seguirte a ti mismo.');
    const target=await this.transaction(async c=>{
      const {rows:[u]}=await c.query(`SELECT username FROM users WHERE id=$1 FOR KEY SHARE`,[id]);if(!u)throw new NotFoundException('El usuario no existe.');
      if(enabled){const result=await c.query(`INSERT INTO follows(follower_id,following_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING follower_id`,[user.id,id]);if(result.rowCount)await this.notification(c,id,user.id,'follow',null);}
      else await c.query(`DELETE FROM follows WHERE follower_id=$1 AND following_id=$2`,[user.id,id]);return u.username;
    });this.changed(id,user.id);return this.profile(target,user.id);
  }
  async comments(id:string,viewerId:string|null){await this.post(id,viewerId);return this.query(`SELECT c.id,c.body,c.created_at AS "createdAt",json_build_object('id',u.id,'username',u.username,'displayName',u.display_name) AS author FROM comments c JOIN users u ON u.id=c.author_id WHERE c.post_id=$1 ORDER BY c.created_at ASC LIMIT 100`,[id]);}
  async comment(user:Viewer,id:string,body:string){
    const result=await this.transaction(async c=>{
      const {rows:[p]}=await c.query(`SELECT author_id FROM posts WHERE id=$1 FOR KEY SHARE`,[id]);if(!p)throw new NotFoundException('La publicación no existe.');
      const {rows:[comment]}=await c.query(`INSERT INTO comments(post_id,author_id,body) VALUES($1,$2,$3) RETURNING id`,[id,user.id,body]);
      await this.notification(c,p.author_id,user.id,'comment',id);return {id:comment.id,recipient:p.author_id};
    });this.changed(result.recipient,user.id,id);return {id:result.id,body,author:{id:user.id,username:user.username,displayName:user.displayName}};
  }
  async deleteComment(user:Viewer,id:string){const [c]=await this.query(`SELECT * FROM comments WHERE id=$1`,[id]);if(!c)throw new NotFoundException('El comentario no existe.');if(c.author_id!==user.id)throw new ForbiddenException('Solo puedes eliminar tus comentarios.');await this.query(`DELETE FROM comments WHERE id=$1 AND author_id=$2`,[id,user.id]);this.events.emit('feed',{type:'post.changed',postId:c.post_id});}
  async notifications(user:Viewer){return this.query(`SELECT n.id,n.type,n.post_id AS "postId",n.read_at AS "readAt",n.created_at AS "createdAt",json_build_object('id',u.id,'username',u.username,'displayName',u.display_name) AS actor FROM notifications n JOIN users u ON u.id=n.actor_id WHERE n.recipient_id=$1 ORDER BY n.created_at DESC LIMIT 50`,[user.id]);}
  async readNotifications(user:Viewer){await this.query(`UPDATE notifications SET read_at=now() WHERE recipient_id=$1 AND read_at IS NULL`,[user.id]);this.events.emit(`user:${user.id}`,{type:'notifications.changed'});return {ok:true};}
}
