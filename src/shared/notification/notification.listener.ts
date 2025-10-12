import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import axios from 'axios';

@Injectable()
export class NotificationListener implements OnModuleInit {
  onModuleInit() {
    // can be used to set up subscriptions if needed
  }

  @OnEvent('customer.created')
  async handleCustomerCreated(payload: any) {
    await this.postEvent('customer.created', payload);
  }

  @OnEvent('sale.created')
  async handleSaleCreated(payload: any) {
    await this.postEvent('sale.created', payload);
  }

  private async postEvent(type: string, payload: any) {
    try {
      const url = process.env.NOTIFICATION_URL || 'http://notification:4000/events';
      await axios.post(url, { type, payload });
    } catch (e: any) {
      console.error('Failed to post event to notification service', e?.message || e);
    }
  }
}
