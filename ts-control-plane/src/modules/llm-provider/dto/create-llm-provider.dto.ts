import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateLlmProviderDto {
  @IsString()
  name: string;

  @IsString()
  provider: string;

  @IsString()
  baseUrl: string;

  @IsString()
  apiKey: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
