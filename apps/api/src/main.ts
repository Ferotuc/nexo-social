import 'reflect-metadata';
import { Module, ValidationPipe, Catch, ArgumentsHost, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { SocialService } from './social.service';
import { SocialController } from './social.controller';
import { settings } from './config';
import { ChatService } from './chat.service';
import { ChatController, SessionGuard } from './chat.controller';
@Catch()
class Errors implements ExceptionFilter {
  catch(error:any,host:ArgumentsHost){const ctx=host.switchToHttp();const res=ctx.getResponse();const req=ctx.getRequest();const status=error instanceof HttpException?error.getStatus():[400,413].includes(error?.status)?error.status:500;const response=error instanceof HttpException?error.getResponse():status===413?'El cuerpo de la solicitud es demasiado grande.':status===400?'El JSON enviado no es válido.':null;if(status===500)Logger.error(error?.message,'API');res.status(status).json({statusCode:status,message:typeof response==='object'&&response?(response as any).message:response||'Ocurrió un error interno. Intenta nuevamente.',path:req.path,timestamp:new Date().toISOString()});}
}
@Module({controllers:[SocialController,ChatController],providers:[SocialService,ChatService,SessionGuard]}) class AppModule{}
async function bootstrap(){
  const app=await NestFactory.create(AppModule,{bodyParser:false});
  const express=await import('express');
  if(settings.trustProxy)app.getHttpAdapter().getInstance().set('trust proxy',1);
  app.use(helmet({contentSecurityPolicy:false}));
  app.use(express.json({limit:'16kb'}));app.use(cookieParser());
  app.use((req:any,res:any,next:any)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)){const origin=req.headers.origin;if(origin&&!settings.origins.includes(origin))return res.status(403).json({statusCode:403,message:'Origen no permitido.'});if(!origin&&req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({statusCode:403,message:'Solicitud entre sitios no permitida.'});}next();});
  app.enableCors({origin:settings.origins,credentials:true,methods:['GET','POST','PATCH','PUT','DELETE','OPTIONS']});
  app.use('/api/auth',rateLimit({windowMs:15*60000,limit:50,standardHeaders:'draft-8',legacyHeaders:false,message:{statusCode:429,message:'Demasiados intentos. Intenta en 15 minutos.'}}));
  app.use('/api',rateLimit({windowMs:60000,limit:240,standardHeaders:'draft-8',legacyHeaders:false,message:{statusCode:429,message:'Demasiadas solicitudes. Espera un momento.'}}));
  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
  app.useGlobalFilters(new Errors());
  const config=new DocumentBuilder().setTitle('Nexo · API de la comunidad').setDescription('API REST de Nexo. Registro/login establecen una cookie HttpOnly. Abre esta documentación desde el mismo sitio para probar las operaciones autenticadas. SSE transmite invalidaciones; consulta los endpoints REST para recuperar el estado persistido.').setVersion('1.0.0').addCookieAuth('nexo_session',{type:'apiKey',in:'cookie'},'nexo_session').build();
  const document=SwaggerModule.createDocument(app,config,{autoTagControllers:false});
  SwaggerModule.setup('api/docs',app,document,{swaggerOptions:{persistAuthorization:true,withCredentials:true},jsonDocumentUrl:'api/openapi.json'});
  app.enableShutdownHooks();await app.listen(settings.port,'0.0.0.0');Logger.log(`Nexo API: http://localhost:${settings.port}/api/docs`);
}
bootstrap().catch(e=>{console.error(e.message);process.exitCode=1;});
