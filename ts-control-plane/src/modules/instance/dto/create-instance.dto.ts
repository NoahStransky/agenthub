import { IsString } from 'class-validator';

export class CreateInstanceDto {
  @IsString()
  tenantId: string;

  @IsString()
  tier: string;
}
