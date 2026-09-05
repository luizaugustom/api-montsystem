import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InvoicesService } from '../invoices.service';

/**
 * Listener que dispara a emissão automática de NFSe consolidada quando
 * uma venda é marcada como paga. O gatilho pode vir de:
 *   - Endpoint manual `POST /sales/:id/mark-paid` (venda avulsa)
 *   - Listener em MonthlyChargesService que detecta todos os mensalidades
 *     da venda pagos (venda mensalista)
 *
 * A idempotência é responsabilidade de `InvoicesService.createFromSale`,
 * que retorna a invoice já existente se houver uma AUTHORIZED para a venda.
 */
@Injectable()
export class SalePaidInvoiceListener {
  private readonly logger = new Logger(SalePaidInvoiceListener.name);

  constructor(private invoicesService: InvoicesService) {}

  @OnEvent('sale.paid')
  async handleSalePaid(payload: { sale: any }) {
    const sale = payload?.sale;
    if (!sale?.id) {
      this.logger.warn('sale.paid recebido sem sale.id — ignorando');
      return;
    }

    // Só emite NFSe automática se a venda tem valor > 0 e cliente vinculado
    if (!sale.saleValueCents || sale.saleValueCents <= 0) {
      this.logger.log(`sale.paid: venda ${sale.id} sem valor — pulando emissão de NFSe`);
      return;
    }
    if (!sale.clientId) {
      this.logger.warn(`sale.paid: venda ${sale.id} sem clientId — não é possível emitir NFSe`);
      return;
    }

    try {
      const result = await this.invoicesService.createFromSale(sale.id);
      this.logger.log(
        `NFSe automática emitida para venda ${sale.id} → invoice ${result.invoice?.id}`,
      );
    } catch (e: any) {
      this.logger.error(`Falha ao emitir NFSe automática para venda ${sale.id}: ${e?.message}`);
    }
  }
}
