import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateInstanceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['docker', 'kubernetes'])
  runtimeType?: 'docker' | 'kubernetes';

  @IsOptional()
  @IsIn(['runc', 'gvisor', 'kata'])
  runtimeClass?: 'runc' | 'gvisor' | 'kata';

  @IsOptional()
  @IsString()
  tier?: string;
}
