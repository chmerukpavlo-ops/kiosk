import TelegramBot from 'node-telegram-bot-api';

let bot: TelegramBot | null = null;

export function initTelegramBot(): TelegramBot | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN not set. Telegram notifications disabled.');
    return null;
  }

  try {
    bot = new TelegramBot(token, { polling: false });
    console.log('✅ Telegram bot initialized');
    return bot;
  } catch (error) {
    console.error('❌ Failed to initialize Telegram bot:', error);
    return null;
  }
}

export function getTelegramBot(): TelegramBot | null {
  return bot;
}

export async function sendTelegramMessage(chatId: string, message: string): Promise<boolean> {
  if (!bot) {
    console.warn('Telegram bot not initialized');
    return false;
  }

  try {
    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
    });
    return true;
  } catch (error: any) {
    console.error('Failed to send Telegram message:', error.message);
    return false;
  }
}

export async function sendSaleNotification(
  chatId: string,
  sale: {
    product_name: string;
    quantity: number;
    price: number;
    seller_name?: string;
    kiosk_name?: string;
  }
): Promise<boolean> {
  const message = `
💰 <b>Новий продаж</b>

📦 Товар: ${sale.product_name}
🔢 Кількість: ${sale.quantity}
💵 Сума: ${sale.price.toFixed(2)} ₴
${sale.seller_name ? `👤 Продавець: ${sale.seller_name}` : ''}
${sale.kiosk_name ? `🏪 Ларьок: ${sale.kiosk_name}` : ''}
  `.trim();

  return sendTelegramMessage(chatId, message);
}

export async function sendLowStockNotification(
  chatId: string,
  product: {
    name: string;
    quantity: number;
    low_stock_threshold: number;
    kiosk_name?: string;
  }
): Promise<boolean> {
  const message = `
⚠️ <b>Низький залишок товару</b>

📦 Товар: ${product.name}
🔢 Залишок: ${product.quantity} шт.
📊 Поріг: ${product.low_stock_threshold} шт.
${product.kiosk_name ? `🏪 Ларьок: ${product.kiosk_name}` : ''}
  `.trim();

  return sendTelegramMessage(chatId, message);
}

export async function sendDailyReport(
  chatId: string,
  report: {
    revenue: number;
    sales_count: number;
    expenses?: number;
    margin?: number;
    date?: string;
  }
): Promise<boolean> {
  const date = report.date || new Date().toLocaleDateString('uk-UA');
  const message = `
📊 <b>Денний звіт</b>

📅 Дата: ${date}
💰 Виручка: ${report.revenue.toFixed(2)} ₴
🔢 Продажів: ${report.sales_count}
${report.expenses !== undefined ? `💳 Витрати: ${report.expenses.toFixed(2)} ₴` : ''}
${report.margin !== undefined ? `📈 Маржа: ${report.margin.toFixed(2)} ₴` : ''}
  `.trim();

  return sendTelegramMessage(chatId, message);
}

