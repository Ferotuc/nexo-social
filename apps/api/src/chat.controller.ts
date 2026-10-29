import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Req,
  Res,
  Inject,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  Injectable,
  CanActivate,
  ExecutionContext,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { SocialService } from './social.service';
import { ChatService } from './chat.service';
import { MessageDto, MessageQuery } from './dto';
import type { Upload } from './media';
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(SocialService) private social: SocialService) {}
  async canActivate(context: ExecutionContext) {
    await this.social.requireViewer(context.switchToHttp().getRequest());
    return true;
  }
}
@Controller('api')
@ApiCookieAuth('nexo_session')
export class ChatController {
  constructor(
    @Inject(SocialService) private social: SocialService,
    @Inject(ChatService) private chat: ChatService,
  ) {}
  @Post('attachments')
  @UseGuards(SessionGuard)
  @ApiTags('Archivos')
  @ApiOperation({ summary: 'Subir JPG, PNG, WebP, PDF o TXT (máximo 2 MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 2097152, files: 1, fields: 0, parts: 1 } }),
  )
  async upload(@Req() req: Request, @UploadedFile() file: Upload) {
    return this.chat.upload(await this.social.requireViewer(req), file);
  }
  @Get('attachments/:id')
  @ApiTags('Archivos')
  @ApiOperation({ summary: 'Leer adjunto: publicación pública o participantes del chat' })
  async download(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const f = await this.chat.attachment(id, await this.social.viewer(req, false));
    res
      .set({
        'Content-Type': f.mime,
        'Content-Length': String(f.size),
        'Content-Disposition': `${f.mime.startsWith('image/') ? 'inline' : 'attachment'}; filename="${f.name}"`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': 'private, no-store',
      })
      .send(f.data);
  }
  @Delete('attachments/:id')
  @HttpCode(204)
  @ApiTags('Archivos')
  @ApiOperation({ summary: 'Descartar un adjunto propio aún no enviado' })
  async discard(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    await this.chat.discard(await this.social.requireViewer(req), id);
  }
  @Get('chat/contacts')
  @ApiTags('Chat')
  @ApiOperation({ summary: 'Conversaciones, personas y presencia aproximada en línea' })
  async contacts(@Req() req: Request) {
    return this.chat.contacts(await this.social.requireViewer(req));
  }
  @Get('chat/:id/messages')
  @ApiTags('Chat')
  @ApiOperation({ summary: 'Historial privado paginado entre el usuario actual y otro' })
  async history(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() q: MessageQuery,
    @Req() req: Request,
  ) {
    return this.chat.history(await this.social.requireViewer(req), id, q.before);
  }
  @Post('chat/:id/messages')
  @ApiTags('Chat')
  @ApiOperation({ summary: 'Enviar mensaje privado con emojis y hasta 3 adjuntos' })
  async send(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MessageDto,
    @Req() req: Request,
  ) {
    return this.chat.send(await this.social.requireViewer(req), id, dto);
  }
  @Patch('chat/:id/read')
  @ApiTags('Chat')
  @ApiOperation({ summary: 'Marcar como leídos solo los mensajes recibidos de esa persona' })
  async read(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.chat.read(await this.social.requireViewer(req), id);
  }
}
