import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  Req,
  Res,
  Inject,
  HttpCode,
  ParseUUIDPipe,
  ParseEnumPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiResponse, ApiProduces } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { SocialService } from './social.service';
import {
  RegisterDto,
  LoginDto,
  PostDto,
  CommentDto,
  ProfileDto,
  FeedQuery,
  SearchQuery,
} from './dto';
import { settings } from './config';
import { ChatService } from './chat.service';
const cookie = {
  httpOnly: true,
  secure: settings.secure,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 86400000,
};
@Controller('api')
@ApiCookieAuth('nexo_session')
export class SocialController {
  constructor(
    @Inject(SocialService) private readonly social: SocialService,
    @Inject(ChatService) private readonly chat: ChatService,
  ) {}
  @Get('health')
  @ApiTags('Sistema')
  @ApiOperation({ summary: 'Estado de la API y conexión PostgreSQL' })
  async health() {
    await this.social.query('SELECT 1');
    return { status: 'ok', service: 'nexo-api' };
  }
  @Post('auth/register')
  @ApiTags('Autenticación')
  @ApiOperation({ summary: 'Crear una cuenta e iniciar sesión' })
  @ApiResponse({ status: 409, description: 'Usuario o correo duplicado' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.social.register(dto);
    res.cookie('nexo_session', result.token, cookie);
    return result.user;
  }
  @Post('auth/login')
  @HttpCode(200)
  @ApiTags('Autenticación')
  @ApiOperation({ summary: 'Iniciar sesión con cookie HttpOnly' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.social.login(dto.email, dto.password);
    res.cookie('nexo_session', result.token, cookie);
    return result.user;
  }
  @Post('auth/logout')
  @HttpCode(204)
  @ApiTags('Autenticación')
  @ApiOperation({ summary: 'Revocar la sesión actual' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.social.logout(req);
    res.clearCookie('nexo_session', { ...cookie, maxAge: undefined });
  }
  @Get('auth/me')
  @ApiTags('Autenticación')
  @ApiOperation({ summary: 'Consultar usuario de la sesión actual' })
  async me(@Req() req: Request) {
    return this.social.requireViewer(req);
  }
  @Get('users')
  @ApiTags('Usuarios')
  @ApiOperation({ summary: 'Buscar personas o descubrir perfiles' })
  async users(@Req() req: Request, @Query() q: SearchQuery) {
    return this.social.users((await this.social.viewer(req, false))?.id || null, q.q);
  }
  @Patch('users/me')
  @ApiTags('Usuarios')
  @ApiOperation({ summary: 'Editar nombre y biografía propios' })
  async updateProfile(@Req() req: Request, @Body() dto: ProfileDto) {
    return this.social.updateProfile(await this.social.requireViewer(req), dto);
  }
  @Get('users/:username')
  @ApiTags('Usuarios')
  @ApiOperation({ summary: 'Consultar perfil público y estadísticas' })
  async profile(@Param('username') username: string, @Req() req: Request) {
    return this.social.profile(username, (await this.social.viewer(req, false))?.id || null);
  }
  @Post('users/:id/follow')
  @HttpCode(200)
  @ApiTags('Interacciones')
  @ApiOperation({ summary: 'Seguir a una persona (idempotente)' })
  async follow(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.social.follow(await this.social.requireViewer(req), id, true);
  }
  @Delete('users/:id/follow')
  @ApiTags('Interacciones')
  @ApiOperation({ summary: 'Dejar de seguir a una persona' })
  async unfollow(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.social.follow(await this.social.requireViewer(req), id, false);
  }
  @Get('posts')
  @ApiTags('Publicaciones')
  @ApiOperation({ summary: 'Feed paginado general, de seguidos o de un perfil' })
  async feed(@Req() req: Request, @Query() q: FeedQuery) {
    return this.social.feed((await this.social.viewer(req, false))?.id || null, q);
  }
  @Post('posts')
  @ApiTags('Publicaciones')
  @ApiOperation({ summary: 'Crear publicación de texto' })
  async create(@Req() req: Request, @Body() dto: PostDto) {
    return this.social.createPost(
      await this.social.requireViewer(req),
      dto.body,
      dto.attachmentIds,
    );
  }
  @Get('posts/:id')
  @ApiTags('Publicaciones')
  @ApiOperation({ summary: 'Consultar una publicación' })
  async post(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.social.post(id, (await this.social.viewer(req, false))?.id || null);
  }
  @Delete('posts/:id')
  @HttpCode(204)
  @ApiTags('Publicaciones')
  @ApiOperation({ summary: 'Eliminar una publicación propia' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    await this.social.deletePost(await this.social.requireViewer(req), id);
  }
  @Put('posts/:id/like')
  @ApiTags('Interacciones')
  @ApiOperation({ summary: 'Dar me gusta (idempotente)' })
  async like(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.social.like(await this.social.requireViewer(req), id, true);
  }
  @Delete('posts/:id/like')
  @ApiTags('Interacciones')
  @ApiOperation({ summary: 'Quitar me gusta' })
  async unlike(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.social.like(await this.social.requireViewer(req), id, false);
  }
  @Get('posts/:id/comments')
  @ApiTags('Comentarios')
  @ApiOperation({ summary: 'Listar hasta 100 comentarios de una publicación' })
  async comments(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.social.comments(id, (await this.social.viewer(req, false))?.id || null);
  }
  @Post('posts/:id/comments')
  @ApiTags('Comentarios')
  @ApiOperation({ summary: 'Comentar una publicación' })
  async comment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
    @Body() dto: CommentDto,
  ) {
    return this.social.comment(await this.social.requireViewer(req), id, dto.body);
  }
  @Delete('comments/:id')
  @HttpCode(204)
  @ApiTags('Comentarios')
  @ApiOperation({ summary: 'Eliminar un comentario propio' })
  async deleteComment(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    await this.social.deleteComment(await this.social.requireViewer(req), id);
  }
  @Get('notifications')
  @ApiTags('Notificaciones')
  @ApiOperation({ summary: 'Consultar las 50 notificaciones más recientes' })
  async notifications(@Req() req: Request) {
    return this.social.notifications(await this.social.requireViewer(req));
  }
  @Patch('notifications/read')
  @ApiTags('Notificaciones')
  @ApiOperation({ summary: 'Marcar las notificaciones propias como leídas' })
  async readNotifications(@Req() req: Request) {
    return this.social.readNotifications(await this.social.requireViewer(req));
  }
  @Get('events')
  @ApiTags('Tiempo real')
  @ApiProduces('text/event-stream')
  @ApiOperation({ summary: 'SSE autenticado: cambios del feed y notificaciones privadas' })
  async stream(@Req() req: Request, @Res() res: Response) {
    const user = await this.social.requireViewer(req);
    res.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    send({ type: 'connected' });
    this.chat.connect(user.id);
    this.social.events.on('feed', send);
    this.social.events.on(`user:${user.id}`, send);
    const heartbeat = setInterval(() => {
      this.chat.pulse(user.id);
      res.write(': heartbeat\n\n');
    }, 20000);
    const reauth = setInterval(() => {
      void this.social
        .viewer(req, false)
        .then((v) => {
          if (!v) res.end();
        })
        .catch(() => res.end());
    }, 60000);
    res.on('close', () => {
      clearInterval(heartbeat);
      clearInterval(reauth);
      this.chat.disconnect(user.id);
      this.social.events.off('feed', send);
      this.social.events.off(`user:${user.id}`, send);
    });
  }
}
