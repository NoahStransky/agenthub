import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  instanceId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsArray()
  agents?: string[];
}
