/**
 * Truespace — Барный кейтеринг и финансы
 * Client API Error Handling & Russian Translation (`src/client/api/errors.ts`)
 *
 * Provides structured error objects and clear, friendly Russian explanations
 * without developer jargon per AGENTS.md guidelines.
 */

export class ApiClientError extends Error {
  public statusCode: number;
  public details?: string[];

  constructor(message: string, statusCode: number = 500, details?: string[]) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Translates server responses, network failures, or technical codes
 * into calm, human-friendly Russian messages.
 */
export function translateApiError(statusCode: number, rawMessage?: string): string {
  const msg = (rawMessage || '').toLowerCase();

  // Domain-specific catering validation errors
  if (msg.includes('больше нуля') || msg.includes('положительным числом') || msg.includes('больше 0')) {
    return 'Сумма операции должна быть больше 0 ₽.';
  }
  if (msg.includes('счёт списания') || msg.includes('счет списания') || msg.includes('fromaccountid')) {
    return 'Пожалуйста, выберите счёт, с которого списываются деньги.';
  }
  if (msg.includes('счёт зачисления') || msg.includes('счет зачисления') || msg.includes('toaccountid')) {
    return 'Пожалуйста, выберите счёт, на который зачисляются деньги.';
  }
  if (msg.includes('совпадать') || msg.includes('отличаться') || msg.includes('не могут совпадать')) {
    return 'Счёт списания и счёт зачисления не могут совпадать.';
  }
  if (msg.includes('не указана сумма')) {
    return 'В команде не распознана сумма. Например: «3500 лед» или «50000 предоплата».';
  }
  if (msg.includes('пустая команда')) {
    return 'Введите текст операции для быстрого разбора.';
  }
  if (msg.includes('не найдена') || msg.includes('не найден') || msg.includes('not found')) {
    return 'Запрошенная запись не найдена или уже была удалена.';
  }
  if (msg.includes('categoryid')) {
    return 'Пожалуйста, выберите статью/категорию операции.';
  }

  // HTTP status fallback
  switch (statusCode) {
    case 400:
      return rawMessage || 'Проверьте правильность введённых данных.';
    case 404:
      return 'Запрошенный раздел или запись не найдена.';
    case 408:
      return 'Время ожидания ответа сервера истекло. Попробуйте ещё раз.';
    case 500:
    case 502:
    case 503:
      return 'Сервер учёта временно недоступен. Попробуйте повторить действие через несколько секунд.';
    default:
      return rawMessage || 'Не удалось выполнить операцию. Проверьте соединение с сервером.';
  }
}
