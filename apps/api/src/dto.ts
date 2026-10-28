import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min, MaxLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';
const trim=({value}:{value:unknown})=>typeof value==='string'?value.trim():value;
export class RegisterDto {
  @ApiProperty({example:'francisco'}) @Transform(trim) @IsString() @Matches(/^[a-z0-9_]{3,30}$/,{message:'username: usa 3–30 letras minúsculas, números o guion bajo'}) username!:string;
  @ApiProperty({example:'francisco@example.com'}) @Transform(({value})=>typeof value==='string'?value.trim().toLowerCase():value) @IsEmail() @MaxLength(254) email!:string;
  @ApiProperty({minLength:10,maxLength:128,example:'UnaClaveSegura2026!'}) @IsString() @Length(10,128) password!:string;
  @ApiProperty({example:'Francisco Otuc'}) @Transform(trim) @IsString() @Length(2,60) displayName!:string;
}
export class LoginDto {
  @ApiProperty({example:'francisco@example.com'}) @Transform(({value})=>typeof value==='string'?value.trim().toLowerCase():value) @IsEmail() @MaxLength(254) email!:string;
  @ApiProperty() @IsString() @Length(1,128) password!:string;
}
export class PostDto { @ApiProperty({maxLength:2000,example:'Hoy comparto mi primer proyecto web.'}) @Transform(trim) @IsString() @Length(1,2000) body!:string; }
export class CommentDto { @ApiProperty({maxLength:500,example:'¡Qué buen proyecto!'}) @Transform(trim) @IsString() @Length(1,500) body!:string; }
export class ProfileDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @Length(2,60) displayName?:string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(240) bio?:string;
}
export class FeedQuery {
  @ApiPropertyOptional({enum:['general','following']}) @IsOptional() @IsIn(['general','following']) feed?:'general'|'following';
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^[a-z0-9_]{3,30}$/) username?:string;
  @ApiPropertyOptional({default:1}) @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100000) page:number=1;
}
export class SearchQuery { @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(60) q?:string; }
