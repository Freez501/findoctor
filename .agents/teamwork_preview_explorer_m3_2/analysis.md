# Технический анализ и архитектура клиентского слоя данных (M3)
**Проект**: Truespace — Барный кейтеринг и финансы  
**Модуль**: Milestone M3 — Data Hooks, API Integration & State Synchronization  
**Автор**: Explorer 2 (Data Hooks & API Integration)  
**Дата**: 2026-09-17  

---

## 1. Резюме и границы исследования (Executive Summary)

Цель данного исследования — разработать детальный архитектурный план и готовые спецификации для клиентского слоя данных (Client Data Layer) системы учёта финансов барного кейтеринга Truespace в рамках Milestone M3.

### Ключевые требования (по ORIGINAL_REQUEST.md и PROJECT.md):
1. **R1. Раздельный учёт по 5 счетам**: «Нал 1» (`cash_1`), «Нал 2» (`cash_2`), «Безнал 1» (`bank_1`), «Безнал 2» (`bank_2`), «Переводы» (`card_sbp`) с автоматическим пересчётом балансов и суммарной ликвидности кейтеринга в рублях (₽).
2. **R2. 5-секундный мобильный ввод**: Быстрое создание операций дохода, расхода и внутреннего перевода за 3 действия (Тип -> Сумма -> Счёт/Категория) с мгновенным откликом (оптимистичное обновление без задержек).
3. **Telegram & Fast Simulator**: Мгновенный разбор текстовых команд («3500 лед Корпоратив Т-Банк», «50000 предоплата Свадьба», «-1500 такси нал1») через `/api/telegram/parse`, исполнение в главную книгу через `/api/telegram/execute` и опрос статуса бота `/api/telegram/status`.
4. **Сброс демо-данных**: Восстановление исходного состояния системы (5 счетов, 2 мероприятия, 21 транзакция) через `/api/system/reset-demo` с мгновенной синхронизацией всех экранов.
5. **Русскоязычный дружелюбный интерфейс**: Никаких непонятных английских стектрейсов (`Failed to fetch`, `500 Internal Server Error`). Все ошибки формулируются простым, спокойным языком по правилам `AGENTS.md`.
6. **Отказоустойчивость**: Устойчивость к перебоям мобильного интернета на выездных площадках, таймауты, отмена зависших запросов через `AbortController`, кэширование в `localStorage`.

---

## 2. Аудит контрактов бэкенда и сопоставление эндпоинтов

Анализ маршрутов (`src/server/routes/`), типов (`src/shared/types.ts`) и DTO (`src/shared/dto.ts`) фиксирует точные сигнатуры REST API:

| Метод & URL | Request Payload | Response DTO / Структура | Особенности реализации |
|---|---|---|---|
| `GET /api/accounts` | _нет_ | `GetAccountsResponseDTO`<br>`{ accounts: Account[], totalBalance: number }` | Возвращает 5 счетов в фиксированном порядке: `cash_1`, `cash_2`, `bank_1`, `bank_2`, `card_sbp`. |
| `GET /api/accounts/:id` | _нет_ | `{ account: Account }` | 404 если счёт не найден. |
| `GET /api/categories` | _нет_ | `GetCategoriesResponseDTO`<br>`{ categories: Category[] }` | Список категорий с полями `color`, `type` (`income`/`expense`/`both`/`transfer`), `isEventSpecific`. |
| `GET /api/events` | _нет_ | `GetEventsResponseDTO`<br>`{ events: CateringEvent[] }` | Список мероприятий (Свадьба, Корпоратив) со статусами. |
| `GET /api/transactions` | Query: `accountId`, `eventId`, `type`, `categoryId`, `startDate`, `endDate`, `includeDeleted` | `{ transactions: Transaction[] }` | **Важно**: если `eventId === 'null'`, сервер фильтрует общие расходы бара (`eventId === null`). |
| `POST /api/transactions` | `CreateTransactionDTO`<br>`{ type, amount, fromAccountId?, toAccountId?, categoryId, eventId?, description?, transactionDate? }` | `CreateTransactionResponseDTO`<br>`{ success: true, transaction: Transaction, updatedAccounts: Account[] }` | Сервер атомарно дебетует/кредитует счета и **сразу возвращает массив `updatedAccounts`**, что исключает необходимость дополнительного запроса балансов! |
| `DELETE /api/transactions/:id` | _нет_ | `DeleteTransactionResponseDTO`<br>`{ success: true, transaction: Transaction, updatedAccounts: Account[], message: string }` | Мягкое удаление (`isDeleted = true`) с автоматическим реверсом балансов и возвратом `updatedAccounts`. |
| `GET /api/telegram/status` | _нет_ | `BotStatus`<br>`{ enabled: boolean, mode: 'polling'\|'webhook'\|'mock', botUsername?: string, lastActiveAt?: string, configuredToken: boolean, message?: string }` | Для фонового опроса использовать `priority: 'low'`. |
| `POST /api/telegram/parse` | `{ text: string }` | `{ parsed: ParsedCommand }` | Быстрый предпросмотр без изменения состояния БД. Выбрасывает 400 при пустой строке или отсутствии суммы. |
| `POST /api/telegram/execute` | `{ text: string }` | `{ success: true, transaction: Transaction, updatedAccounts: Account[], message: string }` | Парсинг и немедленная проводка транзакции с префиксом `[Telegram]` в описании. Возвращает `updatedAccounts`. |
| `POST /api/system/reset-demo` | _нет_ | `ResetDemoResponseDTO`<br>`{ success: true, message: string, accounts: Account[], transactionsCount: number, eventsCount: number }` | Полный сброс к каноническому сиду. |

---

## 3. Архитектура API-клиента (`src/client/api/`)

Для обеспечения модульности, типизации и изоляции сетевого слоя от UI-компонентов создаётся отдельный модуль `src/client/api/`:
- `src/client/api/apiClient.ts` — типизированный HTTP-клиент на базе нативного `fetch`.
- `src/client/api/errors.ts` — класс `ApiClientError` и словарь перевода ошибок на русский язык.

### 3.1. Архитектура класса `ApiClient`
```ts
// src/client/api/apiClient.ts
import {
  Account,
  BotStatus,
  Category,
  CateringEvent,
  ParsedCommand,
  Transaction,
  TransactionFilter,
} from '../../shared/types.js';
import {
  CreateTransactionDTO,
  CreateTransactionResponseDTO,
  DeleteTransactionResponseDTO,
  GetAccountsResponseDTO,
  GetCategoriesResponseDTO,
  GetEventsResponseDTO,
  ResetDemoResponseDTO,
} from '../../shared/dto.js';
import { ApiClientError, translateApiError } from './errors.js';

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  priority?: 'high' | 'low' | 'auto';
}

export class ApiClient {
  private baseUrl: string;
  private defaultTimeout: number;

  constructor(baseUrl: string = '', defaultTimeout: number = 8000) {
    this.baseUrl = baseUrl;
    this.defaultTimeout = defaultTimeout;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { timeoutMs = this.defaultTimeout, priority, ...fetchOptions } = options;
    const url = `${this.baseUrl}${path}`;

    // Проверка оффлайн-статуса браузера
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ApiClientError(
        'Отсутствует подключение к интернету. Проверьте соединение с сетью на площадке.',
        0
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Связываем сигнал отмены из options, если он передан
    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        // Использование Fetch Priority API согласно modern-web-guidance
        ...(priority ? { priority } : {}),
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(fetchOptions.headers || {}),
        },
      });

      clearTimeout(timeoutId);

      // Успешный ответ
      if (response.ok) {
        return (await response.json()) as T;
      }

      // Обработка HTTP-ошибок (4xx, 5xx)
      let errorBody: any = null;
      try {
        errorBody = await response.json();
      } catch {
        // Ответ не в формате JSON
      }

      const rawMessage = errorBody?.error || errorBody?.message || response.statusText;
      const translated = translateApiError(response.status, rawMessage);
      throw new ApiClientError(translated, response.status, errorBody?.details);
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err instanceof ApiClientError) {
        throw err;
      }

      if (err.name === 'AbortError') {
        throw new ApiClientError(
          'Время ожидания ответа сервера истекло. Пожалуйста, попробуйте снова.',
          408
        );
      }

      throw new ApiClientError(
        'Не удалось связаться с сервером. Проверьте подключение к локальной сети или серверу.',
        0
      );
    }
  }

  // --- 1. Accounts ---
  public getAccounts(options?: RequestOptions): Promise<GetAccountsResponseDTO> {
    return this.request<GetAccountsResponseDTO>('/api/accounts', options);
  }

  public getAccountById(id: string, options?: RequestOptions): Promise<{ account: Account }> {
    return this.request<{ account: Account }>(`/api/accounts/${id}`, options);
  }

  // --- 2. Categories ---
  public getCategories(options?: RequestOptions): Promise<GetCategoriesResponseDTO> {
    return this.request<GetCategoriesResponseDTO>('/api/categories', options);
  }

  // --- 3. Events ---
  public getEvents(options?: RequestOptions): Promise<GetEventsResponseDTO> {
    return this.request<GetEventsResponseDTO>('/api/events', options);
  }

  // --- 4. Transactions ---
  public getTransactions(filter?: TransactionFilter, options?: RequestOptions): Promise<{ transactions: Transaction[] }> {
    const params = new URLSearchParams();
    if (filter) {
      if (filter.accountId) params.set('accountId', filter.accountId);
      if (filter.eventId !== undefined) {
        params.set('eventId', filter.eventId === null ? 'null' : filter.eventId);
      }
      if (filter.type) params.set('type', filter.type);
      if (filter.categoryId) params.set('categoryId', filter.categoryId);
      if (filter.startDate) params.set('startDate', filter.startDate);
      if (filter.endDate) params.set('endDate', filter.endDate);
      if (filter.includeDeleted !== undefined) params.set('includeDeleted', String(filter.includeDeleted));
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ transactions: Transaction[] }>(`/api/transactions${query}`, options);
  }

  public createTransaction(dto: CreateTransactionDTO, options?: RequestOptions): Promise<CreateTransactionResponseDTO> {
    return this.request<CreateTransactionResponseDTO>('/api/transactions', {
      ...options,
      method: 'POST',
      body: JSON.stringify(dto),
      priority: 'high',
    });
  }

  public deleteTransaction(id: string, options?: RequestOptions): Promise<DeleteTransactionResponseDTO> {
    return this.request<DeleteTransactionResponseDTO>(`/api/transactions/${id}`, {
      ...options,
      method: 'DELETE',
      priority: 'high',
    });
  }

  // --- 5. Telegram & Fast Simulator ---
  public getTelegramStatus(options?: RequestOptions): Promise<BotStatus> {
    return this.request<BotStatus>('/api/telegram/status', {
      ...options,
      priority: 'low', // фоновый опрос деприоритизирован
    });
  }

  public parseTelegramCommand(text: string, options?: RequestOptions): Promise<{ parsed: ParsedCommand }> {
    return this.request<{ parsed: ParsedCommand }>('/api/telegram/parse', {
      ...options,
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  public executeTelegramCommand(text: string, options?: RequestOptions): Promise<{
    success: boolean;
    transaction: Transaction;
    updatedAccounts: Account[];
    message: string;
  }> {
    return this.request<{
      success: boolean;
      transaction: Transaction;
      updatedAccounts: Account[];
      message: string;
    }>('/api/telegram/execute', {
      ...options,
      method: 'POST',
      body: JSON.stringify({ text }),
      priority: 'high',
    });
  }

  // --- 6. System ---
  public resetDemoData(options?: RequestOptions): Promise<ResetDemoResponseDTO> {
    return this.request<ResetDemoResponseDTO>('/api/system/reset-demo', {
      ...options,
      method: 'POST',
      priority: 'high',
    });
  }
}

export const api = new ApiClient();
```

### 3.2. Локализация и перевод ошибок (`src/client/api/errors.ts`)
```ts
// src/client/api/errors.ts
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

export function translateApiError(statusCode: number, rawMessage?: string): string {
  const msg = (rawMessage || '').toLowerCase();

  // 1. Поиск совпадений по специфичным доменным валидациям
  if (msg.includes('больше нуля') || msg.includes('положительным числом')) {
    return 'Сумма операции должна быть больше 0 ₽.';
  }
  if (msg.includes('счёт списания') || msg.includes('счет списания')) {
    return 'Пожалуйста, выберите счёт, с которого списываются деньги.';
  }
  if (msg.includes('счёт зачисления') || msg.includes('счет зачисления')) {
    return 'Пожалуйста, выберите счёт, на который зачисляются деньги.';
  }
  if (msg.includes('совпадать') || msg.includes('отличаться')) {
    return 'Счёт списания и счёт зачисления не могут быть одним и тем же счётом.';
  }
  if (msg.includes('не указана сумма')) {
    return 'В быстрой команде не распознана сумма. Например: «3500 лед» или «50000 предоплата».';
  }
  if (msg.includes('пустая команда')) {
    return 'Введите текст операции для разбора.';
  }
  if (msg.includes('не найдена') || msg.includes('не найден')) {
    return 'Запрошенная запись не найдена или уже была удалена.';
  }

  // 2. Стандартные HTTP статусы
  switch (statusCode) {
    case 400:
      return rawMessage || 'Проверьте корректность введённых данных.';
    case 404:
      return 'Запрашиваемый ресурс не найден.';
    case 408:
      return 'Превышено время ожидания ответа от сервера.';
    case 500:
    case 502:
    case 503:
      return 'Сервер учёта временно недоступен. Попробуйте повторить действие через несколько секунд.';
    default:
      return rawMessage || 'Произошла непредвиденная ошибка при обращении к серверу.';
  }
}
```

---

## 4. Синхронизация данных: Архитектура `FinanceContext`

### Проблема несогласованности:
В интерфейсе M3 присутствуют:
- Шапка с общим балансом (`TotalBalance`).
- 5 карточек счетов с живыми балансами (`AccountsCards`).
- Модальное окно 5-секундного ввода (`QuickEntryModal`).
- Симулятор Telegram-строки (`TelegramSimulator`).
- Кнопка сброса демо-данных (`ResetDemoButton`).

Если каждый хук `useAccounts` и `useTransactions` живёт изолированно:
1. Создание расхода в модалке обновит только локальное состояние модалки, а карточки счетов останутся со старыми балансами до полной перезагрузки страницы.
2. Ввод в Telegram-симуляторе добавит операцию, но карточки счетов на экране не изменятся.
3. Сброс демо-данных оставит старый список транзакций в журнале.

### Решение: Единый провайдер `FinanceProvider` + кастомные хуки
`FinanceContext` выступает единым координатором состояния клиентского приложения:
- Загружает данные один раз при старте (`accounts`, `events`, `categories`, `transactions`).
- Предоставляет методы-мутации (`createTransaction`, `deleteTransaction`, `executeTelegramCommand`, `resetDemoData`), которые:
  1. Применяют оптимистичные обновления (пользователь видит изменение за 16 миллисекунд).
  2. Выполняют запрос к бэкенду.
  3. Используют возвращённый массив `updatedAccounts` для точной синхронизации балансов.
  4. При ошибке — бесшовно откатывают баланс и транзакцию назад с показом понятного русскоязычного уведомления.
- Специализированные хуки `useAccounts`, `useTransactions`, `useCategories`, `useEvents` и `useTelegram` просто обращаются к контексту или обогащают его селекторами.

---

## 5. Спецификация кастомных хуков (`src/client/hooks/`)

### 5.1. Хук `useAccounts` (`src/client/hooks/useAccounts.ts`)
Предназначен для отображения 5 счетов, суммарного капитала и быстрых чипов счетов.

**Сигнатура и возможности**:
```ts
export interface UseAccountsReturn {
  accounts: Account[];
  totalBalance: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  
  // Удобные селекторы
  cashAccounts: Account[];     // cash_1, cash_2
  bankAccounts: Account[];     // bank_1, bank_2
  cardAccounts: Account[];     // card_sbp
  getAccountById: (id: string) => Account | undefined;
  
  // Форматированный суммарный баланс (например, "840 000 ₽")
  formattedTotalBalance: string;
}
```

**Особенности**:
- Порядок счетов строго детерминирован: `cash_1` (Касса на площадке), `cash_2` (Сейф), `bank_1` (Основной р/с), `bank_2` (Эквайринг), `card_sbp` (Переводы СБП).
- Расчёт суммарного капитала использует `Math.round(sum * 100) / 100` для защиты от накопления погрешности плавающей точки.
- Поддерживает ручной `refetch()` с защитой от двойных вызовов.

---

### 5.2. Хук `useTransactions` (`src/client/hooks/useTransactions.ts`)
Предназначен для быстрого ввода (5-секундная модалка), фильтрации и истории операций.

**Сигнатура и возможности**:
```ts
export interface UseTransactionsReturn {
  transactions: Transaction[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  filter: TransactionFilter;
  setFilter: (newFilter: Partial<TransactionFilter>) => void;
  resetFilter: () => void;
  
  // Операции
  createTransaction: (dto: CreateTransactionDTO) => Promise<{ success: boolean; error?: string }>;
  deleteTransaction: (id: string) => Promise<{ success: boolean; error?: string }>;
  refetch: () => Promise<void>;
}
```

**Сценарий 5-секундного ввода (Fast Entry Flow)**:
1. `validateCreateTransactionDTO(dto)` валидирует поля локально без сетевой задержки. Если сумма `<= 0` или не выбран счёт, возвращается локальная ошибка без вызова API.
2. Формируется временная оптимистичная транзакция `temp-tx-${Date.now()}`.
3. Оптимистично дебетуется/кредитуется счёт в локальном стейте.
4. Отправляется сетевой запрос `api.createTransaction(dto)`.
5. При успехе: временная транзакция заменяется на серверную, балансы фиксируются из `updatedAccounts`.
6. При ошибке: временная транзакция удаляется, балансы откатываются, устанавливается `error` на русском языке.

---

### 5.3. Хуки метаданных: `useCategories` и `useEvents`
Справочники категорий и мероприятий статичны в рамках смены, поэтому для них реализуется эффективное кэширование и удобные хелперы:

#### `useCategories`:
- Возвращает `categories: Category[]`.
- `quickChips`: массив из 6 ключевых быстрых чипов согласно `QUICK_CATEGORY_CHIPS`:
  1. «Лёд и продукты» (`supplies`, расход, cyan)
  2. «Алкоголь» (`alcohol`, расход, red)
  3. «Персонал» (`staff`, расход, orange)
  4. «Логистика» (`logistics`, расход, amber)
  5. «Доплата/Продажи» (`onsite_sales`, доход, sky blue)
  6. «Чаевые» (`tips`, доход, violet)
- `categoryMap`: словарь `Map<string, Category>` для мгновенного `O(1)` получения имени, цвета и иконки.
- `getCategoryName(id: string)`: безопасный поиск имени с фоллбэком.

#### `useEvents`:
- Возвращает `events: CateringEvent[]`.
- `activeEvents`: только активные и запланированные мероприятия (для селектора в модалке ввода).
- `getEventTitle(id: string | null | undefined)`: возвращает название ивента («Свадьба Артёма и Анны») или «Общие расходы бара», если `eventId === null`.

---

### 5.4. Хук `useTelegram` (`src/client/hooks/useTelegram.ts`)
Обеспечивает работу компонента веб-симулятора командной строки и статуса бота.

**Сигнатура и возможности**:
```ts
export interface UseTelegramReturn {
  // Статус бота
  botStatus: BotStatus | null;
  isStatusLoading: boolean;
  
  // Парсинг (предпросмотр)
  inputText: string;
  setInputText: (text: string) => void;
  parsedResult: ParsedCommand | null;
  isParsing: boolean;
  parseError: string | null;
  
  // Исполнение
  isExecuting: boolean;
  executeError: string | null;
  lastExecutedTransaction: Transaction | null;
  
  // Действия
  execute: (overrideText?: string) => Promise<boolean>;
  clear: () => void;
  refetchStatus: () => Promise<void>;
}
```

**Особенности работы с симулятором**:
- **Debounced Parsing**: при наборе текста пользователем («3500 лед Корпоратив Т-Банк») запрос `/api/telegram/parse` отправляется с задержкой 300 мс (debounce). Если пользователь продолжает печатать, предыдущий незавершённый запрос отменяется через `AbortController`.
- **Быстрые шаблоны (Quick Examples)**: клик по фишке примера мгновенно заполняет строку и запускает разбор.
- **Исполнение**: при нажатии Enter или кнопки «Провести» вызывается `/api/telegram/execute`, который добавляет транзакцию и обновляет счета через общий `FinanceContext`. Поле ввода очищается, а пользователю показывается зелёный бейдж успеха.

---

### 5.5. Хук `useResetDemo` (`src/client/hooks/useResetDemo.ts`)
- Предоставляет метод `resetDemo(): Promise<boolean>`.
- Управляет состоянием `isResetting` для блокировки интерфейса и отображения спиннера/лоадера.
- При подтверждении сброса вызывает `api.resetDemoData()`, очищает кэш `localStorage` и заново инициализирует стейт всех счетов, транзакций и ивентов.
- Выводит дружелюбное уведомление: «Демонстрационные данные успешно сброшены к начальному состоянию».

---

## 6. Оптимистичные обновления и защита финансовых инвариантов

При работе на выездной барной стойке бармен нажимает кнопку сохранения расхода на ходу. Любая задержка более 100 мс создаёт ощущение «зависшего» приложения.

### Алгоритм безопасного оптимистичного обновления:
```
[Бармен нажал «Записать расход 3 500 ₽»]
         │
         ▼
 1. Локальная валидация (проверка суммы, счёта)
         │  (ошибка? -> вывод сообщения без сетевого запроса)
         ▼
 2. Сохранение текущего snapshot балансов и списка транзакций
         │
         ▼
 3. Оптимистичное применение:
    - Счёт `cash_1`: 25 000 ₽ -> 21 500 ₽ (мгновенно в UI)
    - Общий капитал: 840 000 ₽ -> 836 500 ₽ (мгновенно в шапке)
    - Журнал: появление временной строки со спиннером
         │
         ▼
 4. Сетевой запрос: `POST /api/transactions`
        / \
       /   \
  [Успех]  [Ошибка / Обрыв сети]
     │                 │
     ▼                 ▼
 5. Замена         5. Откат к snapshot (25 000 ₽, 840 000 ₽)
    временной      6. Удаление временной транзакции
    транзакции     7. Вывод понятной ошибки на русском:
    на реальную       «Не удалось сохранить операцию.
    с сервера.        Баланс возвращён в исходное состояние.»
```

### Предотвращение копеечного дрейфа (IEEE-754 Precision):
В JavaScript вычисление `0.1 + 0.2` даёт `0.30000000000000004`. В финансовом приложении это недопустимо.
Все операции сложения/вычитания на клиенте обязаны использовать нормализацию:
```ts
export function roundRubles(value: number): number {
  return Math.round(value * 100) / 100;
}
```

---

## 7. Устойчивость к сетевым ошибкам и оффлайн-поведение (Resilience)

### 7.1. Мониторинг сети
Хуки подписываются на системные события браузера:
```ts
window.addEventListener('online', handleOnline);
window.addEventListener('offline', handleOffline);
```
При переходе в оффлайн шапка приложения отображает ненавязчивый индикатор:
> «🟡 Нет связи с сервером — работа в автономном режиме».

### 7.2. Кэширование в LocalStorage (Cache-First Read, Network Refresh)
Для предотвращения пустого белого экрана при открытии страницы в подвальном помещении:
- При каждом успешном получении `/api/accounts`, `/api/categories`, `/api/events` данные сериализуются в `localStorage` с префиксом `truespace_cache_`.
- При инициализации хуки мгновенно отдают данные из кэша, одновременно запуская фоновое обновление с сервера (`stale-while-revalidate`).
- Если сеть недоступна, интерфейс сразу отображает последний сохранённый снимок балансов.

### 7.3. Управление приоритетами сетевых запросов (Fetch Priority API)
Согласно рекомендациям `modern-web-guidance`:
- Критичные пользовательские действия (сохранение расхода, подтверждение перевода) отправляются с `priority: 'high'`.
- Фоновые периодические опросы (проверка статуса Telegram-бота) отправляются с `priority: 'low'`, чтобы не конкурировать за полосу пропускания сотового модема.

---

## 8. Русскоязычная локализация и форматирование (`src/client/utils/formatters.ts`)

Согласно требованиям `AGENTS.md` и `DESIGN_SYSTEM.md`:
- Все суммы отображаются с символом рубля `₽`, разделением тысяч неразрывным пробелом (`\u00A0`), например: `180 000 ₽` или `3 500,50 ₽`.
- Даты форматируются строго по российскому стандарту `ДД.ММ.ГГГГ` (например, `20.09.2026`).
- Время отображается в 24-часовом формате `ЧЧ:ММ` (например, `19:30`).

### Спецификация утилит форматирования:
```ts
// src/client/utils/formatters.ts

/**
 * Форматирует число в рубли с неразрывным пробелом:
 * formatRubles(25000) => "25 000 ₽"
 * formatRubles(3500.5) => "3 500,50 ₽"
 */
export function formatRubles(amount: number, options?: { hideDecimalsIfZero?: boolean }): string {
  if (typeof amount !== 'number' || isNaN(amount)) return '0 ₽';
  
  const hasKopecks = amount % 1 !== 0;
  const minimumFractionDigits = (options?.hideDecimalsIfZero && !hasKopecks) ? 0 : (hasKopecks ? 2 : 0);
  
  const formatted = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits,
    maximumFractionDigits: 2,
  }).format(amount);

  return `${formatted} ₽`;
}

/**
 * Форматирует дату ISO 8601 в российский формат ДД.ММ.ГГГГ
 */
export function formatDateRu(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return isoString;
  }
}

/**
 * Форматирует время в 24-часовой формат ЧЧ:ММ
 */
export function formatTime24h(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return '';
  }
}
```

---

## 9. План файлов и чек-лист для реализации (Builder Blueprint)

Для реализации клиентского слоя данных в Milestone M3 подготовлен следующий список файлов:

```
src/client/
├── api/
│   ├── apiClient.ts          # Strongly-typed fetch API client
│   └── errors.ts             # ApiClientError, translateApiError
├── context/
│   ├── FinanceContext.tsx    # Главный провайдер состояния и синхронизации
│   └── useFinanceContext.ts  # Хук доступа к общему контексту
├── hooks/
│   ├── useAccounts.ts        # Балансы 5 счетов, суммарный капитал, селекторы
│   ├── useTransactions.ts    # Ввод операций, фильтрация, отмена
│   ├── useCategories.ts      # Категории, 6 быстрых чипов, цвета
│   ├── useEvents.ts          # Мероприятия, привязка или «Общие расходы»
│   ├── useTelegram.ts        # Симулятор быстрой строки и статус бота
│   └── useResetDemo.ts       # Сброс демо-данных
└── utils/
    ├── formatters.ts         # Рубли (₽), ДД.ММ.ГГГГ, 24ч время
    └── storage.ts            # Безопасное кэширование в localStorage
```

### Чек-лист готовности реализации:
- [x] Полное сопоставление всех 11 REST API маршрутов сервера.
- [x] Поддержка детерминированного порядка 5 счетов по R1.
- [x] Спецификация 3-шагового быстрого ввода за 5 секунд по R2.
- [x] Интеграция с Telegram-парсером и симулятором быстрой строки.
- [x] Атомарный пересчёт балансов через `updatedAccounts` без лишних HTTP-запросов.
- [x] Двухуровневая валидация (локальная мгновенная + серверная).
- [x] Русскоязычные формулировки всех сообщений об ошибках.
- [x] Оптимистичные обновления с автоматическим откатом при сетевом сбое.
- [x] Кэширование в `localStorage` для холодного старта при слабой связи.
- [x] Защита от копеечного дрейфа плавающей точки через округление до 2 знаков.
