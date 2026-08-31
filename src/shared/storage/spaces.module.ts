import { Module, Global } from '@nestjs/common';
import { SpacesService } from './spaces.service';

@Global()
@Module({
  providers: [SpacesService],
  exports: [SpacesService],
})
export class SpacesModule {}
